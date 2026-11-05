const mongoose = require('mongoose');

const projectMemberSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['Owner', 'Editor', 'Viewer'], required: true },
  status: { type: String, enum: ['active', 'removed'], default: 'active' },
  joinedAt: { type: Date, default: Date.now },
  removedAt: { type: Date, default: null },
  removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

projectMemberSchema.index({ organizationId: 1, projectId: 1, userId: 1 }, { unique: true, name: 'project_member_unique' });
projectMemberSchema.index({ organizationId: 1, projectId: 1, status: 1, createdAt: 1 }, { name: 'project_members_listing' });
projectMemberSchema.index({ organizationId: 1, userId: 1, status: 1, projectId: 1 }, { name: 'user_project_memberships' });

module.exports = mongoose.models.ProjectMember || mongoose.model('ProjectMember', projectMemberSchema);
