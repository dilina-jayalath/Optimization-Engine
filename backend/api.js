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
const RLMongoDBService = require('./mongodb/service');

const app = express();
const dbService = new RLMongoDBService();

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
 * Get best action for current state
 */
app.get('/api/users/:userId/qtables/:parameter/best-action', async (req, res) => {
  try {
    const { userId, parameter } = req.params;
    const { state } = req.query;
    
    const result = await dbService.getBestAction(userId, parameter, state || 'current');
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// FEEDBACK ENDPOINTS
// =====================================================

/**
 * POST /api/users/:userId/feedback
 * Submit user feedback
 */
app.post('/api/users/:userId/feedback', async (req, res) => {
  try {
    const { userId } = req.params;
    const { optimization, feedback, context } = req.body;
    
    // Calculate reward based on feedback
    const rewardValue = {
      'positive': 1.0,
      'neutral': 0.0,
      'negative': -1.0
    }[feedback.type];
    
    const reward = {
      value: rewardValue,
      normalized: rewardValue,
      components: {
        directFeedback: rewardValue,
        timeToFeedback: 0,
        usagePattern: 0
      }
    };
    
    const feedbackEntry = await dbService.recordFeedback(
      userId,
      optimization,
      feedback,
      reward,
      context
    );
    
    // Log event
    await dbService.logEvent(userId, 'optimization_' + (feedback.type === 'positive' ? 'accepted' : 'rejected'), {
      parameter: optimization.parameter,
      value: optimization.newValue,
      feedbackType: feedback.type
    });
    
    res.json({
      success: true,
      data: {
        feedbackId: feedbackEntry._id,
        reward: reward.value
      }
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
