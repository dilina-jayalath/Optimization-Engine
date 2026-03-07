// backend/routes/behavior-rl-optimization.js
/**
 * Behavior-Based RL Optimization
 * 
 * Uses BehaviorTracker data to calculate implicit rewards and train RL model
 * Automatically optimizes UI settings based on user behavior patterns
 * 
 * KEY FEATURE: Only asks for feedback when difficulty is detected!
 * - Monitors rage clicks, misclicks, errors, slow interactions
 * - Shows feedback popup only when user struggles
 * - Automatically applies optimized settings after confirmation
 */

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const router = express.Router();

const RL_SERVICE_URL = process.env.RL_SERVICE_URL || process.env.PYTHON_RL_URL || 'http://localhost:8000';

// Reference to BehaviorLog from behavior.js
const BehaviorLog = mongoose.models.BehaviorLog || 
  mongoose.model('BehaviorLog', new mongoose.Schema({
    sessionId: String,
    userId: String,
    clientDomain: String,
    uiVariant: String,
    metrics: {
      duration: Number,
      interactionCount: Number,
      errorCount: Number,
      scrollDepth: Number,
      tasksCompleted: Number,
      immediateReversion: Boolean,
      clickCount: Number,
      misclickCount: Number,
      rageClickCount: Number,
      avgTimeToClick: Number,
      formErrorCount: Number,
      zoomEventCount: Number,
    },
    settingChanges: Array,
    events: Array,
    reward: Number,
    confidence: Number,
    timestamp: Date,
  }));

/**
 * Calculate implicit reward from behavior metrics
 * Good behavior = positive reward, bad behavior = negative reward
 */
function calculateImplicitReward(metrics) {
  let reward = 0;
  let confidence = 0.5;

  // Positive signals
  if (metrics.duration > 30000) { // More than 30 seconds engaged
    reward += 0.3;
    confidence += 0.1;
  }

  if (metrics.interactionCount > 5) { // Active user
    reward += 0.2;
    confidence += 0.1;
  }

  if (metrics.scrollDepth > 0.5) { // Scrolled through content
    reward += 0.2;
    confidence += 0.1;
  }

  if (metrics.tasksCompleted > 0) { // Completed actions
    reward += 0.4;
    confidence += 0.2;
  }

  // Negative signals
  if (metrics.immediateReversion) { // User reverted immediately (BAD!)
    reward -= 0.8;
    confidence += 0.3; // High confidence in negative signal
  }

  if (metrics.errorCount > 0) {
    reward -= 0.2 * metrics.errorCount;
    confidence += 0.1;
  }

  if (metrics.rageClickCount > 0) { // Frustration signal
    reward -= 0.3 * metrics.rageClickCount;
    confidence += 0.2;
  }

  if (metrics.misclickCount > 3) { // Multiple misclicks = poor usability
    reward -= 0.2;
    confidence += 0.1;
  }

  if (metrics.formErrorCount > 0) {
    reward -= 0.2 * metrics.formErrorCount;
    confidence += 0.1;
  }

  // Normalize reward to [-1, 1]
  reward = Math.max(-1, Math.min(1, reward));
  confidence = Math.min(1, confidence);

  return { reward, confidence };
}

/**
 * Helper function to explain why parameter is being optimized
 */
function getOptimizationReason(parameter, metrics) {
  switch (parameter) {
    case 'target_size':
      if (metrics.misclickCount > 2) return 'Reducing misclicks with larger targets';
      if (metrics.rageClickCount > 1) return 'Reducing frustration with better target sizing';
      return 'Optimizing target size for better interaction';
    
    case 'font_size':
      if (metrics.errorCount > 1) return 'Improving readability to reduce errors';
      return 'Optimizing text size for better readability';
    
    case 'contrast_mode':
      if (metrics.avgTimeToClick > 3000) return 'Improving visibility to speed up interactions';
      if (metrics.errorCount > 1) return 'Enhancing contrast to reduce errors';
      return 'Optimizing contrast for better visibility';
    
    case 'theme':
      if (metrics.avgTimeToClick > 3000) return 'Adjusting theme for better visibility';
      return 'Optimizing theme based on usage patterns';
    
    case 'element_spacing_x':
    case 'element_spacing_y':
      if (metrics.rageClickCount > 1) return 'Increasing spacing to reduce frustration';
      return 'Optimizing element spacing for better interaction';
    
    default:
      return 'Optimizing based on behavior patterns';
  }
}

/**
 * POST /api/behavior-rl/analyze-and-optimize
 * 
 * Analyze recent behavior logs and use them to train RL model
 * When difficulty is detected, automatically optimize and apply settings
 * Returns optimized setting suggestions based on learned patterns
 */
router.post('/analyze-and-optimize', async (req, res) => {
  try {
    const { userId, lookbackMinutes = 30, issueDetected, userFeedback } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    if (userId === 'guest') {
      console.log(`[Behavior RL] Ignoring analysis request for guest user`);
      return res.json({
        success: true,
        message: 'Behavior RL optimization is disabled for guest users',
        logsAnalyzed: 0,
        trainingResults: [],
        optimizationSuggestions: [],
        difficultyDetected: false
      });
    }

    console.log(`[Behavior RL] Analyzing behavior for userId=${userId}, lookback=${lookbackMinutes}min`);
    if (issueDetected) {
      console.log(`[Behavior RL]  Difficulty detected: ${issueDetected.type} (${issueDetected.severity})`);
      console.log(`[Behavior RL]  User feedback: ${userFeedback}`);
    }

    // Get recent behavior logs
    const since = new Date(Date.now() - lookbackMinutes * 60 * 1000);
    const behaviorLogs = await BehaviorLog.find({
      userId,
      timestamp: { $gte: since }
    }).sort({ timestamp: -1 });

    if (behaviorLogs.length === 0) {
      return res.json({
        success: true,
        message: 'No recent behavior data found',
        logsAnalyzed: 0
      });
    }

    console.log(`[Behavior RL] Found ${behaviorLogs.length} behavior logs`);

    // Calculate implicit rewards and train RL model
    const trainingResults = [];
    
    for (const log of behaviorLogs) {
      // Skip if already has reward calculated
      if (log.reward !== null && log.reward !== undefined) {
        continue;
      }

      // Calculate implicit reward
      const { reward, confidence } = calculateImplicitReward(log.metrics);

      // Extract setting changes from this session
      const settingChanges = log.settingChanges || [];
      
      // Train RL model for each setting change
      for (const change of settingChanges) {
        try {
          const trainingPayload = {
            user_id: userId,
            parameter: change.setting,
            action: change.newValue,
            reward: reward,
            state: {
              previousValue: change.oldValue,
              sessionDuration: log.metrics.duration,
              interactionCount: log.metrics.interactionCount,
              errorCount: log.metrics.errorCount
            }
          };

          console.log(`[Behavior RL] Training RL for ${change.setting}: ${change.oldValue} → ${change.newValue}, reward=${reward}`);

          const rlResponse = await axios.post(`${RL_SERVICE_URL}/rl/feedback`, trainingPayload);
          
          trainingResults.push({
            parameter: change.setting,
            oldValue: change.oldValue,
            newValue: change.newValue,
            reward,
            confidence,
            qValue: rlResponse.data.q_value
          });

        } catch (rlError) {
          console.error(`[Behavior RL] Error training RL:`, rlError.message);
        }
      }

      // Store calculated reward in behavior log
      log.reward = reward;
      log.confidence = confidence;
      await log.save();
    }

    console.log(`[Behavior RL]  Trained RL model with ${trainingResults.length} behavior-based samples`);

    // If difficulty was detected and user gave negative feedback, get optimized settings
    let optimizationSuggestions = [];
    let appliedSettings = null;

    if (issueDetected && userFeedback === 'bad') {
      console.log(`[Behavior RL]  User confirmed difficulty - generating optimized settings...`);

      // Determine what to optimize based on issue type
      const parametersToOptimize = [];
      
      if (issueDetected.type === 'rage_clicks' || issueDetected.type === 'misclicks') {
        parametersToOptimize.push('target_size', 'element_spacing_x');
      } else if (issueDetected.type === 'errors') {
        parametersToOptimize.push('font_size', 'contrast_mode');
      } else if (issueDetected.type === 'slow_interaction') {
        parametersToOptimize.push('contrast_mode', 'theme');
      }

      // Get RL suggestions
      for (const parameter of parametersToOptimize) {
        try {
          const rlResponse = await axios.post(`${RL_SERVICE_URL}/rl/choose-action`, {
            user_id: userId,
            parameter,
            state: issueDetected.metrics
          });

          optimizationSuggestions.push({
            parameter,
            value: rlResponse.data.action,
            qValue: rlResponse.data.q_value,
            reason: getOptimizationReason(parameter, issueDetected.metrics)
          });
        } catch (err) {
          console.error(`[Behavior RL] Error getting RL suggestion for ${parameter}:`, err.message);
        }
      }

      // Apply the optimized settings automatically
      if (optimizationSuggestions.length > 0) {
        const settingsToApply = {};
        optimizationSuggestions.forEach(suggestion => {
          settingsToApply[suggestion.parameter] = suggestion.value;
        });

        try {
          await axios.post(`${process.env.API_URL}/manual-settings/apply`, {
            userId,
            settings: settingsToApply
          });
          appliedSettings = settingsToApply;
          console.log(`[Behavior RL]  Auto-applied optimized settings:`, settingsToApply);
        } catch (applyError) {
          console.error(`[Behavior RL] Error applying settings:`, applyError.message);
        }
      }
    }

    res.json({
      success: true,
      userId,
      logsAnalyzed: behaviorLogs.length,
      trainingResults,
      difficultyDetected: !!issueDetected,
      issueType: issueDetected?.type,
      userFeedback,
      optimizationSuggestions,
      appliedSettings,
      message: appliedSettings 
        ? `Difficulty detected! Applied ${Object.keys(appliedSettings).length} optimized settings`
        : `Analyzed ${behaviorLogs.length} behavior logs and trained RL model`
    });

  } catch (error) {
    console.error('[Behavior RL] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/behavior-rl/summary/:userId
 * 
 * Get summary of behavior-based RL optimization for a user
 */
router.get('/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === 'guest') {
      return res.json({
        success: true,
        userId,
        summary: {
          totalLogs: 0,
          logsWithRewards: 0,
          averageReward: null,
          positiveRewards: 0,
          negativeRewards: 0,
          averageConfidence: null,
          recentImmedateReversions: 0
        }
      });
    }

    const logs = await BehaviorLog.find({ userId }).sort({ timestamp: -1 }).limit(50);

    const logsWithRewards = logs.filter(log => log.reward !== null && log.reward !== undefined);
    
    const summary = {
      totalLogs: logs.length,
      logsWithRewards: logsWithRewards.length,
      averageReward: logsWithRewards.length > 0 
        ? logsWithRewards.reduce((sum, log) => sum + log.reward, 0) / logsWithRewards.length 
        : null,
      positiveRewards: logsWithRewards.filter(log => log.reward > 0).length,
      negativeRewards: logsWithRewards.filter(log => log.reward < 0).length,
      averageConfidence: logsWithRewards.length > 0
        ? logsWithRewards.reduce((sum, log) => sum + (log.confidence || 0), 0) / logsWithRewards.length
        : null,
      recentImmedateReversions: logs.filter(log => log.metrics?.immediateReversion).length
    };

    res.json({
      success: true,
      userId,
      summary
    });

  } catch (error) {
    console.error('[Behavior RL] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
