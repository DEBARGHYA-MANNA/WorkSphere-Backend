const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: [
      'task_created', 'task_updated', 'task_status_changed', 'task_assigned', 'task_deleted',
      'comment_created', 'comment_updated', 'comment_deleted'
    ],
    required: true
  },
  targetType: { type: String, enum: ['task', 'comment'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });

activitySchema.index({ organizationId: 1, projectId: 1, createdAt: -1 }, { name: 'project_activity_timeline' });
activitySchema.index({ organizationId: 1, projectId: 1, taskId: 1, createdAt: -1 }, { name: 'task_activity_timeline' });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
