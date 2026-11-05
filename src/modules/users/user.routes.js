const express = require('express');
const authenticate = require('../../middlewares/authenticate');

const router = express.Router();

router.get('/me', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User profile retrieved successfully',
    data: { user: req.user },
    requestId: req.id
  });
});

module.exports = router;
