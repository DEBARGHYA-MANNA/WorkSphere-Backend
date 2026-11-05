const logger = require('../logger');

let transport = null;

function configureMailTransport(mailTransport) {
  if (!mailTransport || typeof mailTransport.sendMail !== 'function') {
    throw new TypeError('Mail transport must expose a sendMail(message) function');
  }
  transport = mailTransport;
}

async function deliver(message) {
  if (!transport) {
    // Keep local development usable without committing to an email vendor. Never log the token or link.
    logger.warn('Email delivery skipped: no mail transport has been configured', { template: message.template });
    return;
  }
  await transport.sendMail(message);
}

async function sendVerificationEmail({ to, token }) {
  await deliver({
    template: 'email-verification',
    to,
    subject: 'Verify your WorkSphere email',
    text: `Use this one-time verification token to verify your account: ${token}`
  });
}

async function sendPasswordResetEmail({ to, token }) {
  await deliver({
    template: 'password-reset',
    to,
    subject: 'Reset your WorkSphere password',
    text: `Use this one-time password reset token to reset your password: ${token}`
  });
}

async function sendOrganizationInvitationEmail({ to, token, organizationName, role }) {
  await deliver({
    template: 'organization-invitation',
    to,
    subject: `You are invited to join ${organizationName} on WorkSphere`,
    text: `You have been invited to join ${organizationName} as ${role}. Use this one-time invitation token to accept: ${token}`
  });
}

module.exports = { configureMailTransport, sendVerificationEmail, sendPasswordResetEmail, sendOrganizationInvitationEmail };
