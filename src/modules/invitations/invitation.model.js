const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  role: { type: String, enum: ['Admin', 'Manager', 'Member', 'Viewer'], required: true },
  tokenHash: { type: String, required: true, select: false },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'revoked', 'expired'], default: 'pending' },
  expiresAt: { type: Date, required: true },
  purgeAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.tokenHash;
      delete ret.__v;
      return ret;
    }
  }
});

invitationSchema.index({ tokenHash: 1 }, { unique: true, name: 'invitation_token_hash_unique' });
invitationSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_org_email_invitation' }
);
invitationSchema.index({ organizationId: 1, status: 1, createdAt: -1 }, { name: 'organization_invitation_listing' });
invitationSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0, name: 'invitation_retention_ttl' });

module.exports = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);
