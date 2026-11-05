const Activity = require('./activity.model');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');

function createActivityService({ ActivityModel = Activity } = {}) {
  async function record({ organizationId, projectId, taskId, actorId, action, targetType, targetId, metadata = {} }, session) {
    const activity = new ActivityModel({
      organizationId,
      projectId,
      taskId: taskId || null,
      actorId,
      action,
      targetType,
      targetId,
      metadata
    });
    await activity.save(session ? { session } : undefined);
    return activity;
  }

  async function list(organizationId, projectId, { page, limit, taskId }) {
    const filter = organizationScopedFilter(organizationId, { projectId });
    if (taskId) filter.taskId = taskId;
    const [activities, total] = await Promise.all([
      ActivityModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityModel.countDocuments(filter)
    ]);
    return { activities, pagination: paginationMetadata(page, limit, total) };
  }

  return { record, list };
}

module.exports = createActivityService();
module.exports.createActivityService = createActivityService;
