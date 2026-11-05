const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 10000, default: '' },
  status: { type: String, enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'], default: 'todo' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  priorityRank: { type: Number, select: false },
  dueDate: { type: Date, default: null },
  labels: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  dependencies: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }], default: [] },
  completedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true,
  toJSON: { transform: (_document, output) => { delete output.priorityRank; return output; } },
  toObject: { transform: (_document, output) => { delete output.priorityRank; return output; } }
});

taskSchema.index({ organizationId: 1, projectId: 1, status: 1, updatedAt: -1 }, { name: 'tasks_project_status_recent' });
taskSchema.index({ organizationId: 1, projectId: 1, priorityRank: -1, updatedAt: -1 }, { name: 'tasks_project_priority_recent' });
taskSchema.index({ organizationId: 1, projectId: 1, dueDate: 1 }, { name: 'tasks_project_due_date' });
taskSchema.index({ dueDate: 1, assigneeId: 1, status: 1 }, { name: 'tasks_deadline_reminders' });
taskSchema.index({ organizationId: 1, projectId: 1, assigneeId: 1, status: 1 }, { name: 'tasks_project_assignee_status' });
taskSchema.index({ organizationId: 1, projectId: 1, parentTaskId: 1 }, { name: 'tasks_project_parent' });
taskSchema.index({ organizationId: 1, projectId: 1, labels: 1 }, { name: 'tasks_project_labels' });
taskSchema.index({ organizationId: 1, projectId: 1, dependencies: 1 }, { name: 'tasks_project_dependencies' });

taskSchema.pre('validate', function setPriorityRank() {
  this.priorityRank = { low: 1, medium: 2, high: 3, urgent: 4 }[this.priority] || 2;
});

taskSchema.path('labels').validate((labels) => new Set(labels).size === labels.length, 'Task labels must be unique');
taskSchema.path('dependencies').validate((dependencies) => new Set(dependencies.map(String)).size === dependencies.length, 'Task dependencies must be unique');
taskSchema.pre('validate', function validateTaskRelations() {
  if (this._id && this.parentTaskId && String(this._id) === String(this.parentTaskId)) {
    this.invalidate('parentTaskId', 'A task cannot be its own parent');
  }
  if (this._id && this.dependencies.some((dependencyId) => String(this._id) === String(dependencyId))) {
    this.invalidate('dependencies', 'A task cannot depend on itself');
  }
});

taskSchema.pre('save', function trackCompletion() {
  if (this.isModified('status')) {
    this.completedAt = this.status === 'done' ? (this.completedAt || new Date()) : null;
  }
});

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
