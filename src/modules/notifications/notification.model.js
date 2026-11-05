const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  category: {
    type: String,
    enum: ['mention', 'task_assigned', 'comment', 'task_due_soon', 'task_overdue', 'system'],
    required: true
  },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  sourceType: { type: String, enum: ['task', 'comment', null], default: null },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  link: { type: String, trim: true, maxlength: 500, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  dedupeKey: { type: String, maxlength: 300 },
  readAt: { type: Date, default: null }
}, { timestamps: true });

notificationSchema.index({ organizationId: 1, recipientId: 1, readAt: 1, createdAt: -1 }, { name: 'user_notifications_unread_recent' });
notificationSchema.index({ organizationId: 1, recipientId: 1, category: 1, createdAt: -1 }, { name: 'user_notifications_category_recent' });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true, name: 'notification_dedupe' });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
