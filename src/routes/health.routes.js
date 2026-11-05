const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check service liveness
 *     tags: [System]
 *     responses:
 *       200:
 *         description: The API process is running
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'WorkSphere API is healthy',
    data: {
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    },
    requestId: req.id
  });
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Check service and database readiness
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API and MongoDB are ready
 *       503:
 *         description: MongoDB is not connected
 */
router.get('/health/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? 'WorkSphere API is ready' : 'WorkSphere API is not ready',
    data: { status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'disconnected' },
    requestId: req.id
  });
});

module.exports = router;
