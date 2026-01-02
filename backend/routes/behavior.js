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

    // Week 1: Call Python service to calculate reward
    let rewardResult = null;
    let rewardWarning = null;
    try {
      const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
      
      const rewardResponse = await axios.post(`${PYTHON_SERVICE_URL}/calculate_reward`, {
        sessionId,
        userId,
        duration: metrics.duration || 0,
        interactionCount: metrics.interactionCount || 0,
        errorCount: metrics.errorCount || 0,
        scrollDepth: metrics.scrollDepth || 0,
        tasksCompleted: metrics.tasksCompleted || 0,
        immediateReversion: metrics.immediateReversion || false,
      });

      if (rewardResponse.data.success) {
        const { reward, confidence } = rewardResponse.data;
        
        // Store reward in behavior log
        behaviorLog.reward = reward;
        behaviorLog.confidence = confidence;
        await behaviorLog.save();

        console.log(`[Behavior API] Calculated reward for session ${sessionId}: ${reward.toFixed(3)} (confidence: ${confidence.toFixed(3)})`);
        rewardResult = { reward, confidence };
      } else {
        throw new Error('Python service failed to calculate reward');
      }
    } catch (rewardError) {
      console.error(`[Behavior API] Failed to calculate reward: ${rewardError.message}`);
      rewardWarning = 'Reward calculation unavailable';
    }

    // Week 2: Send behavior feedback to Thompson Sampling service (non-blocking)
    try {
      const personalizationSessionId = req.body.personalizationSessionId || sessionId;
      await axios.post(`${PERSONALIZATION_SERVICE_URL}/feedback`, {
        sessionId: personalizationSessionId,
        userId,
        metrics: {
          duration: metrics?.duration || 0,
          interactionCount: metrics?.interactionCount || 0,
          errorCount: metrics?.errorCount || 0,
          scrollDepth: metrics?.scrollDepth || 0,
          tasksCompleted: metrics?.tasksCompleted || 0,
          immediateReversion: metrics?.immediateReversion || false,
        },
      });
    } catch (personalizationError) {
      console.error(`[Behavior API] Failed to send feedback to personalization service: ${personalizationError.message}`);
    }

    // Still return success for storing behavior data
    res.json({
      success: true,
      sessionId,
      message: rewardResult
        ? 'Behavior data received and reward calculated'
        : 'Behavior data received (reward calculation failed)',
      reward: rewardResult ? rewardResult.reward : undefined,
      confidence: rewardResult ? rewardResult.confidence : undefined,
      warning: rewardWarning || undefined,
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
