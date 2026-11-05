const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  slug: { type: String, required: true, lowercase: true, trim: true, minlength: 2, maxlength: 64 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  settings: {
    allowMemberInvites: { type: Boolean, default: true },
    defaultMemberRole: { type: String, enum: ['Member', 'Viewer'], default: 'Member' }
  }
}, { timestamps: true });

organizationSchema.index({ slug: 1 }, { unique: true, name: 'organizations_slug_unique' });
organizationSchema.index({ status: 1, createdAt: -1 }, { name: 'organizations_active_recent' });

module.exports = mongoose.models.Organization || mongoose.model('Organization', organizationSchema);
