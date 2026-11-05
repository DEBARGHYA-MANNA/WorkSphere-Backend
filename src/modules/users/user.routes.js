const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const controller = require('./user.controller');
const validation = require('./user.validation');

const router = express.Router();
router.use(authenticate);

router.get('/me', controller.getMe);
router.patch('/me', validate(validation.profileSchema), controller.updateProfile);
router.patch('/me/password', validate(validation.changePasswordSchema), controller.changePassword);
router.delete('/me', validate(validation.deactivateAccountSchema), controller.deactivateAccount);
router.get('/:userId', validate(validation.userIdParamsSchema, 'params'), controller.getById);

module.exports = router;
