const { createTaskService } = require('../../src/modules/tasks/task.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const USER_ID = 'cccccccccccccccccccccccc';
const OTHER_USER_ID = 'dddddddddddddddddddddddd';
const TASK_ONE_ID = '111111111111111111111111';
const TASK_TWO_ID = '222222222222222222222222';

function query(value) {
  const promise = Promise.resolve(value);
  promise.value = value;
  promise.select = () => promise;
  promise.sort = () => promise;
  promise.skip = () => promise;
  promise.limit = () => promise;
  promise.lean = () => promise;
  return promise;
}

function transaction(work) {
  return work({ id: 'task-session' });
}

function createMemoryModels({ projectVisibility = 'organization', organizationRole = 'Member', projectMember = null } = {}) {
  const tasks = [];
  let generatedId = 0;
  class TaskModel {
    constructor(data) { Object.assign(this, data); this._id = `task-${++generatedId}`; }
    async save() {
      if (!tasks.includes(this)) tasks.push(this);
      return this;
    }
    static findOne(filter) {
      return query(tasks.find((task) => Object.entries(filter).every(([key, value]) => {
        if (value && typeof value === 'object' && value.$in) return value.$in.some((id) => String(id) === String(task[key]));
        return String(task[key] ?? '') === String(value ?? '');
      })) || null);
    }
    static find(filter) {
      const results = tasks.filter((task) => Object.entries(filter).every(([key, value]) => {
        if (key === '$or') return value.some((part) => Object.entries(part).some(([field, condition]) => {
          if (field === '_id' && condition.$in) return condition.$in.some((id) => String(id) === String(task._id));
          if (condition instanceof RegExp) return condition.test(task[field] || '');
          return task[field] === condition;
        }));
        if (value && typeof value === 'object' && value.$in) return value.$in.some((id) => String(id) === String(task[key]));
        if (value && typeof value === 'object' && ('$gte' in value || '$lte' in value)) return true;
        if (Array.isArray(task[key])) return task[key].includes(value);
        return String(task[key] ?? '') === String(value ?? '');
      }));
      return query(results);
    }
    static countDocuments(filter) { return Promise.resolve(TaskModel.find(filter).value.length); }
    static updateMany(filter, update) {
      let modifiedCount = 0;
      for (const task of tasks) {
        const matched = Object.entries(filter).every(([key, value]) => {
          if (key === 'dependencies') return task.dependencies?.some((id) => String(id) === String(value));
          return String(task[key] ?? '') === String(value ?? '');
        });
        if (!matched) continue;
        if (update.$set) Object.assign(task, update.$set);
        if (update.$pull?.dependencies) task.dependencies = task.dependencies.filter((id) => String(id) !== String(update.$pull.dependencies));
        modifiedCount += 1;
      }
      return Promise.resolve({ modifiedCount });
    }
    static deleteOne(filter) {
      const index = tasks.findIndex((task) => task.organizationId === filter.organizationId && task.projectId === filter.projectId && String(task._id) === String(filter._id));
      if (index >= 0) tasks.splice(index, 1);
      return Promise.resolve({ deletedCount: index >= 0 ? 1 : 0 });
    }
  }

  const ProjectModel = {
    findOne: jest.fn().mockResolvedValue({ visibility: projectVisibility }),
    find: jest.fn().mockImplementation((filter) => query(filter.visibility
      ? [{ _id: PROJECT_ID }]
      : [{ _id: PROJECT_ID }, { _id: 'eeeeeeeeeeeeeeeeeeeeeeee' }]))
  };
  const ProjectMemberModel = {
    findOne: jest.fn().mockResolvedValue(projectMember),
    find: jest.fn().mockImplementation(() => query([{ projectId: 'ffffffffffffffffffffffff' }]))
  };
  const OrganizationMemberModel = {
    findOne: jest.fn().mockResolvedValue({ status: 'active', role: organizationRole })
  };
  const ActivityService = { record: jest.fn().mockResolvedValue({}) };
  const NotificationService = { create: jest.fn().mockResolvedValue({}) };
  const CommentModel = { deleteMany: jest.fn() };
  const NotificationModel = { deleteMany: jest.fn() };
  const runInTransaction = jest.fn(transaction);
  return {
    tasks, TaskModel, ProjectModel, ProjectMemberModel, OrganizationMemberModel,
    ActivityService, NotificationService, CommentModel, NotificationModel, runInTransaction
  };
}

describe('Task service', () => {
  test('creates project-scoped tasks with actor attribution and defaults', async () => {
    const models = createMemoryModels();
    const service = createTaskService(models);
    const task = await service.create(ORG_ID, PROJECT_ID, USER_ID, {
      title: 'Prepare release', labels: ['release'], priority: 'high'
    });
    expect(task).toMatchObject({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      title: 'Prepare release',
      createdBy: USER_ID,
      updatedBy: USER_ID,
      labels: ['release'],
      priority: 'high'
    });
    expect(models.ActivityService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task_created', targetId: task._id, actorId: USER_ID
    }), { id: 'task-session' });
  });

  test('notifies a different assignee when a task is created already assigned', async () => {
    const models = createMemoryModels();
    const service = createTaskService(models);
    const task = await service.create(ORG_ID, PROJECT_ID, USER_ID, {
      title: 'Review release', assigneeId: OTHER_USER_ID
    });
    expect(models.NotificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: ORG_ID,
      recipientId: OTHER_USER_ID,
      actorId: USER_ID,
      category: 'task_assigned',
      taskId: task._id
    }), { id: 'task-session' });
  });

  test('validates parent tasks and same-project dependencies and rejects relationship cycles', async () => {
    const models = createMemoryModels();
    const parent = { _id: TASK_ONE_ID, organizationId: ORG_ID, projectId: PROJECT_ID, parentTaskId: TASK_TWO_ID, dependencies: [TASK_TWO_ID] };
    const taskToUpdate = { _id: TASK_TWO_ID, organizationId: ORG_ID, projectId: PROJECT_ID, parentTaskId: null, dependencies: [] };
    models.tasks.push(parent, taskToUpdate);
    const service = createTaskService(models);

    await expect(service.validateParentTask(ORG_ID, PROJECT_ID, TASK_ONE_ID, TASK_TWO_ID))
      .rejects.toMatchObject({ code: 'TASK_RELATIONSHIP_CYCLE' });
    await expect(service.validateDependencies(ORG_ID, PROJECT_ID, [TASK_ONE_ID], TASK_TWO_ID))
      .rejects.toMatchObject({ code: 'TASK_DEPENDENCY_CYCLE' });
    await expect(service.validateDependencies(ORG_ID, 'other-project', [TASK_ONE_ID]))
      .rejects.toMatchObject({ code: 'TASK_DEPENDENCY_NOT_FOUND' });
  });

  test('assignment requires an active organization member and project membership for private projects', async () => {
    const models = createMemoryModels({ projectVisibility: 'private', projectMember: null });
    const service = createTaskService(models);
    const task = { organizationId: ORG_ID, projectId: PROJECT_ID, assigneeId: null, save: jest.fn() };
    await expect(service.assign(task, USER_ID, OTHER_USER_ID)).rejects.toMatchObject({ code: 'TASK_ASSIGNEE_NOT_FOUND' });

    models.ProjectMemberModel.findOne.mockResolvedValue({ status: 'active', role: 'Viewer' });
    await service.assign(task, USER_ID, OTHER_USER_ID);
    expect(task.assigneeId).toBe(OTHER_USER_ID);
    expect(task.updatedBy).toBe(USER_ID);
    expect(models.NotificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      category: 'task_assigned', recipientId: OTHER_USER_ID, taskId: task._id
    }), { id: 'task-session' });
    expect(models.OrganizationMemberModel.findOne).toHaveBeenCalledWith({
      organizationId: ORG_ID, userId: OTHER_USER_ID, status: 'active'
    });
  });

  test('filters tenant tasks and paginates; My Tasks includes only currently accessible projects', async () => {
    const models = createMemoryModels();
    models.tasks.push({
      _id: TASK_ONE_ID, organizationId: ORG_ID, projectId: PROJECT_ID,
      title: 'Release [plan]', description: '', assigneeId: USER_ID,
      status: 'todo', priority: 'medium', labels: ['release'], parentTaskId: null
    });
    const taskFind = jest.spyOn(models.TaskModel, 'find');
    const service = createTaskService(models);
    const options = {
      page: 1, limit: 10, q: '[plan]', status: 'todo', priority: undefined, assigneeId: undefined,
      parentTaskId: undefined, label: 'release', dueAfter: undefined, dueBefore: undefined,
      sort: 'updatedAt', order: 'desc'
    };
    const listed = await service.list(ORG_ID, PROJECT_ID, options);
    expect(listed.tasks).toHaveLength(1);
    expect(listed.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    const queryFilter = taskFind.mock.calls[0][0];
    expect(queryFilter).toMatchObject({ organizationId: ORG_ID, projectId: PROJECT_ID, status: 'todo', labels: 'release' });
    expect(queryFilter.$or[0].title.test('Release [plan]')).toBe(true);
    expect(queryFilter.$or[0].title.test('Release plan')).toBe(false);

    await service.listMyTasks(ORG_ID, USER_ID, 'Member', options);
    const myTaskFilter = taskFind.mock.calls[2][0];
    expect(myTaskFilter).toMatchObject({ organizationId: ORG_ID, assigneeId: USER_ID });
    expect(myTaskFilter.projectId.$in).toEqual(expect.arrayContaining([PROJECT_ID, 'ffffffffffffffffffffffff']));
  });

  test('updates task workflow timestamps and removes task relationship references atomically', async () => {
    const models = createMemoryModels();
    const child = { _id: TASK_TWO_ID, organizationId: ORG_ID, projectId: PROJECT_ID, parentTaskId: TASK_ONE_ID, dependencies: [TASK_ONE_ID] };
    models.tasks.push(child);
    const runInTransaction = jest.fn(transaction);
    const service = createTaskService({ ...models, runInTransaction, clock: () => new Date('2026-11-05T00:00:00Z') });
    const task = { _id: TASK_ONE_ID, organizationId: ORG_ID, projectId: PROJECT_ID, status: 'todo', completedAt: null, save: jest.fn() };

    await service.updateStatus(task, USER_ID, 'done');
    expect(task.completedAt).toEqual(new Date('2026-11-05T00:00:00Z'));
    await service.updateStatus(task, USER_ID, 'in_progress');
    expect(task.completedAt).toBeNull();

    await service.remove(task, USER_ID);
    expect(runInTransaction).toHaveBeenCalledTimes(3);
    expect(models.CommentModel.deleteMany).toHaveBeenCalledWith(
      { organizationId: ORG_ID, projectId: PROJECT_ID, taskId: TASK_ONE_ID },
      { session: { id: 'task-session' } }
    );
    expect(models.NotificationModel.deleteMany).toHaveBeenCalledWith(
      { organizationId: ORG_ID, projectId: PROJECT_ID, taskId: TASK_ONE_ID },
      { session: { id: 'task-session' } }
    );
    expect(child).toMatchObject({ parentTaskId: null, dependencies: [], updatedBy: USER_ID });
  });
});
