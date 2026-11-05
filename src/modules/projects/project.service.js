const mongoose = require('mongoose');
const Project = require('./project.model');
const ProjectMember = require('./project-member.model');
const Task = require('../tasks/task.model');
const Comment = require('../comments/comment.model');
const Activity = require('../activities/activity.model');
const activityService = require('../activities/activity.service');
const Notification = require('../notifications/notification.model');
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
  TaskModel = Task,
  CommentModel = Comment,
  ActivityModel = Activity,
  ActivityService = activityService,
  NotificationModel = Notification,
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
      await ActivityService.record({
        organizationId,
        projectId: project._id,
        actorId: userId,
        action: 'project_created',
        targetType: 'project',
        targetId: project._id,
        metadata: { name: project.name }
      }, session);
      return { project, membership: ownerMembership };
    });
  }

  async function list(organizationId, organizationRole, userId, options) {
    const { page, limit, q, status, visibility, archived, dueAfter, dueBefore, sort, order } = options;
    const filter = organizationScopedFilter(organizationId);
    filter.archivedAt = archived ? mongoose.trusted({ $ne: null }) : null;
    if (status) filter.status = status;
    if (visibility) filter.visibility = visibility;
    if (q) filter.name = new RegExp(escapeRegex(q), 'i');
    if (dueAfter || dueBefore) {
      filter.dueDate = {};
      if (dueAfter) filter.dueDate.$gte = dueAfter;
      if (dueBefore) filter.dueDate.$lte = dueBefore;
      filter.dueDate = mongoose.trusted(filter.dueDate);
    }

    if (!['Owner', 'Admin', 'Manager'].includes(organizationRole)) {
      const memberships = await ProjectMemberModel.find(organizationScopedFilter(organizationId, {
        userId,
        status: 'active'
      })).select('projectId').lean();
      filter.$or = [
        { visibility: 'organization' },
        { _id: mongoose.trusted({ $in: memberships.map((membership) => membership.projectId) }) }
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
    return runInTransaction(async (session) => {
      for (const field of ['name', 'description', 'status', 'visibility', 'startDate', 'dueDate']) {
        if (Object.hasOwn(changes, field)) project[field] = changes[field];
      }
      project.updatedBy = userId;
      await project.save({ session });
      await ActivityService.record({
        organizationId: project.organizationId,
        projectId: project._id,
        actorId: userId,
        action: 'project_updated',
        targetType: 'project',
        targetId: project._id,
        metadata: { changedFields: Object.keys(changes) }
      }, session);
      return project;
    });
  }

  async function remove(project, organizationId, actorId) {
    await runInTransaction(async (session) => {
      const scope = organizationScopedFilter(organizationId, { projectId: project._id });
      await TaskModel.deleteMany(scope, { session });
      await CommentModel.deleteMany(scope, { session });
      await ActivityModel.deleteMany(scope, { session });
      await NotificationModel.deleteMany(scope, { session });
      await ProjectMemberModel.deleteMany(scope, { session });
      await ProjectModel.deleteOne(organizationScopedFilter(organizationId, { _id: project._id }), { session });
      await ActivityService.record({
        organizationId,
        actorId,
        action: 'project_deleted',
        targetType: 'project',
        targetId: project._id,
        metadata: { projectId: project._id, name: project.name }
      }, session);
    });
  }

  async function archive(projectId, organizationId, userId) {
    const now = clock();
    return runInTransaction(async (session) => {
      const archived = await ProjectModel.findOneAndUpdate(
        organizationScopedFilter(organizationId, { _id: projectId, archivedAt: null }),
        { $set: { archivedAt: now, archivedBy: userId, updatedBy: userId } },
        { new: true, runValidators: true, session }
      );
      if (archived) {
        await ActivityService.record({
          organizationId, projectId, actorId: userId, action: 'project_archived',
          targetType: 'project', targetId: projectId
        }, session);
        return archived;
      }
      const existing = await ProjectModel.findOne(organizationScopedFilter(organizationId, { _id: projectId }));
      if (!existing) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
      throw new AppError('Project is already archived', 409, 'PROJECT_ALREADY_ARCHIVED');
    });
  }

  async function restore(projectId, organizationId, userId) {
    return runInTransaction(async (session) => {
      const restored = await ProjectModel.findOneAndUpdate(
        organizationScopedFilter(organizationId, { _id: projectId, archivedAt: mongoose.trusted({ $ne: null }) }),
        { $set: { archivedAt: null, archivedBy: null, updatedBy: userId } },
        { new: true, runValidators: true, session }
      );
      if (restored) {
        await ActivityService.record({
          organizationId, projectId, actorId: userId, action: 'project_restored',
          targetType: 'project', targetId: projectId
        }, session);
        return restored;
      }
      const existing = await ProjectModel.findOne(organizationScopedFilter(organizationId, { _id: projectId }));
      if (!existing) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
      throw new AppError('Project is not archived', 409, 'PROJECT_NOT_ARCHIVED');
    });
  }

  async function listMembers(organizationId, projectId, { page, limit }) {
    const filter = organizationScopedFilter(organizationId, { projectId, status: 'active' });
    const [members, total] = await Promise.all([
      ProjectMemberModel.find(filter).select('organizationId projectId userId role status joinedAt createdAt')
        .sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProjectMemberModel.countDocuments(filter)
    ]);
    if (!members.length) return { members: [], pagination: paginationMetadata(page, limit, total) };
    const users = await UserModel.find({ _id: mongoose.trusted({ $in: members.map((member) => member.userId) }) })
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
    return runInTransaction(async (session) => {
      const existing = await ProjectMemberModel.findOne(filter);
      if (existing?.status === 'active') throw new AppError('User is already a project member', 409, 'ALREADY_A_PROJECT_MEMBER');
      if (existing) {
        existing.role = role;
        existing.status = 'active';
        existing.joinedAt = clock();
        existing.removedAt = null;
        existing.removedBy = null;
        existing.addedBy = actorId;
        await existing.save({ session });
        await ActivityService.record({
          organizationId, projectId, actorId, action: 'project_member_added',
          targetType: 'project_member', targetId: existing._id, metadata: { userId, role, reactivated: true }
        }, session);
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
        await member.save({ session });
      } catch (error) {
        if (error.code === 11000) throw new AppError('User is already a project member', 409, 'ALREADY_A_PROJECT_MEMBER');
        throw error;
      }
      await ActivityService.record({
        organizationId, projectId, actorId, action: 'project_member_added',
        targetType: 'project_member', targetId: member._id, metadata: { userId, role }
      }, session);
      return member;
    });
  }

  async function updateMemberRole(organizationId, projectId, userId, role, actorId) {
    const member = await ProjectMemberModel.findOne(organizationScopedFilter(organizationId, {
      projectId,
      userId,
      status: 'active'
    }));
    if (!member) throw new AppError('Project member not found', 404, 'PROJECT_MEMBER_NOT_FOUND');
    if (member.role === 'Owner') throw new AppError('Project owner role cannot be changed', 403, 'PROJECT_OWNER_PROTECTED');
    const previousRole = member.role;
    return runInTransaction(async (session) => {
      const updated = await ProjectMemberModel.findOneAndUpdate(
        organizationScopedFilter(organizationId, { projectId, userId, status: 'active', role: previousRole }),
        { $set: { role } },
        { new: true, runValidators: true, session }
      );
      if (!updated) throw new AppError('Project member changed; reload and try again', 409, 'PROJECT_MEMBER_CHANGED');
      await ActivityService.record({
        organizationId, projectId, actorId, action: 'project_member_role_changed',
        targetType: 'project_member', targetId: updated._id, metadata: { userId, previousRole, role }
      }, session);
      return updated;
    });
  }

  async function removeMember(organizationId, projectId, userId, actorId) {
    const filter = organizationScopedFilter(organizationId, { projectId, userId, status: 'active' });
    const member = await ProjectMemberModel.findOne(filter);
    if (!member) throw new AppError('Project member not found', 404, 'PROJECT_MEMBER_NOT_FOUND');
    if (member.role === 'Owner') throw new AppError('Project owner cannot be removed', 403, 'PROJECT_OWNER_PROTECTED');

    return runInTransaction(async (session) => {
      const removedAt = clock();
      const removed = await ProjectMemberModel.findOneAndUpdate(
        organizationScopedFilter(organizationId, { projectId, userId, status: 'active', role: member.role }),
        { $set: { status: 'removed', removedAt, removedBy: actorId } },
        { new: true, runValidators: true, session }
      );
      if (!removed) throw new AppError('Project member changed; reload and try again', 409, 'PROJECT_MEMBER_CHANGED');
      await TaskModel.updateMany(
        organizationScopedFilter(organizationId, { projectId, assigneeId: userId }),
        { $set: { assigneeId: null, updatedBy: actorId } },
        { session }
      );
      await NotificationModel.deleteMany(organizationScopedFilter(organizationId, { projectId, recipientId: userId }), { session });
      await ActivityService.record({
        organizationId, projectId, actorId, action: 'project_member_removed',
        targetType: 'project_member', targetId: removed._id, metadata: { userId, role: member.role }
      }, session);
      return removed;
    });
  }

  return { create, list, update, remove, archive, restore, listMembers, addMember, updateMemberRole, removeMember };
}

module.exports = createProjectService();
module.exports.createProjectService = createProjectService;
module.exports.escapeRegex = escapeRegex;
