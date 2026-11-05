const { createNotificationService } = require('../../src/modules/notifications/notification.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const OTHER_USER_ID = 'cccccccccccccccccccccccc';
const NOTIFICATION_ID = 'dddddddddddddddddddddddd';

function query(value) {
  const promise = Promise.resolve(value);
  promise.sort = () => promise;
  promise.skip = () => promise;
  promise.limit = () => promise;
  promise.lean = () => promise;
  return promise;
}

function makeModel() {
  const records = [];
  class NotificationModel {
    constructor(data) { Object.assign(this, data); this._id = NOTIFICATION_ID; this.readAt ??= null; }
    async save() { records.push(this); return this; }
    static find(filter) {
      return query(records.filter((item) => Object.entries(filter).every(([key, value]) => item[key] === value)));
    }
    static countDocuments(filter) {
      return Promise.resolve(records.filter((item) => Object.entries(filter).every(([key, value]) => item[key] === value)).length);
    }
    static findOne(filter) {
      return query(records.find((item) => Object.entries(filter).every(([key, value]) => item[key] === value)) || null);
    }
    static findOneAndUpdate(filter, update) {
      const record = records.find((item) => Object.entries(filter).every(([key, value]) => item[key] === value)) || null;
      if (record) Object.assign(record, update.$set);
      return Promise.resolve(record);
    }
    static updateMany(filter, update) {
      let modifiedCount = 0;
      for (const item of records) {
        if (Object.entries(filter).every(([key, value]) => item[key] === value)) {
          Object.assign(item, update.$set);
          modifiedCount += 1;
        }
      }
      return Promise.resolve({ modifiedCount });
    }
    static updateOne(filter, update, options) {
      const found = records.find((item) => item.dedupeKey === filter.dedupeKey);
      if (found) return Promise.resolve({ upsertedCount: 0 });
      if (options.upsert) records.push({ ...update.$setOnInsert, _id: `notification-${records.length + 1}`, readAt: null });
      return Promise.resolve({ upsertedCount: options.upsert ? 1 : 0 });
    }
  }
  return { NotificationModel, records };
}

describe('Notification service', () => {
  test('lists recipient-scoped notifications with category and unread filters', async () => {
    const { NotificationModel, records } = makeModel();
    records.push({ organizationId: ORG_ID, recipientId: USER_ID, category: 'mention', readAt: null });
    records.push({ organizationId: ORG_ID, recipientId: OTHER_USER_ID, category: 'mention', readAt: null });
    const service = createNotificationService({ NotificationModel });
    const result = await service.list(ORG_ID, USER_ID, { page: 1, limit: 10, category: 'mention', unreadOnly: true });
    expect(result.notifications).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(await service.unreadCount(ORG_ID, USER_ID)).toBe(1);
  });

  test('marks only the authenticated recipient notifications as read idempotently', async () => {
    const { NotificationModel, records } = makeModel();
    records.push({ _id: NOTIFICATION_ID, organizationId: ORG_ID, recipientId: USER_ID, readAt: null });
    const service = createNotificationService({ NotificationModel, clock: () => new Date('2026-11-05T00:00:00Z') });
    const marked = await service.markRead(ORG_ID, USER_ID, NOTIFICATION_ID);
    expect(marked.readAt).toEqual(new Date('2026-11-05T00:00:00Z'));
    expect(await service.markRead(ORG_ID, USER_ID, NOTIFICATION_ID)).toBe(marked);
    await expect(service.markRead(ORG_ID, OTHER_USER_ID, NOTIFICATION_ID)).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
  });

  test('marks all unread notifications and deduplicates scheduled reminders', async () => {
    const { NotificationModel, records } = makeModel();
    records.push({ organizationId: ORG_ID, recipientId: USER_ID, readAt: null });
    const service = createNotificationService({ NotificationModel, clock: () => new Date('2026-11-05T00:00:00Z') });
    expect(await service.markAllRead(ORG_ID, USER_ID)).toEqual({ modifiedCount: 1 });
    const fields = { organizationId: ORG_ID, recipientId: USER_ID, category: 'task_due_soon', title: 'Due soon', message: 'Task', dedupeKey: 'deadline:task-1' };
    expect((await service.createIdempotent(fields)).created).toBe(true);
    expect((await service.createIdempotent(fields)).created).toBe(false);
    expect(records).toHaveLength(2);
  });
});
