/**
 * Adaptive Optimizer
 * 
 * Main optimization engine that combines:
 * - ML predictions
 * - RL Q-Learning
 * - User feedback
 * - Adaptive optimization logic
 */

const RLEngine = require('./RLEngine');
const MLIntegration = require('./MLIntegration');
const RewardCalculator = require('./RewardCalculator');

class AdaptiveOptimizer {
  constructor(options = {}) {
    this.userId = options.userId;
    this.apiUrl = options.apiUrl || 'http://localhost:5000/api';
    
    // Initialize components
    this.rl = new RLEngine(options.rlConfig);
    this.ml = new MLIntegration();
    this.rewardCalc = new RewardCalculator(options.rewardConfig);
    
    // Current state
    this.currentSettings = {};
    this.lastOptimization = null;
    this.optimizationHistory = [];
    
    // Callbacks
    this.onSettingsChange = options.onSettingsChange || (() => {});
    this.onOptimizationComplete = options.onOptimizationComplete || (() => {});
  }

  /**
   * Initialize optimizer
   */
  async initialize() {
    try {
      // Load user data from backend
      const response = await fetch(`${this.apiUrl}/users/${this.userId}`);
      const result = await response.json();
      
      if (result.success) {
        this.currentSettings = result.data.currentSettings;
        
        // Load Q-tables
        const qtablesResponse = await fetch(`${this.apiUrl}/users/${this.userId}/qtables`);
        const qtablesResult = await qtablesResponse.json();
        
        if (qtablesResult.success) {
          const qtablesData = {};
          qtablesResult.data.forEach(qt => {
            qtablesData[qt.parameter] = qt.qValues;
          });
          this.rl.loadQTables(qtablesData);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      return false;
    }
  }

  /**
   * Load ML profiles
   */
  async loadMLProfiles(categoryWisePath, userWisePath) {
    try {
      await this.ml.loadProfiles(categoryWisePath, userWisePath);
      
      // Send to backend
      await fetch(`${this.apiUrl}/users/${this.userId}/ml-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryWise: this.ml.categoryWiseProfile,
          userWise: this.ml.userWiseProfile,
          mergedProfile: this.ml.mergedProfile
        })
      });
      
      return this.ml.mergedProfile;
    } catch (error) {
      console.error('Error loading ML profiles:', error);
      throw error;
    }
  }

  /**
   * Run optimization
   */
  async optimize() {
    if (!this.ml.isLoaded()) {
      throw new Error('ML profiles not loaded. Call loadMLProfiles() first.');
    }
    
    const optimizations = {};
    const mlSuggestions = this.ml.getAllSuggestions();
    
    // For each parameter, choose action using RL
    for (const parameter of this.rl.parameters) {
      const mlSuggestion = mlSuggestions[parameter];
      const action = this.rl.chooseAction(parameter, 'current', mlSuggestion);
      
      if (action !== null) {
        optimizations[parameter] = action;
      }
    }
    
    // Store last optimization
    this.lastOptimization = {
      timestamp: new Date(),
      optimizations,
      mlConfidence: this.ml.getConfidence()
    };
    
    // Apply settings
    await this.applySettings(optimizations);
    
    // Callback
    this.onOptimizationComplete(optimizations);
    
    return optimizations;
  }

  /**
   * Apply settings
   */
  async applySettings(settings) {
    try {
      // Update current settings
      this.currentSettings = { ...this.currentSettings, ...settings };
      
      // Send to backend
      const response = await fetch(`${this.apiUrl}/users/${this.userId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          source: 'rl_optimization'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Callback
        this.onSettingsChange(this.currentSettings);
      }
      
      return result;
    } catch (error) {
      console.error('Error applying settings:', error);
      throw error;
    }
  }

  /**
   * Submit user feedback
   */
  async submitFeedback(feedbackType, context = {}) {
    if (!this.lastOptimization) {
      throw new Error('No optimization to provide feedback for');
    }
    
    const feedback = {
      type: feedbackType, // 'positive', 'neutral', 'negative'
      timestamp: new Date(),
      ...context
    };
    
    // Calculate reward
    const reward = this.rewardCalc.calculateReward(feedback, context);
    
    // Update Q-tables
    for (const [parameter, value] of Object.entries(this.lastOptimization.optimizations)) {
      this.rl.updateQValue(parameter, 'current', value, reward.value);
    }
    
    // Decay exploration rate
    this.rl.decayExploration();
    
    // Send to backend
    try {
      await fetch(`${this.apiUrl}/users/${this.userId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optimization: this.lastOptimization,
          feedback,
          reward,
          context
        })
      });
      
      // Sync Q-tables to backend
      await this.syncQTables();
      
      return { success: true, reward: reward.value };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  /**
   * Manual override
   */
  async setManualOverride(parameter, value, reason = 'user_preference') {
    try {
      const response = await fetch(`${this.apiUrl}/users/${this.userId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameter, value, reason })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.currentSettings[parameter] = value;
        this.onSettingsChange(this.currentSettings);
      }
      
      return result;
    } catch (error) {
      console.error('Error setting manual override:', error);
      throw error;
    }
  }

  /**
   * Undo last change
   */
  async undo() {
    try {
      const response = await fetch(`${this.apiUrl}/users/${this.userId}/undo`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.currentSettings = result.restoredSettings;
        this.onSettingsChange(this.currentSettings);
      }
      
      return result;
    } catch (error) {
      console.error('Error undoing:', error);
      throw error;
    }
  }

  /**
   * Redo last undo
   */
  async redo() {
    try {
      const response = await fetch(`${this.apiUrl}/users/${this.userId}/redo`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.currentSettings = result.restoredSettings;
        this.onSettingsChange(this.currentSettings);
      }
      
      return result;
    } catch (error) {
      console.error('Error redoing:', error);
      throw error;
    }
  }

  /**
   * Sync Q-tables to backend
   */
  async syncQTables() {
    const qtables = this.rl.exportQTables();
    
    for (const [parameter, qValues] of Object.entries(qtables)) {
      for (const [state, actions] of Object.entries(qValues)) {
        for (const [action, value] of Object.entries(actions)) {
          await fetch(`${this.apiUrl}/users/${this.userId}/qtables/${parameter}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state, action, value })
          });
        }
      }
    }
  }

  /**
   * Get current settings
   */
  getCurrentSettings() {
    return { ...this.currentSettings };
  }

  /**
   * Get Q-Learning statistics
   */
  getStatistics() {
    return this.rl.getStatistics();
  }

  /**
   * Get ML summary
   */
  getMLSummary() {
    return this.ml.getSummary();
  }

  /**
   * Reset everything
   */
  async reset() {
    this.rl.reset();
    this.currentSettings = {};
    this.lastOptimization = null;
    this.optimizationHistory = [];
    
    await fetch(`${this.apiUrl}/users/${this.userId}/reset`, {
      method: 'POST'
    });
  }
}

module.exports = AdaptiveOptimizer;
