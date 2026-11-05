const { createTaskAccess } = require('../../src/modules/tasks/task-access');
const { PERMISSIONS } = require('../../src/constants/permissions');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TASK_ID = 'cccccccccccccccccccccccc';
const USER_ID = 'dddddddddddddddddddddddd';

function runMiddleware(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error || null)));
}

function request(role, projectRole, project = { _id: PROJECT_ID, organizationId: ORG_ID, visibility: 'organization' }) {
  return {
    organization: { _id: ORG_ID },
    membership: { role, status: 'active' },
    auth: { userId: USER_ID },
    params: { organizationId: ORG_ID, projectId: PROJECT_ID, taskId: TASK_ID },
    resource: project,
    projectMembership: projectRole ? { role: projectRole, status: 'active' } : null
  };
}

describe('Task authorization', () => {
  test('project Editor can create, update, and assign tasks; Viewer membership limits access to reads', async () => {
    const access = createTaskAccess();
    expect(await runMiddleware(access.authorizeCollection(PERMISSIONS.TASK_CREATE), request('Member', 'Editor'))).toBeNull();
    expect(await runMiddleware(access.authorizeCollection(PERMISSIONS.TASK_ASSIGN), request('Member', 'Editor'))).toBeNull();
    const viewerRequest = request('Member', 'Viewer');
    viewerRequest.body = { role: 'Owner' };
    viewerRequest.auth.role = 'Owner';
    expect(await runMiddleware(access.authorizeCollection(PERMISSIONS.TASK_UPDATE), viewerRequest))
      .toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(await runMiddleware(access.authorizeCollection(PERMISSIONS.TASK_READ), request('Viewer', 'Viewer'))).toBeNull();
  });

  test('organization Managers retain their central permissions and archived projects reject task mutations', async () => {
    const access = createTaskAccess();
    expect(await runMiddleware(access.authorizeCollection(PERMISSIONS.TASK_ASSIGN), request('Manager', 'Viewer'))).toBeNull();
    const archived = request('Owner', 'Owner', { _id: PROJECT_ID, organizationId: ORG_ID, archivedAt: new Date() });
    expect(await runMiddleware(access.authorizeCollection(PERMISSIONS.TASK_CREATE), archived))
      .toMatchObject({ statusCode: 409, code: 'PROJECT_ARCHIVED' });
  });

  test('resource authorization scopes task lookups to both organization and project', async () => {
    const task = { _id: TASK_ID, organizationId: ORG_ID, projectId: PROJECT_ID };
    const TaskModel = { findOne: jest.fn().mockResolvedValue(task) };
    const access = createTaskAccess({ TaskModel });
    const req = request('Member', 'Editor');
    const error = await runMiddleware(access.authorizeTask(PERMISSIONS.TASK_UPDATE), req);
    expect(error).toBeNull();
    expect(req.resource).toBe(task);
    expect(TaskModel.findOne).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      _id: TASK_ID
    });
  });
});
