const Project = require('./project.model');
const ProjectMember = require('./project-member.model');
const OrganizationMember = require('../members/organization-member.model');
const User = require('../users/user.model');
const AppError = require('../../utils/app-error');
const withMongoTransaction = require('../../utils/mongo-transaction');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createProjectService({
  ProjectModel = Project,
  ProjectMemberModel = ProjectMember,
  OrganizationMemberModel = OrganizationMember,
  UserModel = User,
  runInTransaction = withMongoTransaction,
  clock = () => new Date()
} = {}) {
  async function create(organizationId, userId, fields) {
    return runInTransaction(async (session) => {
      const project = new ProjectModel({
        ...fields,
        organizationId,
        createdBy: userId,
        updatedBy: userId
      });
      await project.save({ session });
      const ownerMembership = new ProjectMemberModel({
        organizationId,
        projectId: project._id,
        userId,
        role: 'Owner',
        status: 'active',
        addedBy: userId
      });
      await ownerMembership.save({ session });
      return { project, membership: ownerMembership };
    });
  }

  async function list(organizationId, organizationRole, userId, options) {
    const { page, limit, q, status, visibility, archived, dueAfter, dueBefore, sort, order } = options;
    const filter = organizationScopedFilter(organizationId);
    filter.archivedAt = archived ? { $ne: null } : null;
    if (status) filter.status = status;
    if (visibility) filter.visibility = visibility;
    if (q) filter.name = new RegExp(escapeRegex(q), 'i');
    if (dueAfter || dueBefore) {
      filter.dueDate = {};
      if (dueAfter) filter.dueDate.$gte = dueAfter;
      if (dueBefore) filter.dueDate.$lte = dueBefore;
    }

    if (!['Owner', 'Admin', 'Manager'].includes(organizationRole)) {
      const memberships = await ProjectMemberModel.find(organizationScopedFilter(organizationId, {
        userId,
        status: 'active'
      })).select('projectId').lean();
      filter.$or = [
        { visibility: 'organization' },
        { _id: { $in: memberships.map((membership) => membership.projectId) } }
      ];
    }

    const direction = order === 'asc' ? 1 : -1;
    const sortSpec = { [sort]: direction, _id: 1 };
    const [projects, total] = await Promise.all([
      ProjectModel.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).lean(),
      ProjectModel.countDocuments(filter)
    ]);
    return { projects, pagination: paginationMetadata(page, limit, total) };
  }

  async function update(project, userId, changes) {
    if (project.archivedAt) throw new AppError('Archived projects cannot be updated until restored', 409, 'PROJECT_ARCHIVED');
    const startDate = Object.hasOwn(changes, 'startDate') ? changes.startDate : project.startDate;
    const dueDate = Object.hasOwn(changes, 'dueDate') ? changes.dueDate : project.dueDate;
    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      throw new AppError('Project start date must be on or before its due date', 400, 'INVALID_PROJECT_DATE_RANGE');
    }
    for (const field of ['name', 'description', 'status', 'visibility', 'startDate', 'dueDate']) {
      if (Object.hasOwn(changes, field)) project[field] = changes[field];
    }
    project.updatedBy = userId;
    await project.save();
    return project;
  }

  async function remove(project, organizationId) {
    await runInTransaction(async (session) => {
      const scope = organizationScopedFilter(organizationId, { projectId: project._id });
      await ProjectMemberModel.deleteMany(scope, { session });
      await ProjectModel.deleteOne(organizationScopedFilter(organizationId, { _id: project._id }), { session });
    });
  }

  async function archive(projectId, organizationId, userId) {
    const now = clock();
    const archived = await ProjectModel.findOneAndUpdate(
      organizationScopedFilter(organizationId, { _id: projectId, archivedAt: null }),
      { $set: { archivedAt: now, archivedBy: userId, updatedBy: userId } },
      { new: true, runValidators: true }
    );
    if (archived) return archived;
    const existing = await ProjectModel.findOne(organizationScopedFilter(organizationId, { _id: projectId }));
    if (!existing) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    throw new AppError('Project is already archived', 409, 'PROJECT_ALREADY_ARCHIVED');
  }

  async function restore(projectId, organizationId, userId) {
    const restored = await ProjectModel.findOneAndUpdate(
      organizationScopedFilter(organizationId, { _id: projectId, archivedAt: { $ne: null } }),
      { $set: { archivedAt: null, archivedBy: null, updatedBy: userId } },
      { new: true, runValidators: true }
    );
    if (restored) return restored;
    const existing = await ProjectModel.findOne(organizationScopedFilter(organizationId, { _id: projectId }));
    if (!existing) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    throw new AppError('Project is not archived', 409, 'PROJECT_NOT_ARCHIVED');
  }

  async function listMembers(organizationId, projectId, { page, limit }) {
    const filter = organizationScopedFilter(organizationId, { projectId, status: 'active' });
    const [members, total] = await Promise.all([
      ProjectMemberModel.find(filter).select('organizationId projectId userId role status joinedAt createdAt')
        .sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProjectMemberModel.countDocuments(filter)
    ]);
    if (!members.length) return { members: [], pagination: paginationMetadata(page, limit, total) };
    const users = await UserModel.find({ _id: { $in: members.map((member) => member.userId) } })
      .select('name email avatarUrl status').lean();
    const userById = new Map(users.map((user) => [String(user._id), user]));
    return {
      members: members.map((member) => ({ ...member, user: userById.get(String(member.userId)) || null })),
      pagination: paginationMetadata(page, limit, total)
    };
  }

  async function addMember(organizationId, projectId, actorId, userId, role = 'Editor') {
    const organizationMembership = await OrganizationMemberModel.findOne(organizationScopedFilter(organizationId, {
      userId,
      status: 'active'
    }));
    if (!organizationMembership) throw new AppError('User must be an active organization member', 404, 'ORGANIZATION_MEMBER_NOT_FOUND');

    const filter = organizationScopedFilter(organizationId, { projectId, userId });
    const existing = await ProjectMemberModel.findOne(filter);
    if (existing?.status === 'active') throw new AppError('User is already a project member', 409, 'ALREADY_A_PROJECT_MEMBER');
    if (existing) {
      existing.role = role;
      existing.status = 'active';
      existing.joinedAt = clock();
      existing.removedAt = null;
      existing.removedBy = null;
      existing.addedBy = actorId;
      await existing.save();
      return existing;
    }

    const member = new ProjectMemberModel({
      organizationId,
      projectId,
      userId,
      role,
      status: 'active',
      addedBy: actorId
    });
    try {
      await member.save();
    } catch (error) {
      if (error.code === 11000) throw new AppError('User is already a project member', 409, 'ALREADY_A_PROJECT_MEMBER');
      throw error;
    }
    return member;
  }

  async function updateMemberRole(organizationId, projectId, userId, role) {
    const member = await ProjectMemberModel.findOne(organizationScopedFilter(organizationId, {
      projectId,
      userId,
      status: 'active'
    }));
    if (!member) throw new AppError('Project member not found', 404, 'PROJECT_MEMBER_NOT_FOUND');
    if (member.role === 'Owner') throw new AppError('Project owner role cannot be changed', 403, 'PROJECT_OWNER_PROTECTED');
    member.role = role;
    await member.save();
    return member;
  }

  async function removeMember(organizationId, projectId, userId, actorId) {
    const filter = organizationScopedFilter(organizationId, { projectId, userId, status: 'active' });
    const member = await ProjectMemberModel.findOne(filter);
    if (!member) throw new AppError('Project member not found', 404, 'PROJECT_MEMBER_NOT_FOUND');
    if (member.role === 'Owner') throw new AppError('Project owner cannot be removed', 403, 'PROJECT_OWNER_PROTECTED');

    const removed = await ProjectMemberModel.findOneAndUpdate(
      organizationScopedFilter(organizationId, { projectId, userId, status: 'active', role: member.role }),
      { $set: { status: 'removed', removedAt: clock(), removedBy: actorId } },
      { new: true, runValidators: true }
    );
    if (!removed) throw new AppError('Project member changed; reload and try again', 409, 'PROJECT_MEMBER_CHANGED');
    return removed;
  }

  return { create, list, update, remove, archive, restore, listMembers, addMember, updateMemberRole, removeMember };
}

module.exports = createProjectService();
module.exports.createProjectService = createProjectService;
module.exports.escapeRegex = escapeRegex;
