const invitationService = require('./invitation.service');
const asyncHandler = require('../../utils/async-handler');

const list = asyncHandler(async (req, res) => {
  const result = await invitationService.list(req.organization._id, req.validated.query);
  res.status(200).json({
    success: true,
    message: 'Pending invitations retrieved successfully',
    data: result.invitations,
    pagination: result.pagination,
    requestId: req.id
  });
});

const create = asyncHandler(async (req, res) => {
  const invitation = await invitationService.create({
    organization: req.organization,
    actorMembership: req.membership,
    email: req.validated.body.email,
    role: req.validated.body.role
  });
  res.status(201).json({ success: true, message: 'Invitation created successfully', data: { invitation }, requestId: req.id });
});

const revoke = asyncHandler(async (req, res) => {
  await invitationService.revoke(req.organization._id, req.validated.params.invitationId, req.membership);
  res.status(200).json({ success: true, message: 'Invitation revoked successfully', data: null, requestId: req.id });
});

const accept = asyncHandler(async (req, res) => {
  const result = await invitationService.accept({ token: req.validated.body.token, user: req.user });
  res.status(200).json({
    success: true,
    message: 'Organization invitation accepted successfully',
    data: result,
    requestId: req.id
  });
});

module.exports = { list, create, revoke, accept };
