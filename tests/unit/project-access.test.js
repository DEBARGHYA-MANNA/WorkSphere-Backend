const { createProjectResourceAccess } = require('../../src/modules/projects/project-access');
const { PERMISSIONS } = require('../../src/constants/permissions');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const USER_ID = 'cccccccccccccccccccccccc';

function runMiddleware(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error || null)));
}

function createAccess({ project, membership = null }) {
  const ProjectModel = { findOne: jest.fn().mockResolvedValue(project) };
  const ProjectMemberModel = { findOne: jest.fn().mockResolvedValue(membership) };
  return { access: createProjectResourceAccess({ ProjectModel, ProjectMemberModel }), ProjectModel, ProjectMemberModel };
}

function request(role = 'Member') {
  return {
    organization: { _id: ORG_ID },
    membership: { role, status: 'active' },
    auth: { userId: USER_ID },
    params: { projectId: PROJECT_ID }
  };
}

describe('Project resource authorization', () => {
  test('allows organization-visible projects only with organization permissions', async () => {
    const project = { _id: PROJECT_ID, organizationId: ORG_ID, visibility: 'organization' };
    const { access, ProjectModel, ProjectMemberModel } = createAccess({ project });
    const req = request('Viewer');

    const error = await runMiddleware(access(PERMISSIONS.PROJECT_READ), req);
    expect(error).toBeNull();
    expect(req.resource).toBe(project);
    expect(ProjectModel.findOne).toHaveBeenCalledWith({ _id: PROJECT_ID, organizationId: ORG_ID });
    expect(ProjectMemberModel.findOne).not.toHaveBeenCalled();
  });

  test('private-project access derives permissions from active project membership, not request data', async () => {
    const project = { _id: PROJECT_ID, organizationId: ORG_ID, visibility: 'private' };
    const projectMember = { role: 'Editor', status: 'active' };
    const { access, ProjectMemberModel } = createAccess({ project, membership: projectMember });
    const req = request('Member');
    req.body = { role: 'Owner' };

    const error = await runMiddleware(access(PERMISSIONS.PROJECT_UPDATE), req);
    expect(error).toBeNull();
    expect(ProjectMemberModel.findOne).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: USER_ID,
      status: 'active'
    });
  });

  test('conceals private projects from nonmembers and denies read-only project roles updates', async () => {
    const project = { _id: PROJECT_ID, organizationId: ORG_ID, visibility: 'private' };
    const nobody = createAccess({ project });
    const concealed = await runMiddleware(nobody.access(PERMISSIONS.PROJECT_READ), request());
    expect(concealed).toMatchObject({ statusCode: 404, code: 'PROJECT_NOT_FOUND' });

    const viewer = createAccess({ project, membership: { role: 'Viewer', status: 'active' } });
    const denied = await runMiddleware(viewer.access(PERMISSIONS.PROJECT_UPDATE), request());
    expect(denied).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('grants organization-wide private-project access only to authorized organization roles', async () => {
    const project = { _id: PROJECT_ID, organizationId: ORG_ID, visibility: 'private' };
    const manager = createAccess({ project });
    expect(await runMiddleware(manager.access(PERMISSIONS.PROJECT_UPDATE), request('Manager'))).toBeNull();

    const member = createAccess({ project });
    expect(await runMiddleware(member.access(PERMISSIONS.PROJECT_READ), request('Member')))
      .toMatchObject({ statusCode: 404, code: 'PROJECT_NOT_FOUND' });
  });
});
