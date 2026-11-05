const Task = require('./task.model');
const Comment = require('../comments/comment.model');
const Notification = require('../notifications/notification.model');
const Project = require('../projects/project.model');
const ProjectMember = require('../projects/project-member.model');
const OrganizationMember = require('../members/organization-member.model');
const AppError = require('../../utils/app-error');
const ActivityService = require('../activities/activity.service');
const NotificationService = require('../notifications/notification.service');
const withMongoTransaction = require('../../utils/mongo-transaction');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');

function escapeRegex(value) {
  const specialCharacters = '.^$*+?()[]{}|\\';
  return [...value].map((character) => specialCharacters.includes(character) ? `\\${character}` : character).join('');
}

function buildFilter(organizationId, projectId, options = {}) {
  const filter = organizationScopedFilter(organizationId, projectId ? { projectId } : {});
  for (const field of ['status', 'priority', 'assigneeId']) {
    if (options[field]) filter[field] = options[field];
  }
  if (options.parentTaskId !== undefined) filter.parentTaskId = options.parentTaskId;
  if (options.label) filter.labels = options.label;
  if (options.dueAfter || options.dueBefore) {
    filter.dueDate = {};
    if (options.dueAfter) filter.dueDate.$gte = options.dueAfter;
    if (options.dueBefore) filter.dueDate.$lte = options.dueBefore;
  }
  if (options.q) {
    const expression = new RegExp(escapeRegex(options.q), 'i');
    filter.$or = [{ title: expression }, { description: expression }];
  }
  return filter;
}

function createTaskService({
  TaskModel = Task,
  CommentModel = Comment,
  NotificationModel = Notification,
  ProjectModel = Project,
  ProjectMemberModel = ProjectMember,
  OrganizationMemberModel = OrganizationMember,
  ActivityService: activityLog = ActivityService,
  NotificationService: notifications = NotificationService,
  runInTransaction = withMongoTransaction,
  clock = () => new Date()
} = {}) {
  async function getTask(organizationId, projectId, taskId) {
    const task = await TaskModel.findOne(organizationScopedFilter(organizationId, { projectId, _id: taskId }));
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    return task;
  }

  async function validateParentTask(organizationId, projectId, parentTaskId, taskId) {
    if (!parentTaskId) return;
    if (taskId && String(parentTaskId) === String(taskId)) {
      throw new AppError('A task cannot be its own parent', 400, 'INVALID_TASK_PARENT');
    }
    let parent = await TaskModel.findOne(organizationScopedFilter(organizationId, { projectId, _id: parentTaskId }));
    if (!parent) throw new AppError('Parent task not found in this project', 404, 'TASK_PARENT_NOT_FOUND');
    const visited = new Set();
    while (parent) {
      const id = String(parent._id);
      if (taskId && id === String(taskId)) throw new AppError('Task parent relationship would create a cycle', 409, 'TASK_RELATIONSHIP_CYCLE');
      if (visited.has(id)) throw new AppError('Existing task parent relationship contains a cycle', 409, 'TASK_RELATIONSHIP_CYCLE');
      visited.add(id);
      if (!parent.parentTaskId) break;
      parent = await TaskModel.findOne(organizationScopedFilter(organizationId, {
        projectId,
        _id: parent.parentTaskId
      }));
      if (!parent) throw new AppError('Parent task not found in this project', 404, 'TASK_PARENT_NOT_FOUND');
    }
  }

  async function validateDependencies(organizationId, projectId, dependencies, taskId) {
    const visited = new Set();
    const pending = [...(dependencies || [])];
    while (pending.length) {
      const dependencyId = pending.pop();
      const dependencyKey = String(dependencyId);
      if (taskId && dependencyKey === String(taskId)) {
        throw new AppError('Task dependency relationship would create a cycle', 409, 'TASK_DEPENDENCY_CYCLE');
      }
      if (visited.has(dependencyKey)) continue;
      visited.add(dependencyKey);
      const dependency = await TaskModel.findOne(organizationScopedFilter(organizationId, {
        projectId,
        _id: dependencyId
      }));
      if (!dependency) throw new AppError('Task dependency not found in this project', 404, 'TASK_DEPENDENCY_NOT_FOUND');
      pending.push(...(dependency.dependencies || []));
    }
  }

  async function validateAssignee(organizationId, projectId, assigneeId) {
    if (!assigneeId) return;
    const member = await OrganizationMemberModel.findOne(organizationScopedFilter(organizationId, {
      userId: assigneeId,
      status: 'active'
    }));
    if (!member) throw new AppError('Assignee must be an active organization member', 404, 'TASK_ASSIGNEE_NOT_FOUND');

    const project = await ProjectModel.findOne(organizationScopedFilter(organizationId, { _id: projectId }));
    if (!project) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    if (project.visibility === 'private' && !['Owner', 'Admin', 'Manager'].includes(member.role)) {
      const projectMembership = await ProjectMemberModel.findOne(organizationScopedFilter(organizationId, {
        projectId,
        userId: assigneeId,
        status: 'active'
      }));
      if (!projectMembership) throw new AppError('Assignee must be a member of a private project', 404, 'TASK_ASSIGNEE_NOT_FOUND');
    }
  }

  async function create(organizationId, projectId, userId, fields) {
    if (fields.parentTaskId) await validateParentTask(organizationId, projectId, fields.parentTaskId);
    if (fields.dependencies?.length) await validateDependencies(organizationId, projectId, fields.dependencies);
    if (fields.assigneeId) await validateAssignee(organizationId, projectId, fields.assigneeId);

    return runInTransaction(async (session) => {
      const task = new TaskModel({
        ...fields,
        organizationId,
        projectId,
        createdBy: userId,
        updatedBy: userId
      });
      try {
        await task.save({ session });
      } catch (error) {
        if (error.code === 11000) throw new AppError('Task conflicts with an existing task', 409, 'TASK_CONFLICT');
        throw error;
      }
      await activityLog.record({
        organizationId,
        projectId,
        taskId: task._id,
        actorId: userId,
        action: 'task_created',
        targetType: 'task',
        targetId: task._id,
        metadata: { title: task.title }
      }, session);
      if (task.assigneeId && String(task.assigneeId) !== String(userId)) {
        await notifications.create({
          organizationId,
          recipientId: task.assigneeId,
          actorId: userId,
          category: 'task_assigned',
          title: 'A task was assigned to you',
          message: `You were assigned: ${task.title}`,
          projectId,
          taskId: task._id,
          sourceType: 'task',
          sourceId: task._id,
          link: `/api/v1/organizations/${organizationId}/projects/${projectId}/tasks/${task._id}`,
          metadata: { taskTitle: task.title }
        }, session);
      }
      return task;
    });
  }

  async function list(organizationId, projectId, options) {
    const { page, limit, sort, order } = options;
    const filter = buildFilter(organizationId, projectId, options);
    const direction = order === 'asc' ? 1 : -1;
    const sortField = sort === 'priority' ? 'priorityRank' : sort;
    const [tasks, total] = await Promise.all([
      TaskModel.find(filter).sort({ [sortField]: direction, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      TaskModel.countDocuments(filter)
    ]);
    return { tasks, pagination: paginationMetadata(page, limit, total) };
  }

  async function listMyTasks(organizationId, userId, organizationRole, options) {
    let projectIds;
    if (['Owner', 'Admin', 'Manager'].includes(organizationRole)) {
      const projects = await ProjectModel.find(organizationScopedFilter(organizationId)).select('_id').lean();
      projectIds = projects.map((project) => project._id);
    } else {
      const [organizationProjects, memberships] = await Promise.all([
        ProjectModel.find(organizationScopedFilter(organizationId, { visibility: 'organization' })).select('_id').lean(),
        ProjectMemberModel.find(organizationScopedFilter(organizationId, { userId, status: 'active' })).select('projectId').lean()
      ]);
      projectIds = [...new Set([
        ...organizationProjects.map((project) => String(project._id)),
        ...memberships.map((membership) => String(membership.projectId))
      ])];
    }
    const filter = buildFilter(organizationId, undefined, options);
    delete filter.projectId;
    filter.assigneeId = userId;
    filter.projectId = { $in: projectIds };
    const { page, limit, sort, order } = options;
    const direction = order === 'asc' ? 1 : -1;
    const sortField = sort === 'priority' ? 'priorityRank' : sort;
    const [tasks, total] = await Promise.all([
      TaskModel.find(filter).sort({ [sortField]: direction, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      TaskModel.countDocuments(filter)
    ]);
    return { tasks, pagination: paginationMetadata(page, limit, total) };
  }

  async function update(task, userId, changes) {
    if (Object.hasOwn(changes, 'parentTaskId')) {
      await validateParentTask(task.organizationId, task.projectId, changes.parentTaskId, task._id);
    }
    if (Object.hasOwn(changes, 'dependencies')) {
      await validateDependencies(task.organizationId, task.projectId, changes.dependencies, task._id);
    }
    return runInTransaction(async (session) => {
      for (const field of ['title', 'description', 'status', 'priority', 'dueDate', 'labels', 'parentTaskId', 'dependencies']) {
        if (Object.hasOwn(changes, field)) task[field] = changes[field];
      }
      if (Object.hasOwn(changes, 'status')) task.completedAt = changes.status === 'done' ? (task.completedAt || clock()) : null;
      task.updatedBy = userId;
      await task.save({ session });
      const action = Object.hasOwn(changes, 'status') ? 'task_status_changed' : 'task_updated';
      await activityLog.record({
        organizationId: task.organizationId,
        projectId: task.projectId,
        taskId: task._id,
        actorId: userId,
        action,
        targetType: 'task',
        targetId: task._id,
        metadata: { changedFields: Object.keys(changes) }
      }, session);
      return task;
    });
  }

  async function updateStatus(task, userId, status) {
    return runInTransaction(async (session) => {
      const previousStatus = task.status;
      task.status = status;
      task.completedAt = status === 'done' ? (task.completedAt || clock()) : null;
      task.updatedBy = userId;
      await task.save({ session });
      await activityLog.record({
        organizationId: task.organizationId,
        projectId: task.projectId,
        taskId: task._id,
        actorId: userId,
        action: 'task_status_changed',
        targetType: 'task',
        targetId: task._id,
        metadata: { previousStatus, status }
      }, session);
      return task;
    });
  }

  async function assign(task, userId, assigneeId) {
    await validateAssignee(task.organizationId, task.projectId, assigneeId);
    return runInTransaction(async (session) => {
      const previousAssigneeId = task.assigneeId;
      task.assigneeId = assigneeId || null;
      task.updatedBy = userId;
      await task.save({ session });
      await activityLog.record({
        organizationId: task.organizationId,
        projectId: task.projectId,
        taskId: task._id,
        actorId: userId,
        action: 'task_assigned',
        targetType: 'task',
        targetId: task._id,
        metadata: { previousAssigneeId, assigneeId: task.assigneeId }
      }, session);
      if (task.assigneeId && String(task.assigneeId) !== String(userId)) {
        await notifications.create({
          organizationId: task.organizationId,
          recipientId: task.assigneeId,
          actorId: userId,
          category: 'task_assigned',
          title: 'A task was assigned to you',
          message: `You were assigned: ${task.title}`,
          projectId: task.projectId,
          taskId: task._id,
          sourceType: 'task',
          sourceId: task._id,
          link: `/api/v1/organizations/${task.organizationId}/projects/${task.projectId}/tasks/${task._id}`,
          metadata: { taskTitle: task.title }
        }, session);
      }
      return task;
    });
  }

  async function remove(task, actorId) {
    await runInTransaction(async (session) => {
      const scope = organizationScopedFilter(task.organizationId, { projectId: task.projectId });
      await TaskModel.updateMany(
        { ...scope, parentTaskId: task._id },
        { $set: { parentTaskId: null, updatedBy: actorId } },
        { session }
      );
      await TaskModel.updateMany(
        { ...scope, dependencies: task._id },
        { $pull: { dependencies: task._id }, $set: { updatedBy: actorId } },
        { session }
      );
      await CommentModel.deleteMany(organizationScopedFilter(task.organizationId, {
        projectId: task.projectId,
        taskId: task._id
      }), { session });
      await NotificationModel.deleteMany(organizationScopedFilter(task.organizationId, {
        projectId: task.projectId,
        taskId: task._id
      }), { session });
      await activityLog.record({
        organizationId: task.organizationId,
        projectId: task.projectId,
        taskId: task._id,
        actorId,
        action: 'task_deleted',
        targetType: 'task',
        targetId: task._id,
        metadata: { title: task.title }
      }, session);
      await TaskModel.deleteOne({ ...scope, _id: task._id }, { session });
    });
  }

  async function listSubtasks(organizationId, projectId, parentTaskId, options) {
    return list(organizationId, projectId, { ...options, parentTaskId });
  }

  return { getTask, create, list, listMyTasks, listSubtasks, update, updateStatus, assign, remove, validateParentTask, validateDependencies };
}

module.exports = createTaskService();
module.exports.createTaskService = createTaskService;
module.exports.buildFilter = buildFilter;
module.exports.escapeRegex = escapeRegex;
