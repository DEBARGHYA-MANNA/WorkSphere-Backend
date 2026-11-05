const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 10000 },
  mentions: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

commentSchema.index({ organizationId: 1, projectId: 1, taskId: 1, deletedAt: 1, createdAt: 1 }, { name: 'comments_task_timeline' });
commentSchema.index({ organizationId: 1, authorId: 1, createdAt: -1 }, { name: 'comments_author_recent' });
commentSchema.index({ organizationId: 1, mentions: 1, createdAt: -1 }, { name: 'comments_mentions_recent' });

module.exports = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
