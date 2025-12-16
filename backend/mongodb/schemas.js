/**
 * MongoDB Schemas for RL UI Personalization
 * 
 * This file contains all MongoDB schemas for storing:
 * - User profiles and preferences
 * - Q-tables for reinforcement learning
 * - Settings history with undo/redo capability
 * - Feedback and optimization events
 */

const mongoose = require('mongoose');

// =====================================================
// 1. USER SCHEMA
// =====================================================
const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Current active settings
  currentSettings: {
    fontSize: { type: String, default: 'medium' },
    lineHeight: { type: Number, default: 1.5 },
    theme: { type: String, default: 'light' },
    contrastMode: { type: String, default: 'normal' },
    elementSpacing: { type: String, default: 'normal' },
    targetSize: { type: Number, default: 32 }
  },
  
  // RL Suggested settings (auto-applied from RL model)
  rlSuggestedSettings: {
    fontSize: { type: String },
    lineHeight: { type: Number },
    theme: { type: String },
    contrastMode: { type: String },
    elementSpacing: { type: String },
    targetSize: { type: Number },
    lastUpdated: { type: Date }
  },
  
  // ML profile (from your optimization engine)
  mlProfile: {
    categoryWise: { type: Object, default: {} },
    userWise: { type: Object, default: {} },
    mergedProfile: { type: Object, default: {} },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // User preferences and overrides
  manualOverrides: {
    type: Map,
    of: {
      value: mongoose.Schema.Types.Mixed,
      timestamp: Date,
      reason: String // 'user_preference', 'undo', 'reset'
    },
    default: new Map()
  },
  
  // Dashboard preferences
  dashboardSettings: {
    autoOptimize: { type: Boolean, default: true },
    notificationsEnabled: { type: Boolean, default: true },
    feedbackFrequency: { type: String, default: 'moderate' }, // low, moderate, high
    privacyMode: { type: String, default: 'standard' } // minimal, standard, full
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

// Index for queries
userSchema.index({ userId: 1, updatedAt: -1 });

// =====================================================
// 2. Q-TABLE SCHEMA
// =====================================================
const qTableSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  parameter: {
    type: String,
    required: true // 'fontSize', 'theme', 'lineHeight', etc.
  },
  
  // Q-values: { state: { action: value } }
  qValues: {
    type: Map,
    of: {
      type: Map,
      of: Number
    },
    default: new Map()
  },
  
  // Visit counts for each state-action pair
  visitCounts: {
    type: Map,
    of: {
      type: Map,
      of: Number
    },
    default: new Map()
  },
  
  // Last action taken for each state
  lastActions: {
    type: Map,
    of: String,
    default: new Map()
  },
  
  // Learning parameters
  learningRate: { type: Number, default: 0.1 }, // alpha
  discountFactor: { type: Number, default: 0.9 }, // gamma
  explorationRate: { type: Number, default: 0.2 }, // epsilon
  
  // Statistics
  totalUpdates: { type: Number, default: 0 },
  totalReward: { type: Number, default: 0 },
  averageReward: { type: Number, default: 0 },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
qTableSchema.index({ userId: 1, parameter: 1 }, { unique: true });

// =====================================================
// 3. SETTINGS HISTORY SCHEMA (for Undo/Redo)
// =====================================================
const settingsHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // The change that was made
  change: {
    parameter: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed, required: true },
    source: { 
      type: String, 
      enum: ['rl_optimization', 'user_manual', 'ml_profile', 'reset', 'undo', 'redo'],
      required: true 
    }
  },
  
  // Complete snapshot of all settings at this point
  snapshot: {
    type: Object,
    required: true
  },
  
  // Context
  context: {
    mlProfileVersion: String,
    qTableState: String, // Hash or version of Q-table
    userAgent: String,
    sessionId: String
  },
  
  // Undo/Redo tracking
  isUndone: { type: Boolean, default: false },
  undoneAt: { type: Date },
  
  // Metadata
  timestamp: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date } // TTL for automatic cleanup
});

// Compound index for efficient history queries
settingsHistorySchema.index({ userId: 1, timestamp: -1 });
settingsHistorySchema.index({ userId: 1, isUndone: 1, timestamp: -1 });

// TTL index to auto-delete old history (e.g., after 90 days)
settingsHistorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// =====================================================
// 4. FEEDBACK SCHEMA
// =====================================================
const feedbackSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // What was being optimized
  optimization: {
    parameter: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed, required: true },
    suggestedBy: { type: String, enum: ['rl', 'ml', 'system', 'user_manual'], required: true }
  },
  
  // User's feedback
  feedback: {
    type: { type: String, enum: ['positive', 'neutral', 'negative'], required: true },
    rating: { type: Number, min: 1, max: 5 }, // Optional 1-5 rating
    comment: String,
    timestamp: { type: Date, default: Date.now }
  },
  
  // Calculated reward
  reward: {
    value: { type: Number, required: true },
    normalized: { type: Number }, // -1 to 1
    components: {
      directFeedback: Number,
      timeToFeedback: Number, // How long user took to respond
      usagePattern: Number // Did they keep using it?
    }
  },
  
  // Context at the time of feedback
  context: {
    sessionDuration: Number, // milliseconds
    interactionCount: Number,
    deviceType: String,
    timeOfDay: String,
    pageUrl: String
  },
  
  // Processing status
  processed: { type: Boolean, default: false },
  processedAt: { type: Date },
  
  // Metadata
  createdAt: { type: Date, default: Date.now }
});

feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ processed: 1, createdAt: 1 });

// =====================================================
// 5. OPTIMIZATION EVENT SCHEMA
// =====================================================
const optimizationEventSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  eventType: {
    type: String,
    enum: [
      'profile_loaded',
      'optimization_triggered',
      'optimization_applied',
      'optimization_rejected',
      'rl_suggestion_applied',
      'manual_override',
      'reset',
      'undo',
      'redo'
    ],
    required: true
  },
  
  // Event details
  details: {
    parameter: String,
    value: mongoose.Schema.Types.Mixed,
    source: String,
    success: Boolean,
    error: String
  },
  
  // Performance metrics
  metrics: {
    loadTime: Number,
    computeTime: Number,
    renderTime: Number
  },
  
  // Metadata
  timestamp: { type: Date, default: Date.now, index: true },
  sessionId: String,
  userAgent: String
});

optimizationEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
optimizationEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

// =====================================================
// 6. SESSION SCHEMA (Optional - for analytics)
// =====================================================
const sessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Session info
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  duration: { type: Number }, // milliseconds
  
  // Settings at session start and end
  settingsSnapshot: {
    start: Object,
    end: Object
  },
  
  // Activity during session
  activity: {
    optimizationsShown: { type: Number, default: 0 },
    optimizationsAccepted: { type: Number, default: 0 },
    optimizationsRejected: { type: Number, default: 0 },
    manualChanges: { type: Number, default: 0 },
    undoActions: { type: Number, default: 0 },
    interactions: { type: Number, default: 0 }
  },
  
  // Device and context
  device: {
    type: String,
    userAgent: String,
    screenSize: String,
    platform: String
  },
  
  // Metadata
  isActive: { type: Boolean, default: true }
});

sessionSchema.index({ userId: 1, startTime: -1 });
sessionSchema.index({ sessionId: 1 });

// =====================================================
// EXPORT MODELS
// =====================================================
const User = mongoose.model('User', userSchema);
const QTable = mongoose.model('QTable', qTableSchema);
const SettingsHistory = mongoose.model('SettingsHistory', settingsHistorySchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const OptimizationEvent = mongoose.model('OptimizationEvent', optimizationEventSchema);
const Session = mongoose.model('Session', sessionSchema);

module.exports = {
  User,
  QTable,
  SettingsHistory,
  Feedback,
  OptimizationEvent,
  Session
};
