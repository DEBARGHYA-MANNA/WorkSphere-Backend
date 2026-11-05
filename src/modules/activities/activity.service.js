const mongoose = require('mongoose');
const Activity = require('./activity.model');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');

function createActivityService({ ActivityModel = Activity } = {}) {
  async function record({ organizationId, projectId = null, taskId = null, actorId, action, targetType, targetId, metadata = {} }, session) {
    const activity = new ActivityModel({
      organizationId,
      projectId,
      taskId,
      actorId,
      action,
      targetType,
      targetId,
      metadata
    });
    await activity.save(session ? { session } : undefined);
    return activity;
  }

  function buildFilter(organizationId, options = {}) {
    const filter = organizationScopedFilter(organizationId);
    for (const field of ['projectId', 'taskId', 'actorId', 'action', 'targetType']) {
      if (options[field]) filter[field] = options[field];
    }
    if (options.from || options.to) {
      const createdAt = {};
      if (options.from) createdAt.$gte = options.from;
      if (options.to) createdAt.$lte = options.to;
      filter.createdAt = mongoose.trusted(createdAt);
    }
    return filter;
  }

  async function list(organizationId, projectId, options) {
    return listScoped(organizationId, { ...options, projectId });
  }

  async function listOrganization(organizationId, options) {
    return listScoped(organizationId, options);
  }

  async function listScoped(organizationId, options) {
    const { page, limit } = options;
    const filter = buildFilter(organizationId, options);
    const [activities, total] = await Promise.all([
      ActivityModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityModel.countDocuments(filter)
    ]);
    return { activities, pagination: paginationMetadata(page, limit, total) };
  }

  return { record, list, listOrganization, buildFilter };
}

module.exports = createActivityService();
module.exports.createActivityService = createActivityService;
