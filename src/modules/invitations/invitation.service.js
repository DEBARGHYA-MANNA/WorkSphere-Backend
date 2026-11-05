const mongoose = require('mongoose');
const Invitation = require('./invitation.model');
const Organization = require('../organizations/organization.model');
const OrganizationMember = require('../members/organization-member.model');
const User = require('../users/user.model');
const AppError = require('../../utils/app-error');
const authCrypto = require('../../utils/auth-crypto');
const mailer = require('../../services/mailer');
const logger = require('../../logger');
const withMongoTransaction = require('../../utils/mongo-transaction');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');
const { canAssignRole, canManageMember } = require('../../constants/permissions');
const activityService = require('../activities/activity.service');
const env = require('../../config/env');

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function createInvitationService({
  InvitationModel = Invitation,
  OrganizationModel = Organization,
  MemberModel = OrganizationMember,
  UserModel = User,
  crypto = authCrypto,
  mail = mailer,
  ActivityService = activityService,
  config = env,
  runInTransaction = withMongoTransaction,
  clock = () => new Date()
} = {}) {
  async function create({ organization, actorMembership, email, role }) {
    const targetRole = role || organization.settings.defaultMemberRole;
    if (!canAssignRole(actorMembership.role, targetRole)) {
      throw new AppError('You cannot invite a member with this role', 403, 'ROLE_ASSIGNMENT_FORBIDDEN');
    }
    if (!organization.settings.allowMemberInvites && !['Owner', 'Admin'].includes(actorMembership.role)) {
      throw new AppError('Member invitations are disabled by organization settings', 403, 'INVITATIONS_DISABLED');
    }

    const normalizedEmail = email.toLowerCase();
    const now = clock();
    const filter = organizationScopedFilter(organization._id, { email: normalizedEmail, status: 'pending' });
    await InvitationModel.updateMany({ ...filter, expiresAt: mongoose.trusted({ $lte: now }) }, { $set: { status: 'expired' } });

    const existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      const existingMembership = await MemberModel.findOne(organizationScopedFilter(organization._id, {
        userId: existingUser._id,
        status: 'active'
      }));
      if (existingMembership) throw new AppError('User is already an organization member', 409, 'ALREADY_A_MEMBER');
    }

    const token = crypto.createOpaqueToken(32);
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    const invitation = new InvitationModel({
      organizationId: organization._id,
      email: normalizedEmail,
      role: targetRole,
      tokenHash: crypto.hashToken(token),
      invitedBy: actorMembership.userId,
      status: 'pending',
      expiresAt,
      purgeAt: new Date(expiresAt.getTime() + TOKEN_RETENTION_MS)
    });

    try {
      await runInTransaction(async (session) => {
        await invitation.save({ session });
        await ActivityService.record({
          organizationId: organization._id,
          actorId: actorMembership.userId,
          action: 'invitation_created',
          targetType: 'invitation',
          targetId: invitation._id,
          metadata: { role: targetRole }
        }, session);
      });
    } catch (error) {
      if (error.code === 11000) throw new AppError('A pending invitation already exists for this email', 409, 'INVITATION_EXISTS');
      throw error;
    }

    try {
      await mail.sendOrganizationInvitationEmail({
        to: normalizedEmail,
        token,
        organizationName: organization.name,
        role: targetRole
      });
    } catch (_error) {
      logger.error('Organization invitation email delivery failed');
    }
    return invitation;
  }

  async function list(organizationId, { page, limit }) {
    const filter = organizationScopedFilter(organizationId, { status: 'pending', expiresAt: mongoose.trusted({ $gt: clock() }) });
    const [invitations, total] = await Promise.all([
      InvitationModel.find(filter).select('email role invitedBy status expiresAt createdAt')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      InvitationModel.countDocuments(filter)
    ]);
    return { invitations, pagination: paginationMetadata(page, limit, total) };
  }

  async function revoke(organizationId, invitationId, actorMembership) {
    const scope = organizationScopedFilter(organizationId, { _id: invitationId, status: 'pending' });
    const invitation = await InvitationModel.findOne(scope);
    if (!invitation || invitation.expiresAt <= clock()) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }
    if (!canManageMember(actorMembership.role, invitation.role)) {
      throw new AppError('You cannot revoke this invitation', 403, 'FORBIDDEN');
    }
    return runInTransaction(async (session) => {
      const revoked = await InvitationModel.findOneAndUpdate(scope, {
        $set: { status: 'revoked', revokedAt: clock(), revokedBy: actorMembership.userId }
      }, { new: true, runValidators: true, session });
      if (!revoked) throw new AppError('Invitation is no longer pending', 409, 'INVITATION_NOT_PENDING');
      await ActivityService.record({
        organizationId,
        actorId: actorMembership.userId,
        action: 'invitation_revoked',
        targetType: 'invitation',
        targetId: revoked._id,
        metadata: { role: revoked.role }
      }, session);
      return revoked;
    });
  }

  async function accept({ token, user }) {
    if ((config.emailVerificationEnabled && !user.emailVerified) || user.status !== 'active') {
      throw new AppError('An active account is required to accept an invitation', 403, 'EMAIL_VERIFICATION_REQUIRED');
    }
    const tokenHash = crypto.hashToken(token);
    const now = clock();

    try {
      return await runInTransaction(async (session) => {
        const invitationQuery = InvitationModel.findOne({ tokenHash, status: 'pending', expiresAt: mongoose.trusted({ $gt: now }) });
        const invitation = await (session ? invitationQuery.session(session) : invitationQuery);
        if (!invitation || invitation.email !== user.email.toLowerCase()) {
          throw new AppError('Invitation is invalid, expired, or addressed to another account', 400, 'INVALID_INVITATION');
        }

        const organizationQuery = OrganizationModel.findOne({ _id: invitation.organizationId, status: 'active' });
        const organization = await (session ? organizationQuery.session(session) : organizationQuery);
        if (!organization) throw new AppError('Invitation is invalid, expired, or addressed to another account', 400, 'INVALID_INVITATION');

        const claimQuery = InvitationModel.findOneAndUpdate({
          _id: invitation._id,
          status: 'pending',
          expiresAt: mongoose.trusted({ $gt: now })
        }, {
          $set: { status: 'accepted', acceptedAt: now, acceptedBy: user._id }
        }, { new: true, runValidators: true, session });
        const claimed = await claimQuery;
        if (!claimed) throw new AppError('Invitation is invalid, expired, or already used', 400, 'INVALID_INVITATION');

        const memberFilter = organizationScopedFilter(organization._id, { userId: user._id });
        const existingMemberQuery = MemberModel.findOne(memberFilter);
        const existingMember = await (session ? existingMemberQuery.session(session) : existingMemberQuery);
        if (existingMember?.status === 'active') {
          throw new AppError('User is already an organization member', 409, 'ALREADY_A_MEMBER');
        }

        let membership;
        if (existingMember) {
          existingMember.role = invitation.role;
          existingMember.status = 'active';
          existingMember.joinedAt = now;
          existingMember.removedAt = null;
          existingMember.removedBy = null;
          await existingMember.save({ session });
          membership = existingMember;
        } else {
          membership = new MemberModel({
            organizationId: organization._id,
            userId: user._id,
            role: invitation.role,
            status: 'active',
            joinedAt: now
          });
          await membership.save({ session });
        }
        await ActivityService.record({
          organizationId: organization._id,
          actorId: user._id,
          action: 'invitation_accepted',
          targetType: 'invitation',
          targetId: claimed._id,
          metadata: { userId: user._id, role: invitation.role }
        }, session);
        await ActivityService.record({
          organizationId: organization._id,
          actorId: user._id,
          action: 'member_joined',
          targetType: 'organization_member',
          targetId: membership._id,
          metadata: { userId: user._id, role: invitation.role }
        }, session);
        return { organization, membership };
      });
    } catch (error) {
      if (error.code === 11000) throw new AppError('User is already an organization member', 409, 'ALREADY_A_MEMBER');
      throw error;
    }
  }

  return { create, list, revoke, accept };
}

module.exports = createInvitationService();
module.exports.createInvitationService = createInvitationService;
module.exports.constants = { INVITATION_TTL_MS, TOKEN_RETENTION_MS };
