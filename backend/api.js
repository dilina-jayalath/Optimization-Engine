/**
 * Backend API for Adaptive UI Optimizer
 * 
 * This Express API provides endpoints for:
 * - User settings management
 * - Undo/Redo functionality
 * - Q-table access and export
 * - Feedback collection
 * - Analytics and reporting
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const RLMongoDBService = require('./mongodb/service');

const app = express();
const dbService = new RLMongoDBService();

// Python DQN Service URL
const PYTHON_RL_URL = process.env.PYTHON_RL_URL || 'http://localhost:8000';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static dashboard files
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));

// =====================================================
// USER & SETTINGS ENDPOINTS
// =====================================================

/**
 * GET /api/users/:userId
 * Get user profile and current settings
 */
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await dbService.getUser(userId);
    
    res.json({
      success: true,
      data: {
        userId: user.userId,
        currentSettings: user.currentSettings,
        mlProfile: user.mlProfile,
        manualOverrides: Object.fromEntries(user.manualOverrides),
        dashboardSettings: user.dashboardSettings,
        lastActive: user.lastActive
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/settings
 * Update user settings
 */
app.post('/api/users/:userId/settings', async (req, res) => {
  try {
    const { userId } = req.params;
    const { settings, source = 'user_manual' } = req.body;
    
    const updatedSettings = await dbService.updateUserSettings(userId, settings, source);
    
    // Log event
    await dbService.logEvent(userId, 'optimization_applied', {
      settings,
      source,
      success: true
    });
    
    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/ml-profile
 * Update ML profile from your optimization engine
 */
app.post('/api/users/:userId/ml-profile', async (req, res) => {
  try {
    const { userId } = req.params;
    const { categoryWise, userWise, mergedProfile } = req.body;
    
    const mlProfile = await dbService.updateMLProfile(
      userId,
      categoryWise,
      userWise,
      mergedProfile
    );
    
    // Log event
    await dbService.logEvent(userId, 'profile_loaded', {
      profileType: 'ml',
      success: true
    });
    
    res.json({
      success: true,
      data: mlProfile
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/override
 * Set manual override for a parameter
 */
app.post('/api/users/:userId/override', async (req, res) => {
  try {
    const { userId } = req.params;
    const { parameter, value, reason } = req.body;
    
    const user = await dbService.setManualOverride(userId, parameter, value, reason);
    
    // Log event
    await dbService.logEvent(userId, 'manual_override', {
      parameter,
      value,
      reason,
      success: true
    });
    
    res.json({
      success: true,
      data: {
        parameter,
        value,
        currentSettings: user.currentSettings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/overrides
 * Get all manual overrides
 */
app.get('/api/users/:userId/overrides', async (req, res) => {
  try {
    const { userId } = req.params;
    const overrides = await dbService.getManualOverrides(userId);
    
    res.json({
      success: true,
      data: overrides
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// UNDO/REDO ENDPOINTS
// =====================================================

/**
 * GET /api/users/:userId/history
 * Get settings change history
 */
app.get('/api/users/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = await dbService.getSettingsHistory(userId, limit);
    
    res.json({
      success: true,
      data: history.map(h => ({
        id: h._id,
        parameter: h.change.parameter,
        oldValue: h.change.oldValue,
        newValue: h.change.newValue,
        source: h.change.source,
        timestamp: h.timestamp,
        isUndone: h.isUndone,
        snapshot: h.snapshot
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/undo
 * Undo last change
 */
app.post('/api/users/:userId/undo', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await dbService.undoLastChange(userId);
    
    if (result.success) {
      // Log event
      await dbService.logEvent(userId, 'undo', {
        undoneChange: result.undoneChange,
        restoredSettings: result.restoredSettings
      });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/redo
 * Redo last undone change
 */
app.post('/api/users/:userId/redo', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await dbService.redoLastUndo(userId);
    
    if (result.success) {
      // Log event
      await dbService.logEvent(userId, 'redo', {
        redoneChange: result.redoneChange,
        restoredSettings: result.restoredSettings
      });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/undo-redo-status
 * Check if undo/redo is available
 */
app.get('/api/users/:userId/undo-redo-status', async (req, res) => {
  try {
    const { userId } = req.params;
    const status = await dbService.getUndoRedoStatus(userId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/reset
 * Reset to default settings
 */
app.post('/api/users/:userId/reset', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const defaultSettings = {
      fontSize: 'medium',
      lineHeight: 1.5,
      theme: 'light',
      contrastMode: 'normal',
      elementSpacing: 'normal',
      targetSize: 32
    };
    
    const updatedSettings = await dbService.updateUserSettings(
      userId,
      defaultSettings,
      'reset'
    );
    
    // Log event
    await dbService.logEvent(userId, 'reset', {
      settings: defaultSettings,
      success: true
    });
    
    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// Q-TABLE ENDPOINTS
// =====================================================

/**
 * GET /api/users/:userId/qtables
 * Get all Q-tables for user
 */
app.get('/api/users/:userId/qtables', async (req, res) => {
  try {
    const { userId } = req.params;
    const parameters = ['fontSize', 'lineHeight', 'theme', 'contrastMode', 'elementSpacing', 'targetSize'];
    
    const qTables = await Promise.all(
      parameters.map(param => dbService.exportQTable(userId, param))
    );
    
    res.json({
      success: true,
      data: qTables
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/qtables/:parameter
 * Get Q-table for specific parameter
 */
app.get('/api/users/:userId/qtables/:parameter', async (req, res) => {
  try {
    const { userId, parameter } = req.params;
    const qTable = await dbService.exportQTable(userId, parameter);
    
    res.json({
      success: true,
      data: qTable
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/qtables/:parameter/update
 * Update Q-value (used by NPM package)
 */
app.post('/api/users/:userId/qtables/:parameter/update', async (req, res) => {
  try {
    const { userId, parameter } = req.params;
    const { state, action, value } = req.body;
    
    const qTable = await dbService.updateQValue(userId, parameter, state, action, value);
    
    res.json({
      success: true,
      data: {
        parameter: qTable.parameter,
        totalUpdates: qTable.totalUpdates
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/qtables/:parameter/best-action
 * Get best action for current state (DQN Integration)
 */
app.get('/api/users/:userId/qtables/:parameter/best-action', async (req, res) => {
  try {
    const { userId, parameter } = req.params;
    const { state } = req.query;
    
    // Try to get recommendation from Python DQN first
    try {
      const user = await dbService.getUser(userId);
      
      const dqnResponse = await axios.post(`${PYTHON_RL_URL}/rl/choose-action`, {
        userId,
        parameter,
        state: {
          ...user.currentSettings,
          deviceType: 'desktop',
          timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'
        },
        explore: true
      }, { timeout: 3000 });
      
      return res.json({
        success: true,
        data: {
          action: dqnResponse.data.action,
          qValue: dqnResponse.data.qValue,
          epsilon: dqnResponse.data.epsilon,
          source: 'dqn'
        }
      });
    } catch (dqnError) {
      console.log('DQN service unavailable, falling back to Q-table');
      
      // Fallback to traditional Q-table
      const result = await dbService.getBestAction(userId, parameter, state || 'current');
      
      res.json({
        success: true,
        data: {
          ...result,
          source: 'qtable'
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// FEEDBACK ENDPOINTS
// =====================================================

/**
 * POST /api/users/:userId/feedback
 * Submit user feedback (DQN Integration with Smart Next Suggestions)
 * 
 * SIMPLIFIED: Frontend sends current value + feedback, RL predicts next value
 */
app.post('/api/users/:userId/feedback', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // SIMPLIFIED PAYLOAD - can accept both old and new format
    let parameter, currentValue, previousValue, feedback, context, state;
    
    if (req.body.optimization) {
      // Old format (backward compatible)
      parameter = req.body.optimization.parameter;
      previousValue = req.body.optimization.oldValue;
      currentValue = req.body.optimization.newValue;
      feedback = req.body.feedback;
      context = req.body.context;
      state = req.body.state;
    } else {
      // NEW SIMPLIFIED FORMAT
      parameter = req.body.parameter;
      currentValue = req.body.currentValue;
      previousValue = req.body.previousValue;
      feedback = req.body.feedback;
      context = req.body.context;
      state = req.body.state;
    }
    
    console.log('📥 Received feedback:', { parameter, currentValue, feedbackType: feedback.type });
    
    // Calculate enhanced reward based on feedback
    const reward = calculateEnhancedReward(feedback, context);
    
    // Build optimization object for storage
    const optimization = {
      parameter,
      oldValue: previousValue || currentValue,
      newValue: currentValue,
      suggestedBy: req.body.optimization?.suggestedBy || 'user_manual'
    };
    
    const feedbackEntry = await dbService.recordFeedback(
      userId,
      optimization,
      feedback,
      reward,
      context
    );
    
    // Get user's current state
    const user = await dbService.getUser(userId);
    const currentState = state || {
      ...user.currentSettings,
      [parameter]: currentValue,
      deviceType: context?.deviceType || 'desktop',
      timeOfDay: context?.timeOfDay || 'daytime'
    };
    
    // Send to Python DQN for training
    let rlTrainingResult = null;
    try {
      const dqnResponse = await axios.post(`${PYTHON_RL_URL}/rl/feedback`, {
        userId,
        parameter: parameter,
        state: currentState,
        action: currentValue,
        reward: reward.normalized,
        nextState: currentState, // State doesn't change on feedback
        done: false,
        metadata: {
          feedbackType: feedback.type,
          rating: feedback.rating,
          accepted: feedback.accepted !== false,
          responseTime: feedback.responseTime || 0
        }
      }, { timeout: 5000 });
      
      rlTrainingResult = dqnResponse.data;
      console.log('🧠 DQN Training:', { loss: rlTrainingResult.loss, qValue: rlTrainingResult.qValue });
    } catch (dqnError) {
      console.error('DQN service error (non-blocking):', dqnError.message);
    }
    
    // 🎯 RL PREDICTS NEXT VALUE (KEY FEATURE)
    const nextSuggestion = await getNextSuggestion(
      userId,
      parameter,
      currentState,
      feedback.type
    );
    
    console.log('💡 RL Suggested:', nextSuggestion?.suggestedValue);
    
    // Auto-apply RL suggestion to user settings
    let updatedSettings = null;
    if (nextSuggestion && nextSuggestion.suggestedValue) {
      // Update both current settings and RL suggested settings
      updatedSettings = await dbService.updateUserSettings(
        userId,
        { [parameter]: nextSuggestion.suggestedValue },
        'rl_optimization'
      );
      
      // Store RL suggestion separately for tracking
      await dbService.getUser(userId).then(user => {
        user.rlSuggestedSettings = user.rlSuggestedSettings || {};
        user.rlSuggestedSettings[parameter] = nextSuggestion.suggestedValue;
        user.rlSuggestedSettings.lastUpdated = new Date();
        return user.save();
      });
      
      console.log(`✅ Auto-applied RL suggestion: ${parameter} = ${nextSuggestion.suggestedValue}`);
    }
    
    // Log event
    await dbService.logEvent(userId, 'rl_suggestion_applied', {
      parameter: parameter,
      oldValue: currentValue,
      newValue: nextSuggestion?.suggestedValue,
      feedbackType: feedback.type,
      autoApplied: true
    });
    
    res.json({
      success: true,
      data: {
        feedbackId: feedbackEntry._id,
        reward: reward.value,
        currentValue: currentValue,
        updatedSettings: updatedSettings,
        
        // 🎯 RL-PREDICTED Next suggestion
        nextSuggestion: nextSuggestion ? {
          parameter: nextSuggestion.parameter,
          currentValue: nextSuggestion.currentValue,
          suggestedValue: nextSuggestion.suggestedValue,  // ← RL PREDICTED THIS
          reason: nextSuggestion.reason,
          confidence: nextSuggestion.confidence,
          shouldApply: nextSuggestion.shouldApply,
          qValue: nextSuggestion.qValue
        } : null,
        
        // Training stats
        trainingStats: rlTrainingResult ? {
          loss: rlTrainingResult.loss,
          epsilon: rlTrainingResult.epsilon,
          steps: rlTrainingResult.steps,
          currentQValue: rlTrainingResult.qValue
        } : null
      }
    });
  } catch (error) {
    console.error('Feedback processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== HELPER FUNCTIONS FOR SMART SUGGESTIONS =====

/**
 * Calculate enhanced reward with multiple components
 */
function calculateEnhancedReward(feedback, context) {
  const baseReward = {
    'positive': 1.0,
    'neutral': 0.0,
    'negative': -1.0
  }[feedback.type] || 0.0;
  
  // Rating bonus (if provided)
  const ratingBonus = feedback.rating 
    ? (feedback.rating - 3) * 0.2  // -0.4 to +0.4
    : 0;
  
  // Response time bonus (faster = stronger signal)
  const responseTimeBonus = feedback.responseTime && feedback.responseTime < 5000 ? 0.1 : 0;
  
  // Acceptance bonus
  const acceptanceBonus = feedback.accepted !== false ? 0.2 : -0.2;
  
  const totalReward = baseReward + ratingBonus + responseTimeBonus + acceptanceBonus;
  const normalized = Math.max(-1, Math.min(1, totalReward));
  
  return {
    value: totalReward,
    normalized: normalized,
    components: {
      directFeedback: baseReward,
      rating: ratingBonus,
      responseTime: responseTimeBonus,
      acceptance: acceptanceBonus
    }
  };
}

/**
 * Get next suggestion based on user feedback
 */
async function getNextSuggestion(userId, parameter, currentState, feedbackType) {
  try {
    // Call RL model to choose next action
    const rlResponse = await axios.post(`${PYTHON_RL_URL}/rl/choose-action`, {
      userId,
      parameter,
      state: currentState,
      context: {
        lastFeedback: feedbackType,  // Tell RL about last feedback
        avoidCurrent: feedbackType === 'negative'  // Avoid current if negative
      }
    }, { timeout: 5000 });
    
    const currentValue = currentState[parameter];
    const suggestedValue = rlResponse.data.action;
    const confidence = rlResponse.data.qValue || 0.5;
    
    // Determine if we should auto-apply
    const shouldAutoApply = (
      confidence > 0.7 &&           // High confidence
      feedbackType === 'negative'   // User was unhappy
    );
    
    return {
      parameter,
      currentValue,
      suggestedValue,
      reason: getReasonForSuggestion(parameter, currentValue, suggestedValue, feedbackType),
      confidence,
      shouldApply: shouldAutoApply,
      qValue: confidence,
      exploration: rlResponse.data.reasoning?.exploration || false
    };
    
  } catch (error) {
    console.error('Error getting RL suggestion:', error.message);
    
    // FALLBACK: Use rule-based suggestion
    return getRuleBasedSuggestion(parameter, currentState, feedbackType);
  }
}

/**
 * Generate human-readable reason for suggestion
 */
function getReasonForSuggestion(parameter, currentValue, suggestedValue, feedbackType) {
  const reasons = {
    targetSize: {
      increase: "Making buttons larger for easier interaction",
      decrease: "Making buttons more compact",
      same: "Button size seems optimal"
    },
    fontSize: {
      increase: "Increasing text size for better readability",
      decrease: "Making text more compact",
      same: "Text size seems perfect"
    },
    lineHeight: {
      increase: "Increasing line spacing for better readability",
      decrease: "Making content more compact",
      same: "Line spacing seems optimal"
    },
    theme: {
      change: "Trying a different theme that might suit you better",
      same: "Current theme seems to work well"
    },
    contrastMode: {
      change: "Adjusting contrast for better visibility",
      same: "Contrast level seems appropriate"
    },
    elementSpacing: {
      change: "Adjusting element spacing for better layout",
      same: "Spacing seems comfortable"
    }
  };
  
  const direction = getDirection(parameter, currentValue, suggestedValue);
  return reasons[parameter]?.[direction] || `Suggesting ${suggestedValue} based on your feedback`;
}

/**
 * Determine direction of change (increase/decrease/change/same)
 */
function getDirection(parameter, oldVal, newVal) {
  if (oldVal === newVal) return 'same';
  
  const numericParams = ['targetSize', 'lineHeight'];
  if (numericParams.includes(parameter)) {
    const oldNum = typeof oldVal === 'number' ? oldVal : parseFloat(oldVal) || 0;
    const newNum = typeof newVal === 'number' ? newVal : parseFloat(newVal) || 0;
    return newNum > oldNum ? 'increase' : 'decrease';
  }
  
  const ordinalParams = {
    fontSize: ['small', 'medium', 'large', 'x-large'],
    elementSpacing: ['compact', 'normal', 'wide']
  };
  
  if (ordinalParams[parameter]) {
    const scale = ordinalParams[parameter];
    const oldIdx = scale.indexOf(oldVal);
    const newIdx = scale.indexOf(newVal);
    if (oldIdx !== -1 && newIdx !== -1) {
      return newIdx > oldIdx ? 'increase' : 'decrease';
    }
  }
  
  return 'change';
}

/**
 * Rule-based fallback suggestion when RL is unavailable
 */
function getRuleBasedSuggestion(parameter, currentState, feedbackType) {
  const currentValue = currentState[parameter];
  
  // Define progression paths
  const progressions = {
    targetSize: [24, 28, 32, 36, 40, 44],
    fontSize: ['small', 'medium', 'large', 'x-large'],
    lineHeight: [1.2, 1.4, 1.5, 1.6, 1.8, 2.0],
    theme: ['light', 'dark', 'auto'],
    contrastMode: ['normal', 'high'],
    elementSpacing: ['compact', 'normal', 'wide']
  };
  
  const options = progressions[parameter] || [currentValue];
  const currentIndex = options.indexOf(currentValue);
  
  let suggestedValue;
  
  if (feedbackType === 'negative') {
    // User doesn't like current → try next option
    if (currentIndex !== -1 && currentIndex < options.length - 1) {
      suggestedValue = options[currentIndex + 1];  // Increase
    } else if (currentIndex > 0) {
      suggestedValue = options[currentIndex - 1];  // Decrease if at max
    } else {
      suggestedValue = options[Math.floor(options.length / 2)]; // Middle
    }
  } else {
    // User likes current → keep same
    suggestedValue = currentValue;
  }
  
  return {
    parameter,
    currentValue,
    suggestedValue,
    reason: getReasonForSuggestion(parameter, currentValue, suggestedValue, feedbackType),
    confidence: 0.5,
    shouldApply: false,
    source: 'rule-based-fallback'
  };
}

/**
 * GET /api/users/:userId/feedback
 * Get user feedback history
 */
app.get('/api/users/:userId/feedback', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const { Feedback } = require('./mongodb/schemas');
    const feedbackList = await Feedback.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    res.json({
      success: true,
      data: feedbackList
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ANALYTICS ENDPOINTS
// =====================================================

/**
 * GET /api/users/:userId/analytics
 * Get user analytics and insights
 */
app.get('/api/users/:userId/analytics', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    const analytics = await dbService.getUserAnalytics(userId, days);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/dashboard-data
 * Get all data needed for dashboard in one call
 */
app.get('/api/users/:userId/dashboard-data', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Fetch all data in parallel
    const [user, history, undoRedoStatus, analytics] = await Promise.all([
      dbService.getUser(userId),
      dbService.getSettingsHistory(userId, 20),
      dbService.getUndoRedoStatus(userId),
      dbService.getUserAnalytics(userId, 7)
    ]);
    
    res.json({
      success: true,
      data: {
        user: {
          userId: user.userId,
          currentSettings: user.currentSettings,
          mlProfile: user.mlProfile,
          manualOverrides: Object.fromEntries(user.manualOverrides),
          dashboardSettings: user.dashboardSettings
        },
        history: history.map(h => ({
          id: h._id,
          parameter: h.change.parameter,
          oldValue: h.change.oldValue,
          newValue: h.change.newValue,
          source: h.change.source,
          timestamp: h.timestamp,
          isUndone: h.isUndone
        })),
        undoRedoStatus,
        analytics
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// DASHBOARD SETTINGS ENDPOINTS
// =====================================================

/**
 * PUT /api/users/:userId/dashboard-settings
 * Update dashboard preferences
 */
app.put('/api/users/:userId/dashboard-settings', async (req, res) => {
  try {
    const { userId } = req.params;
    const { settings } = req.body;
    
    const user = await dbService.getUser(userId);
    user.dashboardSettings = { ...user.dashboardSettings, ...settings };
    await user.save();
    
    res.json({
      success: true,
      data: user.dashboardSettings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// BATCH OPERATIONS
// =====================================================

/**
 * POST /api/batch/users/:userId/apply-optimizations
 * Apply multiple optimizations at once (from your optimization engine)
 */
app.post('/api/batch/users/:userId/apply-optimizations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { optimizations, source = 'ml_profile' } = req.body;
    
    // optimizations: [{ parameter, value }, ...]
    const settings = optimizations.reduce((acc, opt) => {
      acc[opt.parameter] = opt.value;
      return acc;
    }, {});
    
    const updatedSettings = await dbService.updateUserSettings(userId, settings, source);
    
    // Log event
    await dbService.logEvent(userId, 'optimization_triggered', {
      optimizationsCount: optimizations.length,
      source,
      success: true
    });
    
    res.json({
      success: true,
      data: {
        appliedSettings: updatedSettings,
        optimizationsCount: optimizations.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// HEALTH & INFO
// =====================================================

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// =====================================================
// ADDITIONAL ENDPOINTS
// =====================================================

/**
 * POST /api/users
 * Create new user
 */
app.post('/api/users', async (req, res) => {
  try {
    const { userId, name, email } = req.body;
    
    // Check if user exists
    let user = await dbService.getUser(userId);
    if (user) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }
    
    // Create user via dbService (it auto-creates on first interaction)
    user = await dbService.getUser(userId);
    
    res.json({
      success: true,
      data: {
        userId: user.userId,
        created: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users
 * Get all users
 */
app.get('/api/users', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const users = await User.find({}).select('userId currentSettings lastActive');
    
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/qtables
 * Update Q-table (alias for existing endpoint)
 */
app.post('/api/users/:userId/qtables', async (req, res) => {
  try {
    const { userId } = req.params;
    const { parameter, state, action, reward, nextState } = req.body;
    
    const qtable = await dbService.updateQValue(
      userId,
      parameter,
      state,
      action,
      reward,
      nextState
    );
    
    res.json({
      success: true,
      data: qtable
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/feedback
 * Get all feedback across users
 */
app.get('/api/feedback', async (req, res) => {
  try {
    const Feedback = mongoose.model('Feedback');
    const feedback = await Feedback.find({})
      .sort({ timestamp: -1 })
      .limit(100);
    
    res.json({
      success: true,
      data: feedback,
      count: feedback.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/settings-history
 * Get settings history
 */
app.get('/api/users/:userId/settings-history', async (req, res) => {
  try {
    const { userId } = req.params;
    const SettingsHistory = mongoose.model('SettingsHistory');
    
    const history = await SettingsHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/:userId/events
 * Log optimization event
 */
app.post('/api/users/:userId/events', async (req, res) => {
  try {
    const { userId } = req.params;
    const { eventType, parameter, oldValue, newValue, metadata } = req.body;
    
    const event = await dbService.logEvent(userId, eventType, {
      parameter,
      oldValue,
      newValue,
      ...metadata
    });
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/events
 * Get optimization events
 */
app.get('/api/users/:userId/events', async (req, res) => {
  try {
    const { userId } = req.params;
    const OptimizationEvent = mongoose.model('OptimizationEvent');
    
    const events = await OptimizationEvent.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100);
    
    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/stats
 * Get user statistics
 */
app.get('/api/users/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const Feedback = mongoose.model('Feedback');
    const OptimizationEvent = mongoose.model('OptimizationEvent');
    
    const feedbackCount = await Feedback.countDocuments({ userId });
    const eventsCount = await OptimizationEvent.countDocuments({ userId });
    const avgRating = await Feedback.aggregate([
      { $match: { userId } },
      { $group: { _id: null, avg: { $avg: '$feedback.rating' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        userId,
        totalFeedback: feedbackCount,
        totalEvents: eventsCount,
        averageRating: avgRating[0]?.avg || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/category-wise
 * Get category-wise statistics
 */
app.get('/api/stats/category-wise', async (req, res) => {
  try {
    const Feedback = mongoose.model('Feedback');
    
    const stats = await Feedback.aggregate([
      {
        $group: {
          _id: '$optimization.parameter',
          count: { $sum: 1 },
          avgRating: { $avg: '$feedback.rating' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/user-wise
 * Get user-wise statistics
 */
app.get('/api/stats/user-wise', async (req, res) => {
  try {
    const Feedback = mongoose.model('Feedback');
    
    const stats = await Feedback.aggregate([
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          avgRating: { $avg: '$feedback.rating' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /
 * API info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Adaptive UI Optimization API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      feedback: '/api/feedback',
      health: '/api/health',
      stats: '/api/stats'
    },
    documentation: 'See README.md for full API documentation'
  });
});

// =====================================================
// ERROR HANDLING
// =====================================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// =====================================================
// START SERVER
// =====================================================

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/optimization-engine';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${MONGODB_URI.split('/').pop()}`);
    app.listen(PORT, () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`);
      console.log(`📱 Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.error('💡 Make sure MongoDB is running and MONGODB_URI is correct');
    process.exit(1);
  });

module.exports = app;
