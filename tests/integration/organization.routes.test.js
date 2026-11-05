jest.mock('../../src/middlewares/authenticate', () => (req, res, next) => {
  req.auth = { userId: 'bbbbbbbbbbbbbbbbbbbbbbbb', sessionId: 'test-session' };
  req.user = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', email: 'owner@example.com', emailVerified: true, status: 'active' };
  next();
});

jest.mock('../../src/middlewares/organization-access', () => {
  const middleware = (req, res, next) => {
    req.organization = {
      _id: req.params.organizationId || 'aaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Example Organization',
      status: 'active',
      settings: { allowMemberInvites: true, defaultMemberRole: 'Member' }
    };
    req.membership = { _id: 'member-owner', userId: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'Owner', status: 'active' };
    next();
  };
  middleware.authorizeOrganizationPermission = () => (req, res, next) => next();
  return middleware;
});

jest.mock('../../src/modules/organizations/organization.service', () => ({
  listForUser: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), switchContext: jest.fn()
}));
jest.mock('../../src/modules/members/member.service', () => ({ list: jest.fn(), updateRole: jest.fn(), remove: jest.fn() }));
jest.mock('../../src/modules/invitations/invitation.service', () => ({
  list: jest.fn(), create: jest.fn(), revoke: jest.fn(), accept: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');
const organizationService = require('../../src/modules/organizations/organization.service');
const memberService = require('../../src/modules/members/member.service');
const invitationService = require('../../src/modules/invitations/invitation.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

describe('Organization API routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates an organization and returns paginated organization listings', async () => {
    organizationService.create.mockResolvedValue({ organization: { _id: ORG_ID }, membership: { role: 'Owner' } });
    const created = await request(app).post('/api/v1/organizations').send({ name: 'Acme Team' });
    expect(created.status).toBe(201);
    expect(organizationService.create).toHaveBeenCalledWith('bbbbbbbbbbbbbbbbbbbbbbbb', { name: 'Acme Team' });

    organizationService.listForUser.mockResolvedValue({ organizations: [{ _id: ORG_ID, role: 'Owner' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const listed = await request(app).get('/api/v1/organizations');
    expect(listed.status).toBe(200);
    expect(listed.body.data[0].role).toBe('Owner');
    expect(organizationService.listForUser).toHaveBeenCalledWith('bbbbbbbbbbbbbbbbbbbbbbbb', { page: 1, limit: 20 });
  });

  test('organization member routes carry validated tenant context and pagination', async () => {
    memberService.list.mockResolvedValue({ members: [{ role: 'Owner' }], pagination: { page: 2, limit: 5, total: 1, totalPages: 1 } });
    const response = await request(app).get(`/api/v1/organizations/${ORG_ID}/members?page=2&limit=5`);
    expect(response.status).toBe(200);
    expect(response.body.data[0].role).toBe('Owner');
    expect(memberService.list).toHaveBeenCalledWith(ORG_ID, { page: 2, limit: 5 });
  });

  test('invitations are created and accepted through the correct routes', async () => {
    invitationService.create.mockResolvedValue({
      _id: 'invitation-1', email: 'member@example.com', role: 'Member', toJSON() { return { _id: this._id, email: this.email, role: this.role }; }
    });
    const created = await request(app).post(`/api/v1/organizations/${ORG_ID}/invitations`).send({ email: 'member@example.com' });
    expect(created.status).toBe(201);
    expect(created.body.data.invitation.email).toBe('member@example.com');
    expect(created.body.data.invitation.tokenHash).toBeUndefined();

    invitationService.accept.mockResolvedValue({ organization: { _id: ORG_ID }, membership: { role: 'Member' } });
    const accepted = await request(app).post('/api/v1/invitations/accept').send({ token: 'a'.repeat(43) });
    expect(accepted.status).toBe(200);
    expect(invitationService.accept).toHaveBeenCalledWith({ token: 'a'.repeat(43), user: expect.objectContaining({ email: 'owner@example.com' }) });
  });

  test('invalid organization identifiers are rejected before resource handlers', async () => {
    const response = await request(app).get('/api/v1/organizations/not-an-object-id');
    expect(response.status).toBe(400);
    expect(organizationService.update).not.toHaveBeenCalled();
  });
});
