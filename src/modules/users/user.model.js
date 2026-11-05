const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const env = require('../../config/env');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  emailVerified: { type: Boolean, default: false },
  emailVerifiedAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'suspended', 'disabled'], default: 'active' },
  emailVerificationTokenHash: { type: String, default: null, select: false },
  emailVerificationExpiresAt: { type: Date, default: null, select: false },
  passwordResetTokenHash: { type: String, default: null, select: false },
  passwordResetExpiresAt: { type: Date, default: null, select: false }
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.passwordHash;
      delete ret.emailVerificationTokenHash;
      delete ret.emailVerificationExpiresAt;
      delete ret.passwordResetTokenHash;
      delete ret.passwordResetExpiresAt;
      delete ret.__v;
      return ret;
    }
  }
});

userSchema.index({ email: 1 }, { unique: true, name: 'users_email_unique' });

function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

userSchema.pre('save', async function hashPasswordWhenChanged() {
  if (this.isModified('passwordHash') && !isBcryptHash(this.passwordHash)) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, env.bcryptRounds);
  }
});

async function hashPasswordInQueryUpdate() {
  const update = this.getUpdate();
  if (!update) return;
  const fields = update.$set || update;
  if (typeof fields.passwordHash === 'string' && !isBcryptHash(fields.passwordHash)) {
    fields.passwordHash = await bcrypt.hash(fields.passwordHash, env.bcryptRounds);
  }
  this.setUpdate(update);
}

userSchema.pre('findOneAndUpdate', hashPasswordInQueryUpdate);
userSchema.pre('updateOne', hashPasswordInQueryUpdate);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
