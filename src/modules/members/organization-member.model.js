const mongoose = require('mongoose');

const organizationMemberSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['Owner', 'Admin', 'Manager', 'Member', 'Viewer'], required: true },
  status: { type: String, enum: ['active', 'removed'], default: 'active' },
  joinedAt: { type: Date, default: Date.now },
  removedAt: { type: Date, default: null },
  removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true, name: 'organization_member_unique' });
organizationMemberSchema.index({ userId: 1, status: 1, organizationId: 1 }, { name: 'member_user_organizations' });
organizationMemberSchema.index({ organizationId: 1, status: 1, createdAt: 1 }, { name: 'organization_members_listing' });

module.exports = mongoose.models.OrganizationMember || mongoose.model('OrganizationMember', organizationMemberSchema);
