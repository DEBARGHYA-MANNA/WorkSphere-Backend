const Organization = require('../../src/modules/organizations/organization.model');
const OrganizationMember = require('../../src/modules/members/organization-member.model');
const Invitation = require('../../src/modules/invitations/invitation.model');

describe('Organization persistence models', () => {
  test('organization slug is unique and membership is unique per organization/user pair', () => {
    expect(Organization.schema.indexes()).toEqual(expect.arrayContaining([
      [expect.objectContaining({ slug: 1 }), expect.objectContaining({ unique: true })]
    ]));
    expect(OrganizationMember.schema.indexes()).toEqual(expect.arrayContaining([
      [expect.objectContaining({ organizationId: 1, userId: 1 }), expect.objectContaining({ unique: true })]
    ]));
  });

  test('invitation tokens are hidden and only one pending invite per email/org is indexed', () => {
    expect(Invitation.schema.path('tokenHash').options.select).toBe(false);
    expect(Invitation.schema.indexes()).toEqual(expect.arrayContaining([
      [expect.objectContaining({ organizationId: 1, email: 1 }), expect.objectContaining({
        unique: true,
        partialFilterExpression: { status: 'pending' }
      })]
    ]));

    const invitation = new Invitation({ tokenHash: 'hashed-token', email: 'a@example.com' });
    expect(invitation.toJSON().tokenHash).toBeUndefined();
  });
});
