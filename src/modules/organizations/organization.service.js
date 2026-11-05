const Organization = require('./organization.model');
const OrganizationMember = require('../members/organization-member.model');
const Invitation = require('../invitations/invitation.model');
const Project = require('../projects/project.model');
const ProjectMember = require('../projects/project-member.model');
const Task = require('../tasks/task.model');
const Comment = require('../comments/comment.model');
const Activity = require('../activities/activity.model');
const Notification = require('../notifications/notification.model');
const AppError = require('../../utils/app-error');
const withMongoTransaction = require('../../utils/mongo-transaction');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');

function slugify(name) {
  return name.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

function createOrganizationService({
  OrganizationModel = Organization,
  MemberModel = OrganizationMember,
  InvitationModel = Invitation,
  ProjectModel = Project,
  ProjectMemberModel = ProjectMember,
  TaskModel = Task,
  CommentModel = Comment,
  ActivityModel = Activity,
  NotificationModel = Notification,
  runInTransaction = withMongoTransaction
} = {}) {
  async function listForUser(userId, { page, limit }) {
    const filter = { userId, status: 'active' };
    const [memberships, total] = await Promise.all([
      MemberModel.find(filter).select('organizationId role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      MemberModel.countDocuments(filter)
    ]);
    if (!memberships.length) return { organizations: [], pagination: paginationMetadata(page, limit, total) };

    const organizationIds = memberships.map((membership) => membership.organizationId);
    const organizations = await OrganizationModel.find({ _id: { $in: organizationIds }, status: 'active' }).lean();
    const roleByOrganization = new Map(memberships.map((membership) => [String(membership.organizationId), membership.role]));
    const data = organizations.map((organization) => ({ ...organization, role: roleByOrganization.get(String(organization._id)) }));
    return { organizations: data, pagination: paginationMetadata(page, limit, total) };
  }

  async function create(userId, { name, description = '', settings = {} }) {
    const slug = slugify(name);
    if (slug.length < 2) throw new AppError('Organization name must contain letters or numbers', 400, 'INVALID_ORGANIZATION_NAME');

    try {
      return await runInTransaction(async (session) => {
        const organization = new OrganizationModel({ name, slug, description, createdBy: userId, settings });
        await organization.save({ session });
        const membership = new MemberModel({ organizationId: organization._id, userId, role: 'Owner', status: 'active' });
        await membership.save({ session });
        return { organization, membership };
      });
    } catch (error) {
      if (error.code === 11000) throw new AppError('An organization with this URL slug already exists', 409, 'ORGANIZATION_SLUG_TAKEN');
      throw error;
    }
  }

  async function update(organization, changes) {
    if (Object.hasOwn(changes, 'name')) organization.name = changes.name;
    if (Object.hasOwn(changes, 'description')) organization.description = changes.description;
    if (changes.settings) {
      for (const [key, value] of Object.entries(changes.settings)) organization.settings[key] = value;
    }
    await organization.save();
    return organization;
  }

  async function remove(organization, actorMembership) {
    if (actorMembership.role !== 'Owner') {
      throw new AppError('Only the organization owner can delete it', 403, 'FORBIDDEN');
    }
    await runInTransaction(async (session) => {
      const scope = organizationScopedFilter(organization._id);
      await InvitationModel.deleteMany(scope, { session });
      await NotificationModel.deleteMany(scope, { session });
      await TaskModel.deleteMany(scope, { session });
      await CommentModel.deleteMany(scope, { session });
      await ActivityModel.deleteMany(scope, { session });
      await ProjectMemberModel.deleteMany(scope, { session });
      await ProjectModel.deleteMany(scope, { session });
      await MemberModel.deleteMany(scope, { session });
      await OrganizationModel.deleteOne({ _id: organization._id }, { session });
    });
  }

  function switchContext(organization, membership) {
    return { organization, membership: { role: membership.role, status: membership.status } };
  }

  return { listForUser, create, update, remove, switchContext };
}

module.exports = createOrganizationService();
module.exports.createOrganizationService = createOrganizationService;
module.exports.slugify = slugify;
