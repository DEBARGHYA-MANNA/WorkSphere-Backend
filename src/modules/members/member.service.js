const OrganizationMember = require('./organization-member.model');
const User = require('../users/user.model');
const AppError = require('../../utils/app-error');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');
const { canAssignRole, canManageMember } = require('../../constants/permissions');

function createMemberService({ MemberModel = OrganizationMember, UserModel = User, clock = () => new Date() } = {}) {
  async function list(organizationId, { page, limit }) {
    const filter = organizationScopedFilter(organizationId, { status: 'active' });
    const [members, total] = await Promise.all([
      MemberModel.find(filter)
        .select('organizationId userId role status joinedAt createdAt')
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MemberModel.countDocuments(filter)
    ]);

    if (!members.length) return { members: [], pagination: paginationMetadata(page, limit, total) };
    const userIds = members.map((member) => member.userId);
    const users = await UserModel.find({ _id: { $in: userIds } }).select('name email avatarUrl status').lean();
    const userById = new Map(users.map((user) => [String(user._id), user]));
    return {
      members: members.map((member) => ({ ...member, user: userById.get(String(member.userId)) || null })),
      pagination: paginationMetadata(page, limit, total)
    };
  }

  async function updateRole(organizationId, memberId, newRole, actorMembership) {
    if (!canAssignRole(actorMembership.role, newRole)) {
      throw new AppError('You cannot assign this role', 403, 'ROLE_ASSIGNMENT_FORBIDDEN');
    }
    const scope = organizationScopedFilter(organizationId, { _id: memberId, status: 'active' });
    const target = await MemberModel.findOne(scope);
    if (!target) throw new AppError('Organization member not found', 404, 'MEMBER_NOT_FOUND');
    if (!canManageMember(actorMembership.role, target.role)) {
      throw new AppError('You cannot manage this member role', 403, 'ROLE_ASSIGNMENT_FORBIDDEN');
    }
    if (String(target.userId) === String(actorMembership.userId)) {
      throw new AppError('You cannot change your own organization role', 403, 'ROLE_ASSIGNMENT_FORBIDDEN');
    }

    const updated = await MemberModel.findOneAndUpdate(
      organizationScopedFilter(organizationId, { _id: memberId, status: 'active', role: target.role }),
      { $set: { role: newRole } },
      { new: true, runValidators: true }
    );
    if (!updated) throw new AppError('Member role changed; reload and try again', 409, 'MEMBER_ROLE_CHANGED');
    return updated;
  }

  async function remove(organizationId, memberId, actorMembership) {
    const scope = organizationScopedFilter(organizationId, { _id: memberId, status: 'active' });
    const target = await MemberModel.findOne(scope);
    if (!target) throw new AppError('Organization member not found', 404, 'MEMBER_NOT_FOUND');
    if (!canManageMember(actorMembership.role, target.role)) {
      throw new AppError('You cannot remove this organization member', 403, 'MEMBER_REMOVAL_FORBIDDEN');
    }

    const removed = await MemberModel.findOneAndUpdate(
      organizationScopedFilter(organizationId, { _id: memberId, status: 'active', role: target.role }),
      { $set: { status: 'removed', removedAt: clock(), removedBy: actorMembership.userId } },
      { new: true, runValidators: true }
    );
    if (!removed) throw new AppError('Member role changed; reload and try again', 409, 'MEMBER_ROLE_CHANGED');
    return removed;
  }

  return { list, updateRole, remove };
}

module.exports = createMemberService();
module.exports.createMemberService = createMemberService;
