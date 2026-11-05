const mongoose = require('mongoose');
const Task = require('../tasks/task.model');
const Project = require('../projects/project.model');
const notificationService = require('./notification.service');
const logger = require('../../logger');

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

function createDeadlineReminderRunner({
  TaskModel = Task,
  ProjectModel = Project,
  NotificationService = notificationService,
  clock = () => new Date(),
  reminderWindowMs = REMINDER_WINDOW_MS
} = {}) {
  return async function runDeadlineReminders() {
    const now = clock();
    const reminderCutoff = new Date(now.getTime() + reminderWindowMs);
    const tasks = await TaskModel.find({
      status: mongoose.trusted({ $nin: ['done', 'cancelled'] }),
      assigneeId: mongoose.trusted({ $ne: null }),
      dueDate: mongoose.trusted({ $ne: null, $lte: reminderCutoff })
    }).select('_id organizationId projectId assigneeId title dueDate').lean();
    if (!tasks.length) return { checked: 0, created: 0 };

    const projects = await ProjectModel.find({
      organizationId: mongoose.trusted({ $in: [...new Set(tasks.map((task) => String(task.organizationId)))] }),
      _id: mongoose.trusted({ $in: [...new Set(tasks.map((task) => String(task.projectId)))] }),
      archivedAt: null
    }).select('_id').lean();
    const activeProjectIds = new Set(projects.map((project) => String(project._id)));
    let created = 0;
    for (const task of tasks) {
      if (!activeProjectIds.has(String(task.projectId))) continue;
      const dueDate = new Date(task.dueDate);
      const overdue = dueDate <= now;
      const category = overdue ? 'task_overdue' : 'task_due_soon';
      const key = `deadline:${category}:${task._id}:${task.assigneeId}:${dueDate.toISOString()}`;
      const result = await NotificationService.createIdempotent({
        organizationId: task.organizationId,
        recipientId: task.assigneeId,
        actorId: null,
        category,
        title: overdue ? 'Task is overdue' : 'Task due soon',
        message: overdue
          ? `The due date has passed for: ${task.title}`
          : `A task is due within 24 hours: ${task.title}`,
        projectId: task.projectId,
        taskId: task._id,
        sourceType: 'task',
        sourceId: task._id,
        link: `/api/v1/organizations/${task.organizationId}/projects/${task.projectId}/tasks/${task._id}`,
        metadata: { taskTitle: task.title, dueDate },
        dedupeKey: key
      });
      if (result.created) created += 1;
    }
    return { checked: tasks.length, created };
  };
}

function startDeadlineReminderScheduler({ intervalMs = DEFAULT_INTERVAL_MS, runner = createDeadlineReminderRunner() } = {}) {
  const runSafely = () => runner().catch((error) => {
    logger.error(`Deadline reminder scan failed: ${error.message}`, { stack: error.stack });
  });
  const timer = setInterval(runSafely, intervalMs);
  timer.unref?.();
  runSafely();
  return timer;
}

function stopDeadlineReminderScheduler(timer) {
  if (timer) clearInterval(timer);
}

module.exports = {
  createDeadlineReminderRunner,
  startDeadlineReminderScheduler,
  stopDeadlineReminderScheduler,
  REMINDER_WINDOW_MS,
  DEFAULT_INTERVAL_MS
};
