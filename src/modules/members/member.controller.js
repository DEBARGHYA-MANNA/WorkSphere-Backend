const memberService = require('./member.service');
const asyncHandler = require('../../utils/async-handler');

const list = asyncHandler(async (req, res) => {
  const result = await memberService.list(req.organization._id, req.validated.query);
  res.status(200).json({
    success: true,
    message: 'Organization members retrieved successfully',
    data: result.members,
    pagination: result.pagination,
    requestId: req.id
  });
});

const updateRole = asyncHandler(async (req, res) => {
  const member = await memberService.updateRole(
    req.organization._id,
    req.validated.params.memberId,
    req.validated.body.role,
    req.membership
  );
  res.status(200).json({ success: true, message: 'Member role updated successfully', data: { member }, requestId: req.id });
});

const remove = asyncHandler(async (req, res) => {
  await memberService.remove(req.organization._id, req.validated.params.memberId, req.membership);
  res.status(200).json({ success: true, message: 'Member removed successfully', data: null, requestId: req.id });
});

module.exports = { list, updateRole, remove };
