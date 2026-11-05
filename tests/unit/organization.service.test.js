const { createOrganizationService } = require('../../src/modules/organizations/organization.service');
const { createMemberService } = require('../../src/modules/members/member.service');
const { createInvitationService } = require('../../src/modules/invitations/invitation.service');
const authCrypto = require('../../src/utils/auth-crypto');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const MEMBER_ID = 'cccccccccccccccccccccccc';

function query(value) {
  const promise = Promise.resolve(value);
  promise.session = () => promise;
  return promise;
}

function transaction(work) {
  return work({ id: 'test-session' });
}

function createInvitationModels({ existingUser = null } = {}) {
  const invitations = [];
  const members = [];
  const organization = {
    _id: ORG_ID,
    name: 'Example Organization',
    status: 'active',
    settings: { allowMemberInvites: true, defaultMemberRole: 'Member' }
  };

  class MemoryInvitation {
    constructor(data) {
      Object.assign(this, data);
      this._id = `invitation-${invitations.length + 1}`;
    }

    async save() {
      if (invitations.some((item) => item.organizationId === this.organizationId && item.email === this.email && item.status === 'pending')) {
        const error = new Error('duplicate pending invitation');
        error.code = 11000;
        throw error;
      }
      invitations.push(this);
      return this;
    }

    static updateMany(filter, update) {
      for (const item of invitations) {
        if (item.organizationId === filter.organizationId && item.email === filter.email && item.status === 'pending' && item.expiresAt <= filter.expiresAt.$lte) {
          Object.assign(item, update.$set);
        }
      }
      return Promise.resolve({ acknowledged: true });
    }

    static findOne(filter) {
      const item = invitations.find((candidate) =>
        Object.entries(filter).every(([key, expected]) => {
          if (expected && expected.$gt) return candidate[key] > expected.$gt;
          return candidate[key] === expected;
        })
      ) || null;
      return query(item);
    }

    static findOneAndUpdate(filter, update) {
      const item = invitations.find((candidate) => candidate._id === filter._id && candidate.status === filter.status && candidate.expiresAt > filter.expiresAt.$gt) || null;
      if (item) Object.assign(item, update.$set);
      return query(item);
    }
  }

  class MemoryMember {
    constructor(data) { Object.assign(this, data); }
    async save() { members.push(this); return this; }
    static findOne(filter) {
      return query(members.find((item) =>
        item.organizationId === filter.organizationId && item.userId === filter.userId &&
        (!filter.status || item.status === filter.status)
      ) || null);
    }
  }

  const UserModel = { findOne: jest.fn().mockImplementation(() => query(existingUser)) };
  const OrganizationModel = { findOne: jest.fn().mockImplementation(() => query(organization)) };
  const mail = { sendOrganizationInvitationEmail: jest.fn().mockResolvedValue(undefined) };
  const service = createInvitationService({
    InvitationModel: MemoryInvitation,
    OrganizationModel,
    MemberModel: MemoryMember,
    UserModel,
    runInTransaction: transaction,
    mail
  });
  return { service, invitations, members, organization, mail, UserModel, MemberModel: MemoryMember };
}

describe('Organization service', () => {
  test('creates an organization and its owner membership in one transaction', async () => {
    const organizations = [];
    const memberships = [];
    class OrganizationModel {
      constructor(data) { Object.assign(this, data); this._id = ORG_ID; this.settings = { allowMemberInvites: true, defaultMemberRole: 'Member', ...data.settings }; }
      async save(options) { organizations.push(this); this.session = options.session; }
    }
    class MemberModel {
      constructor(data) { Object.assign(this, data); }
      async save(options) { memberships.push(this); this.session = options.session; }
    }
    const runInTransaction = jest.fn(transaction);
    const service = createOrganizationService({ OrganizationModel, MemberModel, runInTransaction });

    const result = await service.create(OWNER_ID, { name: 'Café / Product Team', description: 'Shared work' });
    expect(result.organization.slug).toBe('cafe-product-team');
    expect(result.membership).toMatchObject({ userId: OWNER_ID, role: 'Owner', status: 'active' });
    expect(organizations).toHaveLength(1);
    expect(memberships).toHaveLength(1);
    expect(organizations[0].session).toBe(memberships[0].session);
    expect(runInTransaction).toHaveBeenCalledTimes(1);
  });

  test('updates only allowed organization settings and requires owner for deletion', async () => {
    const service = createOrganizationService({ runInTransaction: transaction });
    const org = { name: 'Before', description: '', settings: { allowMemberInvites: true, defaultMemberRole: 'Member' }, save: jest.fn() };
    await service.update(org, { name: 'After', settings: { defaultMemberRole: 'Viewer' } });
    expect(org.name).toBe('After');
    expect(org.settings).toEqual({ allowMemberInvites: true, defaultMemberRole: 'Viewer' });
    await expect(service.remove(org, { role: 'Admin' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('deletes project data and memberships atomically with the organization', async () => {
    const makeModel = () => ({ deleteMany: jest.fn(), deleteOne: jest.fn() });
    const InvitationModel = makeModel();
    const ProjectMemberModel = makeModel();
    const ProjectModel = makeModel();
    const TaskModel = makeModel();
    const MemberModel = makeModel();
    const OrganizationModel = makeModel();
    const service = createOrganizationService({
      InvitationModel, ProjectMemberModel, ProjectModel, TaskModel, MemberModel, OrganizationModel, runInTransaction: transaction
    });

    await service.remove({ _id: ORG_ID }, { role: 'Owner' });
    expect(InvitationModel.deleteMany).toHaveBeenCalledWith({ organizationId: ORG_ID }, { session: { id: 'test-session' } });
    expect(TaskModel.deleteMany).toHaveBeenCalledWith({ organizationId: ORG_ID }, { session: { id: 'test-session' } });
    expect(ProjectMemberModel.deleteMany).toHaveBeenCalledWith({ organizationId: ORG_ID }, { session: { id: 'test-session' } });
    expect(ProjectModel.deleteMany).toHaveBeenCalledWith({ organizationId: ORG_ID }, { session: { id: 'test-session' } });
    expect(MemberModel.deleteMany).toHaveBeenCalledWith({ organizationId: ORG_ID }, { session: { id: 'test-session' } });
    expect(OrganizationModel.deleteOne).toHaveBeenCalledWith({ _id: ORG_ID }, { session: { id: 'test-session' } });
  });
});

describe('Organization member service', () => {
  test('role changes and removals stay scoped to one organization and cannot escalate roles', async () => {
    const target = { _id: MEMBER_ID, organizationId: ORG_ID, userId: 'dddddddddddddddddddddddd', role: 'Member', status: 'active' };
    const MemberModel = {
      findOne: jest.fn().mockResolvedValue(target),
      findOneAndUpdate: jest.fn().mockResolvedValue({ ...target, role: 'Viewer' })
    };
    const service = createMemberService({ MemberModel });

    const changed = await service.updateRole(ORG_ID, MEMBER_ID, 'Viewer', { role: 'Owner', userId: OWNER_ID });
    expect(changed.role).toBe('Viewer');
    expect(MemberModel.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ organizationId: ORG_ID, _id: MEMBER_ID, status: 'active', role: 'Member' });

    await expect(service.updateRole(ORG_ID, MEMBER_ID, 'Admin', { role: 'Manager', userId: OWNER_ID }))
      .rejects.toMatchObject({ code: 'ROLE_ASSIGNMENT_FORBIDDEN' });
    await expect(service.remove(ORG_ID, MEMBER_ID, { role: 'Viewer', userId: OWNER_ID }))
      .rejects.toMatchObject({ code: 'MEMBER_REMOVAL_FORBIDDEN' });
  });

  test('removing an organization member revokes project memberships in the same transaction', async () => {
    const target = { _id: MEMBER_ID, organizationId: ORG_ID, userId: 'dddddddddddddddddddddddd', role: 'Member', status: 'active' };
    const MemberModel = {
      findOne: jest.fn().mockResolvedValue(target),
      findOneAndUpdate: jest.fn().mockResolvedValue({ ...target, status: 'removed' })
    };
    const ProjectMemberModel = { updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }) };
    const TaskModel = { updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }) };
    const runInTransaction = jest.fn(transaction);
    const service = createMemberService({ MemberModel, ProjectMemberModel, TaskModel, runInTransaction });

    await service.remove(ORG_ID, MEMBER_ID, { role: 'Owner', userId: OWNER_ID });
    expect(runInTransaction).toHaveBeenCalledTimes(1);
    expect(MemberModel.findOneAndUpdate.mock.calls[0][2]).toMatchObject({ session: { id: 'test-session' } });
    expect(ProjectMemberModel.updateMany).toHaveBeenCalledWith(
      { organizationId: ORG_ID, userId: target.userId, status: 'active' },
      { $set: expect.objectContaining({ status: 'removed', removedBy: OWNER_ID, removedAt: expect.any(Date) }) },
      { session: { id: 'test-session' } }
    );
    expect(TaskModel.updateMany).toHaveBeenCalledWith(
      { organizationId: ORG_ID, assigneeId: target.userId },
      { $set: { assigneeId: null, updatedBy: OWNER_ID } },
      { session: { id: 'test-session' } }
    );
  });
});

describe('Organization invitations', () => {
  test('creates hashed invitations and accepts them only for the verified matching account', async () => {
    const models = createInvitationModels();
    const invitation = await models.service.create({
      organization: models.organization,
      actorMembership: { role: 'Owner', userId: OWNER_ID },
      email: 'new.member@example.com'
    });
    const token = models.mail.sendOrganizationInvitationEmail.mock.calls[0][0].token;
    expect(invitation.tokenHash).toBe(authCrypto.hashToken(token));
    expect(invitation.tokenHash).not.toBe(token);
    expect(invitation.role).toBe('Member');

    const user = { _id: MEMBER_ID, email: 'new.member@example.com', emailVerified: true, status: 'active' };
    const result = await models.service.accept({ token, user });
    expect(result.organization._id).toBe(ORG_ID);
    expect(result.membership).toMatchObject({ userId: MEMBER_ID, role: 'Member', status: 'active' });
    expect(models.invitations[0].status).toBe('accepted');
    await expect(models.service.accept({ token, user })).rejects.toMatchObject({ code: 'INVALID_INVITATION' });
  });

  test('prevents managers inviting admins and rejects cross-account invitation acceptance', async () => {
    const models = createInvitationModels();
    await expect(models.service.create({
      organization: models.organization,
      actorMembership: { role: 'Manager', userId: OWNER_ID },
      email: 'new.member@example.com',
      role: 'Admin'
    })).rejects.toMatchObject({ code: 'ROLE_ASSIGNMENT_FORBIDDEN' });

    const invitation = await models.service.create({
      organization: models.organization,
      actorMembership: { role: 'Owner', userId: OWNER_ID },
      email: 'new.member@example.com',
      role: 'Member'
    });
    const token = models.mail.sendOrganizationInvitationEmail.mock.calls[0][0].token;
    expect(invitation.status).toBe('pending');
    await expect(models.service.accept({ token, user: { _id: MEMBER_ID, email: 'other@example.com', emailVerified: true, status: 'active' } }))
      .rejects.toMatchObject({ code: 'INVALID_INVITATION' });
  });
});
