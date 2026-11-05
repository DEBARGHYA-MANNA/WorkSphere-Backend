const { createActivityService } = require('../../src/modules/activities/activity.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TASK_ID = 'cccccccccccccccccccccccc';
const ACTOR_ID = 'dddddddddddddddddddddddd';

function query(value) {
  const promise = Promise.resolve(value);
  promise.sort = () => promise;
  promise.skip = () => promise;
  promise.limit = () => promise;
  promise.lean = () => promise;
  return promise;
}

function model() {
  const entries = [];
  class ActivityModel {
    constructor(data) { Object.assign(this, data); this._id = `activity-${entries.length + 1}`; }
    async save(options) { this.session = options?.session; entries.push(this); return this; }
    static find(filter) { return query(entries.filter((entry) => Object.entries(filter).every(([key, value]) => entry[key] === value))); }
    static countDocuments(filter) { return Promise.resolve(entries.filter((entry) => Object.entries(filter).every(([key, value]) => entry[key] === value)).length); }
  }
  return { ActivityModel, entries };
}

describe('Activity service', () => {
  test('records immutable task/comment events with transaction sessions', async () => {
    const { ActivityModel, entries } = model();
    const service = createActivityService({ ActivityModel });
    const activity = await service.record({
      organizationId: ORG_ID, projectId: PROJECT_ID, taskId: TASK_ID, actorId: ACTOR_ID,
      action: 'comment_created', targetType: 'comment', targetId: 'eeeeeeeeeeeeeeeeeeeeeeee', metadata: { mentionCount: 1 }
    }, { id: 'activity-session' });
    expect(activity).toMatchObject({ organizationId: ORG_ID, projectId: PROJECT_ID, actorId: ACTOR_ID, action: 'comment_created' });
    expect(activity.session).toEqual({ id: 'activity-session' });
    expect(entries).toHaveLength(1);
  });

  test('retrieves tenant-scoped organization history with action and date filters', async () => {
    const { ActivityModel, entries } = model();
    entries.push({ organizationId: ORG_ID, projectId: PROJECT_ID, action: 'member_role_changed', targetType: 'organization_member' });
    entries.push({ organizationId: 'other-org', projectId: PROJECT_ID, action: 'member_role_changed', targetType: 'organization_member' });
    const service = createActivityService({ ActivityModel });
    const result = await service.listOrganization(ORG_ID, { page: 1, limit: 10, action: 'member_role_changed' });
    expect(result.activities).toEqual([entries[0]]);
    expect(result.pagination.total).toBe(1);
    const filter = service.buildFilter(ORG_ID, { from: new Date('2026-01-01'), to: new Date('2026-12-31') });
    expect(filter).toMatchObject({ organizationId: ORG_ID, createdAt: { $gte: new Date('2026-01-01'), $lte: new Date('2026-12-31') } });
  });

  test('lists activity only for the requested organization/project and optional task', async () => {
    const { ActivityModel, entries } = model();
    entries.push({ organizationId: ORG_ID, projectId: PROJECT_ID, taskId: TASK_ID, action: 'task_created' });
    entries.push({ organizationId: ORG_ID, projectId: 'other-project', taskId: TASK_ID, action: 'task_deleted' });
    const service = createActivityService({ ActivityModel });
    const result = await service.list(ORG_ID, PROJECT_ID, { page: 1, limit: 10, taskId: TASK_ID });
    expect(result.activities).toEqual([entries[0]]);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });
});
