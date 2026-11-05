const mongoose = require('mongoose');
const { ACTIONS, TARGET_TYPES } = require('./activity.constants');

const activitySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ACTIONS, required: true },
  targetType: { type: String, enum: TARGET_TYPES, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });

activitySchema.index({ organizationId: 1, createdAt: -1, _id: -1 }, { name: 'organization_activity_timeline' });
activitySchema.index({ organizationId: 1, projectId: 1, createdAt: -1, _id: -1 }, { name: 'project_activity_timeline' });
activitySchema.index({ organizationId: 1, projectId: 1, taskId: 1, createdAt: -1 }, { name: 'task_activity_timeline' });
activitySchema.index({ organizationId: 1, actorId: 1, createdAt: -1 }, { name: 'activity_actor_timeline' });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
