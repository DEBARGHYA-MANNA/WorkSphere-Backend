const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  status: { type: String, enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'], default: 'planning' },
  visibility: { type: String, enum: ['organization', 'private'], default: 'organization' },
  startDate: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

projectSchema.index({ organizationId: 1, archivedAt: 1, updatedAt: -1 }, { name: 'projects_org_active_recent' });
projectSchema.index({ organizationId: 1, status: 1, archivedAt: 1 }, { name: 'projects_org_status_archive' });
projectSchema.index({ organizationId: 1, visibility: 1, archivedAt: 1 }, { name: 'projects_org_visibility_archive' });
projectSchema.index({ organizationId: 1, name: 1 }, { name: 'projects_org_name' });
projectSchema.index({ organizationId: 1, dueDate: 1 }, { name: 'projects_org_due_date' });

projectSchema.pre('validate', function validateProjectDates() {
  if (this.startDate && this.dueDate && this.startDate > this.dueDate) {
    this.invalidate('dueDate', 'Project due date must be on or after its start date');
  }
});

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
