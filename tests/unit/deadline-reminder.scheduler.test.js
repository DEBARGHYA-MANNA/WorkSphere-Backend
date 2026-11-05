const {
  createDeadlineReminderRunner,
  startDeadlineReminderScheduler,
  stopDeadlineReminderScheduler
} = require('../../src/modules/notifications/deadline-reminder.scheduler');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ARCHIVED_PROJECT_ID = 'cccccccccccccccccccccccc';
const USER_ID = 'dddddddddddddddddddddddd';
const NOW = new Date('2026-11-05T12:00:00Z');

function query(value) {
  const promise = Promise.resolve(value);
  promise.select = () => promise;
  promise.lean = () => promise;
  return promise;
}

describe('Deadline reminder scheduler', () => {
  test('creates idempotent upcoming and overdue reminders and skips archived projects', async () => {
    const TaskModel = {
      find: jest.fn().mockReturnValue(query([
        { _id: 'task-soon', organizationId: ORG_ID, projectId: PROJECT_ID, assigneeId: USER_ID, title: 'Soon', dueDate: new Date('2026-11-05T14:00:00Z') },
        { _id: 'task-late', organizationId: ORG_ID, projectId: PROJECT_ID, assigneeId: USER_ID, title: 'Late', dueDate: new Date('2026-11-05T11:00:00Z') },
        { _id: 'task-archived', organizationId: ORG_ID, projectId: ARCHIVED_PROJECT_ID, assigneeId: USER_ID, title: 'Archived', dueDate: new Date('2026-11-05T13:00:00Z') }
      ]))
    };
    const ProjectModel = {
      find: jest.fn().mockReturnValue(query([{ _id: PROJECT_ID }]))
    };
    const NotificationService = { createIdempotent: jest.fn().mockResolvedValue({ created: true }) };
    const runner = createDeadlineReminderRunner({ TaskModel, ProjectModel, NotificationService, clock: () => NOW });

    expect(await runner()).toEqual({ checked: 3, created: 2 });
    expect(NotificationService.createIdempotent).toHaveBeenCalledTimes(2);
    expect(NotificationService.createIdempotent).toHaveBeenCalledWith(expect.objectContaining({
      category: 'task_due_soon', recipientId: USER_ID, taskId: 'task-soon'
    }));
    expect(NotificationService.createIdempotent).toHaveBeenCalledWith(expect.objectContaining({
      category: 'task_overdue', recipientId: USER_ID, taskId: 'task-late'
    }));
    expect(TaskModel.find).toHaveBeenCalledWith(expect.objectContaining({
      status: expect.objectContaining({ $nin: ['done', 'cancelled'] }),
      assigneeId: expect.objectContaining({ $ne: null }),
      dueDate: expect.objectContaining({ $ne: null, $lte: expect.any(Date) })
    }));
  });

  test('scheduler avoids overlapping scans and drains its active scan when stopped', async () => {
    jest.useFakeTimers();
    let finishRun;
    const runner = jest.fn().mockImplementation(() => new Promise((resolve) => { finishRun = resolve; }));
    const timer = startDeadlineReminderScheduler({ intervalMs: 1000, runner });
    await Promise.resolve();
    expect(runner).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(3000);
    expect(runner).toHaveBeenCalledTimes(1);
    const stopped = stopDeadlineReminderScheduler(timer);
    finishRun({ checked: 0, created: 0 });
    await stopped;
    jest.advanceTimersByTime(3000);
    expect(runner).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
