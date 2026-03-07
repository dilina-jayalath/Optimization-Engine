// backend/routes/behavior.js
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const router = express.Router();

const PERSONALIZATION_SERVICE_URL = process.env.PERSONALIZATION_SERVICE_URL || 'http://localhost:5002';

/**
 * MongoDB Schema for Behavior Logs
 * Stores user behavior data for implicit reward calculation
 */
const behaviorLogSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  clientDomain: { type: String, default: 'unknown' },
  uiVariant: { type: String, required: true },
  
  metrics: {
    duration: { type: Number, default: 0 },
    interactionCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    scrollDepth: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    immediateReversion: { type: Boolean, default: false },
    // Anomaly detection metrics
    clickCount: { type: Number, default: 0 },
    misclickCount: { type: Number, default: 0 },
    rageClickCount: { type: Number, default: 0 },
    avgTimeToClick: { type: Number, default: 0 },
    formErrorCount: { type: Number, default: 0 },
    zoomEventCount: { type: Number, default: 0 },
    // GDPR-compliant tracking
    mouseDistance: { type: Number, default: 0 },
    mouseMovingTime: { type: Number, default: 0 },
    focusCount: { type: Number, default: 0 },
    blurCount: { type: Number, default: 0 },
    viewportWidth: { type: Number, default: 0 },
    viewportHeight: { type: Number, default: 0 },
  },
  
  settingChanges: [{
    timestamp: Number,
    setting: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
  }],
  
  events: [{
    timestamp: Number,
    type: String,
    data: mongoose.Schema.Types.Mixed,
  }],

  // Week 2 reward fields (optional)
  reward: { type: Number, default: null },
  confidence: { type: Number, default: null },
  
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 7776000 }, // 90 days TTL
});

const BehaviorLog = mongoose.model('BehaviorLog', behaviorLogSchema);

/**
 * POST /api/behavior
 * 
 * Receive behavior data from client
 * Stores in MongoDB and triggers reward calculation
 */
router.post('/', async (req, res) => {
  try {
    const { sessionId, userId, clientDomain, uiVariant, metrics, timestamp } = req.body;

    if (!sessionId || !userId || !uiVariant) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, userId, or uiVariant',
      });
    }

    if (userId === 'guest') {
      console.log(`[Behavior API] Ignoring behavior data for guest user (session=${sessionId})`);
      return res.json({
        success: true,
        sessionId,
        message: 'Behavior data ignored for guest user',
      });
    }

    console.log(`[Behavior API] Received data for session=${sessionId}, userId=${userId}`);

    // Store in MongoDB
    const behaviorLog = new BehaviorLog({
      sessionId,
      userId,
      clientDomain: clientDomain || 'unknown',
      uiVariant,
      metrics: metrics || {},
      settingChanges: req.body.settingChanges || [],
      events: req.body.events || [],
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    await behaviorLog.save();

    console.log(`[Behavior API] Stored behavior log for session ${sessionId}`);

    // Phase 2: Behavior data is stored for analytics
    // Trial evaluation happens via /api/trials/evaluate endpoint
    // No legacy reward calculation or Thompson Sampling calls needed

    res.json({
      success: true,
      sessionId,
      message: 'Behavior data received and stored',
    });

  } catch (error) {
    console.error('[Behavior API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/behavior/:userId/sessions
 * 
 * Retrieve all sessions for a user
 */
router.get('/:userId/sessions', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    if (userId === 'guest') {
      return res.json({
        success: true,
        userId,
        count: 0,
        sessions: [],
      });
    }

    const sessions = await BehaviorLog.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json({
      success: true,
      userId,
      count: sessions.length,
      sessions,
    });

  } catch (error) {
    console.error('[Behavior API] Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/behavior/:userId/summary
 * 
 * Get aggregated statistics for a user
 */
router.get('/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === 'guest') {
      return res.json({
        success: true,
        userId,
        summary: {
          totalSessions: 0,
          totalDuration: 0,
          totalInteractions: 0,
          totalErrors: 0,
          averageScrollDepth: 0,
          immediateReversionCount: 0,
        },
      });
    }

    const sessions = await BehaviorLog.find({ userId });

    const summary = {
      totalSessions: sessions.length,
      totalDuration: sessions.reduce((sum, s) => sum + (s.metrics?.duration || 0), 0),
      totalInteractions: sessions.reduce((sum, s) => sum + (s.metrics?.interactionCount || 0), 0),
      totalErrors: sessions.reduce((sum, s) => sum + (s.metrics?.errorCount || 0), 0),
      averageScrollDepth: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + (s.metrics?.scrollDepth || 0), 0) / sessions.length 
        : 0,
      immediateReversionCount: sessions.filter(s => s.metrics?.immediateReversion).length,
    };

    res.json({
      success: true,
      userId,
      summary,
    });

  } catch (error) {
    console.error('[Behavior API] Error fetching summary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/behavior/:userId/revert-stats
 * 
 * Reversion analytics over a time window (default 30 days)
 */
router.get('/:userId/revert-stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const windowDays = parseInt(req.query.windowDays) || 30;
    
    if (userId === 'guest') {
      return res.json({
        success: true,
        userId,
        windowDays,
        totalSessions: 0,
        revertCount: 0,
        revertRate: 0,
        averageReward: null,
        lastRevertAt: null,
      });
    }

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const logs = await BehaviorLog.find({ userId, timestamp: { $gte: since } }).sort({ timestamp: -1 });

    const total = logs.length;
    const reverts = logs.filter((s) => s.metrics?.immediateReversion).length;
    const revertRate = total > 0 ? reverts / total : 0;
    const avgReward = total > 0
      ? logs.reduce((sum, s) => sum + (s.reward ?? 0), 0) / total
      : null;

    res.json({
      success: true,
      userId,
      windowDays,
      totalSessions: total,
      revertCount: reverts,
      revertRate,
      averageReward: avgReward,
      lastRevertAt: logs.find((s) => s.metrics?.immediateReversion)?.timestamp || null,
    });
  } catch (error) {
    console.error('[Behavior API] Error fetching revert stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/behavior/:sessionId/reward
 * 
 * Store calculated reward for a session
 */
router.post('/:sessionId/reward', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reward, confidence } = req.body;

    const behaviorLog = await BehaviorLog.findOne({ sessionId });

    if (!behaviorLog) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    behaviorLog.reward = reward;
    behaviorLog.confidence = confidence;
    await behaviorLog.save();

    console.log(`[Behavior API] Stored reward for session ${sessionId}: ${reward}`);

    res.json({
      success: true,
      sessionId,
      reward,
    });

  } catch (error) {
    console.error('[Behavior API] Error storing reward:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/behavior/:userId
 * 
 * Delete all behavior data for a user (GDPR compliance)
 */
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await BehaviorLog.deleteMany({ userId });

    console.log(`[Behavior API] Deleted ${result.deletedCount} sessions for userId ${userId}`);

    res.json({
      success: true,
      userId,
      deletedCount: result.deletedCount,
    });

  } catch (error) {
    console.error('[Behavior API] Error deleting data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = { router, BehaviorLog };
