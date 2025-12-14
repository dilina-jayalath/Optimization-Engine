/**
 * NPM Package: MongoDB Integration Layer
 * 
 * This module provides MongoDB storage capabilities for the RL UI Personalization engine.
 * It acts as a bridge between the RL engine and MongoDB, handling all data persistence.
 * 
 * @package @yourorg/rl-ui-personalization
 */

const { User, QTable, SettingsHistory, Feedback, OptimizationEvent, Session } = require('./schemas');

class RLMongoDBService {
  constructor(options = {}) {
    this.options = {
      historyRetentionDays: options.historyRetentionDays || 90,
      maxHistoryPerUser: options.maxHistoryPerUser || 100,
      enableAnalytics: options.enableAnalytics !== false,
      batchSize: options.batchSize || 10
    };
  }

  // =====================================================
  // USER OPERATIONS
  // =====================================================

  /**
   * Get or create user
   */
  async getUser(userId) {
    try {
      let user = await User.findOne({ userId });
      
      if (!user) {
        user = await User.create({
          userId,
          currentSettings: {},
          mlProfile: {},
          manualOverrides: new Map(),
          dashboardSettings: {}
        });
      }
      
      // Update last active
      user.lastActive = new Date();
      await user.save();
      
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Update user's current settings
   */
  async updateUserSettings(userId, settings, source = 'rl_optimization') {
    try {
      const user = await this.getUser(userId);
      const oldSettings = { ...user.currentSettings };
      
      // Update settings
      user.currentSettings = { ...user.currentSettings, ...settings };
      user.updatedAt = new Date();
      await user.save();
      
      // Record history for undo/redo
      await this.recordSettingsHistory(userId, oldSettings, user.currentSettings, source);
      
      return user.currentSettings;
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }

  /**
   * Update ML profile
   */
  async updateMLProfile(userId, categoryWise, userWise, mergedProfile) {
    try {
      const user = await this.getUser(userId);
      
      user.mlProfile = {
        categoryWise,
        userWise,
        mergedProfile,
        lastUpdated: new Date()
      };
      
      await user.save();
      return user.mlProfile;
    } catch (error) {
      console.error('Error updating ML profile:', error);
      throw error;
    }
  }

  /**
   * Set manual override
   */
  async setManualOverride(userId, parameter, value, reason = 'user_preference') {
    try {
      const user = await this.getUser(userId);
      
      user.manualOverrides.set(parameter, {
        value,
        timestamp: new Date(),
        reason
      });
      
      // Also update current settings
      user.currentSettings[parameter] = value;
      user.updatedAt = new Date();
      await user.save();
      
      // Record in history
      await this.recordSettingsHistory(
        userId,
        { [parameter]: user.currentSettings[parameter] },
        { [parameter]: value },
        'user_manual'
      );
      
      return user;
    } catch (error) {
      console.error('Error setting manual override:', error);
      throw error;
    }
  }

  /**
   * Get user's manual overrides
   */
  async getManualOverrides(userId) {
    try {
      const user = await this.getUser(userId);
      return Object.fromEntries(user.manualOverrides);
    } catch (error) {
      console.error('Error getting manual overrides:', error);
      throw error;
    }
  }

  // =====================================================
  // Q-TABLE OPERATIONS
  // =====================================================

  /**
   * Get Q-table for a parameter
   */
  async getQTable(userId, parameter) {
    try {
      let qTable = await QTable.findOne({ userId, parameter });
      
      if (!qTable) {
        qTable = await QTable.create({
          userId,
          parameter,
          qValues: new Map(),
          visitCounts: new Map(),
          lastActions: new Map()
        });
      }
      
      return qTable;
    } catch (error) {
      console.error('Error getting Q-table:', error);
      throw error;
    }
  }

  /**
   * Update Q-value
   */
  async updateQValue(userId, parameter, state, action, value) {
    try {
      const qTable = await this.getQTable(userId, parameter);
      
      // Initialize state if not exists
      if (!qTable.qValues.has(state)) {
        qTable.qValues.set(state, new Map());
      }
      
      // Update Q-value
      qTable.qValues.get(state).set(action, value);
      
      // Update visit count
      if (!qTable.visitCounts.has(state)) {
        qTable.visitCounts.set(state, new Map());
      }
      const currentCount = qTable.visitCounts.get(state).get(action) || 0;
      qTable.visitCounts.get(state).set(action, currentCount + 1);
      
      // Update last action
      qTable.lastActions.set(state, action);
      
      // Update statistics
      qTable.totalUpdates += 1;
      qTable.updatedAt = new Date();
      
      await qTable.save();
      return qTable;
    } catch (error) {
      console.error('Error updating Q-value:', error);
      throw error;
    }
  }

  /**
   * Get best action for a state
   */
  async getBestAction(userId, parameter, state) {
    try {
      const qTable = await this.getQTable(userId, parameter);
      
      if (!qTable.qValues.has(state)) {
        return null;
      }
      
      const stateActions = qTable.qValues.get(state);
      let bestAction = null;
      let bestValue = -Infinity;
      
      for (const [action, value] of stateActions.entries()) {
        if (value > bestValue) {
          bestValue = value;
          bestAction = action;
        }
      }
      
      return { action: bestAction, value: bestValue };
    } catch (error) {
      console.error('Error getting best action:', error);
      throw error;
    }
  }

  /**
   * Export Q-table data
   */
  async exportQTable(userId, parameter) {
    try {
      const qTable = await this.getQTable(userId, parameter);
      
      return {
        parameter: qTable.parameter,
        qValues: Object.fromEntries(qTable.qValues),
        visitCounts: Object.fromEntries(qTable.visitCounts),
        lastActions: Object.fromEntries(qTable.lastActions),
        statistics: {
          totalUpdates: qTable.totalUpdates,
          totalReward: qTable.totalReward,
          averageReward: qTable.averageReward
        },
        updatedAt: qTable.updatedAt
      };
    } catch (error) {
      console.error('Error exporting Q-table:', error);
      throw error;
    }
  }

  // =====================================================
  // SETTINGS HISTORY (Undo/Redo)
  // =====================================================

  /**
   * Record settings change in history
   */
  async recordSettingsHistory(userId, oldSettings, newSettings, source) {
    try {
      // Find what changed
      const changes = [];
      for (const [param, newValue] of Object.entries(newSettings)) {
        const oldValue = oldSettings[param];
        if (oldValue !== newValue) {
          changes.push({
            parameter: param,
            oldValue,
            newValue
          });
        }
      }
      
      // Create history entries
      const historyEntries = changes.map(change => ({
        userId,
        change: { ...change, source },
        snapshot: { ...newSettings },
        context: {
          mlProfileVersion: 'v1',
          timestamp: new Date()
        },
        expiresAt: new Date(Date.now() + this.options.historyRetentionDays * 24 * 60 * 60 * 1000)
      }));
      
      if (historyEntries.length > 0) {
        await SettingsHistory.insertMany(historyEntries);
        
        // Clean up old history if exceeds limit
        await this.cleanupHistory(userId);
      }
      
      return historyEntries;
    } catch (error) {
      console.error('Error recording settings history:', error);
      throw error;
    }
  }

  /**
   * Get settings history for undo/redo
   */
  async getSettingsHistory(userId, limit = 50) {
    try {
      const history = await SettingsHistory.find({ userId, isUndone: false })
        .sort({ timestamp: -1 })
        .limit(limit);
      
      return history;
    } catch (error) {
      console.error('Error getting settings history:', error);
      throw error;
    }
  }

  /**
   * Undo last change
   */
  async undoLastChange(userId) {
    try {
      // Get last change that's not undone
      const lastChange = await SettingsHistory.findOne({ 
        userId, 
        isUndone: false 
      }).sort({ timestamp: -1 });
      
      if (!lastChange) {
        return { success: false, message: 'No changes to undo' };
      }
      
      // Mark as undone
      lastChange.isUndone = true;
      lastChange.undoneAt = new Date();
      await lastChange.save();
      
      // Get previous state
      const previousChange = await SettingsHistory.findOne({
        userId,
        isUndone: false,
        timestamp: { $lt: lastChange.timestamp }
      }).sort({ timestamp: -1 });
      
      const settingsToRestore = previousChange 
        ? previousChange.snapshot 
        : {}; // or default settings
      
      // Update user's current settings
      await this.updateUserSettings(userId, settingsToRestore, 'undo');
      
      return {
        success: true,
        restoredSettings: settingsToRestore,
        undoneChange: lastChange.change
      };
    } catch (error) {
      console.error('Error undoing change:', error);
      throw error;
    }
  }

  /**
   * Redo last undone change
   */
  async redoLastUndo(userId) {
    try {
      // Get last undone change
      const lastUndone = await SettingsHistory.findOne({ 
        userId, 
        isUndone: true 
      }).sort({ undoneAt: -1 });
      
      if (!lastUndone) {
        return { success: false, message: 'No changes to redo' };
      }
      
      // Mark as not undone
      lastUndone.isUndone = false;
      lastUndone.undoneAt = null;
      await lastUndone.save();
      
      // Restore the change
      await this.updateUserSettings(userId, lastUndone.snapshot, 'redo');
      
      return {
        success: true,
        restoredSettings: lastUndone.snapshot,
        redoneChange: lastUndone.change
      };
    } catch (error) {
      console.error('Error redoing change:', error);
      throw error;
    }
  }

  /**
   * Get undo/redo stack status
   */
  async getUndoRedoStatus(userId) {
    try {
      const canUndo = await SettingsHistory.countDocuments({ userId, isUndone: false }) > 0;
      const canRedo = await SettingsHistory.countDocuments({ userId, isUndone: true }) > 0;
      
      return { canUndo, canRedo };
    } catch (error) {
      console.error('Error getting undo/redo status:', error);
      throw error;
    }
  }

  /**
   * Clean up old history entries
   */
  async cleanupHistory(userId) {
    try {
      const count = await SettingsHistory.countDocuments({ userId });
      
      if (count > this.options.maxHistoryPerUser) {
        // Delete oldest entries
        const toDelete = count - this.options.maxHistoryPerUser;
        const oldestEntries = await SettingsHistory.find({ userId })
          .sort({ timestamp: 1 })
          .limit(toDelete)
          .select('_id');
        
        const idsToDelete = oldestEntries.map(e => e._id);
        await SettingsHistory.deleteMany({ _id: { $in: idsToDelete } });
      }
    } catch (error) {
      console.error('Error cleaning up history:', error);
    }
  }

  // =====================================================
  // FEEDBACK OPERATIONS
  // =====================================================

  /**
   * Record user feedback
   */
  async recordFeedback(userId, optimization, feedback, reward, context = {}) {
    try {
      const feedbackEntry = await Feedback.create({
        userId,
        optimization,
        feedback,
        reward,
        context
      });
      
      // Update Q-table based on feedback
      await this.updateQValue(
        userId,
        optimization.parameter,
        'current', // You can make this more sophisticated
        optimization.newValue,
        reward.value
      );
      
      return feedbackEntry;
    } catch (error) {
      console.error('Error recording feedback:', error);
      throw error;
    }
  }

  /**
   * Get unprocessed feedback
   */
  async getUnprocessedFeedback(limit = 100) {
    try {
      return await Feedback.find({ processed: false })
        .limit(limit)
        .sort({ createdAt: 1 });
    } catch (error) {
      console.error('Error getting unprocessed feedback:', error);
      throw error;
    }
  }

  /**
   * Mark feedback as processed
   */
  async markFeedbackProcessed(feedbackId) {
    try {
      await Feedback.findByIdAndUpdate(feedbackId, {
        processed: true,
        processedAt: new Date()
      });
    } catch (error) {
      console.error('Error marking feedback as processed:', error);
      throw error;
    }
  }

  // =====================================================
  // ANALYTICS & EVENTS
  // =====================================================

  /**
   * Log optimization event
   */
  async logEvent(userId, eventType, details = {}, metrics = {}) {
    try {
      if (!this.options.enableAnalytics) return;
      
      await OptimizationEvent.create({
        userId,
        eventType,
        details,
        metrics,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId, days = 30) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const events = await OptimizationEvent.find({
        userId,
        timestamp: { $gte: since }
      }).sort({ timestamp: -1 });
      
      const feedback = await Feedback.find({
        userId,
        'feedback.timestamp': { $gte: since }
      });
      
      return {
        totalEvents: events.length,
        eventsByType: this._groupBy(events, 'eventType'),
        feedbackStats: {
          total: feedback.length,
          positive: feedback.filter(f => f.feedback.type === 'positive').length,
          neutral: feedback.filter(f => f.feedback.type === 'neutral').length,
          negative: feedback.filter(f => f.feedback.type === 'negative').length,
          averageRating: this._average(feedback.map(f => f.feedback.rating).filter(r => r))
        },
        recentEvents: events.slice(0, 20)
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  _groupBy(array, key) {
    return array.reduce((result, item) => {
      const group = item[key];
      result[group] = (result[group] || 0) + 1;
      return result;
    }, {});
  }

  _average(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }
}

module.exports = RLMongoDBService;
