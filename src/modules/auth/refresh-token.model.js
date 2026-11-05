const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, select: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true },
  familyId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  purgeAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  replacedByTokenHash: { type: String, default: null, select: false }
}, { timestamps: true });

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true, name: 'refresh_token_hash_unique' });
refreshTokenSchema.index({ userId: 1, sessionId: 1, revokedAt: 1 }, { name: 'refresh_user_session_active' });
refreshTokenSchema.index({ familyId: 1 }, { name: 'refresh_family_lookup' });
refreshTokenSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0, name: 'refresh_token_retention_ttl' });

module.exports = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
