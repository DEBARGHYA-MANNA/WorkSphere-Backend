const organizationService = require('./organization.service');
const asyncHandler = require('../../utils/async-handler');

const list = asyncHandler(async (req, res) => {
  const result = await organizationService.listForUser(req.auth.userId, req.validated.query);
  res.status(200).json({
    success: true,
    message: 'Organizations retrieved successfully',
    data: result.organizations,
    pagination: result.pagination,
    requestId: req.id
  });
});

const create = asyncHandler(async (req, res) => {
  const result = await organizationService.create(req.auth.userId, req.validated.body);
  res.status(201).json({ success: true, message: 'Organization created successfully', data: result, requestId: req.id });
});

const get = (req, res) => res.status(200).json({
  success: true,
  message: 'Organization retrieved successfully',
  data: { organization: req.organization, membership: { role: req.membership.role } },
  requestId: req.id
});

const update = asyncHandler(async (req, res) => {
  const organization = await organizationService.update(req.organization, req.validated.body);
  res.status(200).json({ success: true, message: 'Organization updated successfully', data: { organization }, requestId: req.id });
});

const remove = asyncHandler(async (req, res) => {
  await organizationService.remove(req.organization, req.membership);
  res.status(200).json({ success: true, message: 'Organization deleted successfully', data: null, requestId: req.id });
});

const switchContext = (req, res) => {
  const context = organizationService.switchContext(req.organization, req.membership);
  res.status(200).json({ success: true, message: 'Organization context selected', data: context, requestId: req.id });
};

module.exports = { list, create, get, update, remove, switchContext };
