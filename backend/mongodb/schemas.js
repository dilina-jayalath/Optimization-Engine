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
    font_size: { type: Number, default: 16 },
    line_height: { type: Number, default: 1.5 },
    theme: { type: String, default: 'light' },
    contrast_mode: { type: String, default: 'normal' },
    element_spacing_x: { type: Number, default: 8 },
    element_spacing_y: { type: Number, default: 8 },
    element_padding_x: { type: Number, default: 8 },
    element_padding_y: { type: Number, default: 8 },
    target_size: { type: Number, default: 32 },
    reduced_motion: { type: Boolean, default: false },
    tooltip_assist: { type: Boolean, default: false },
    layout_simplification: { type: Boolean, default: false },
    // Theme colors
    primary_color: { type: String, default: '#007bff' },
    primary_color_content: { type: String, default: '#ffffff' },
    secondary_color: { type: String, default: '#6c757d' },
    secondary_color_content: { type: String, default: '#ffffff' },
    accent_color: { type: String, default: '#28a745' },
    accent_color_content: { type: String, default: '#ffffff' }
  },
  
  // RL Suggested settings (auto-applied from RL model)
  rlSuggestedSettings: {
    font_size: { type: Number },
    line_height: { type: Number },
    theme: { type: String },
    contrast_mode: { type: String },
    element_spacing_x: { type: Number },
    element_spacing_y: { type: Number },
    element_padding_x: { type: Number },
    element_padding_y: { type: Number },
    target_size: { type: Number },
    reduced_motion: { type: Boolean },
    tooltip_assist: { type: Boolean },
    layout_simplification: { type: Boolean },
    primary_color: { type: String },
    primary_color_content: { type: String },
    secondary_color: { type: String },
    secondary_color_content: { type: String },
    accent_color: { type: String },
    accent_color_content: { type: String },
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
      enum: ['rl_optimization', 'user_manual', 'ml_profile', 'reset', 'undo', 'redo', 'user_revert'],
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
// 7. MANUAL SETTINGS SCHEMA (Week 4+)
// =====================================================
const manualSettingsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  enabled: {
    type: Boolean,
    default: true // If true, manual settings override AI
  },
  
  // UI Settings
  font_size: { type: Number, default: 16 },
  line_height: { type: Number, default: 1.5 },
  contrast_mode: { type: String, default: 'normal' }, // normal, high
  element_spacing_x: { type: Number, default: 8 },
  element_spacing_y: { type: Number, default: 8 },
  element_padding_x: { type: Number, default: 8 },
  element_padding_y: { type: Number, default: 8 },
  target_size: { type: Number, default: 44 },
  theme: { type: String, default: 'light' }, // light, dark
  reduced_motion: { type: Boolean, default: false },
  tooltip_assist: { type: Boolean, default: false },
  layout_simplification: { type: Boolean, default: false },
  
  // Colors
  primary_color: { type: String, default: '#007bff' },
  primary_color_content: { type: String, default: '#ffffff' },
  secondary_color: { type: String, default: '#6c757d' },
  secondary_color_content: { type: String, default: '#ffffff' },
  accent_color: { type: String, default: '#28a745' },
  accent_color_content: { type: String, default: '#ffffff' },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

manualSettingsSchema.index({ userId: 1 });

// =====================================================
// 8. TRIAL SCHEMA (Trial-Based System)
// =====================================================
const trialSchema = new mongoose.Schema({
  trialId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  sessionId: {
    type: String,
    required: true
  },
  
  settingKey: {
    type: String,
    required: true // e.g., 'visual.fontSize', 'motor.targetSize'
  },
  
  oldValue: {
    type: String,
    required: true // e.g., 'medium'
  },
  
  newValue: {
    type: String,
    required: true // e.g., 'large'
  },
  
  context: {
    pageType: String,     // 'checkout', 'product', 'home'
    deviceType: String,   // 'mobile', 'desktop', 'tablet'
    timeOfDay: String,    // 'morning', 'afternoon', 'evening'
    userSegment: String   // 'new', 'returning', 'power'
  },
  
  attemptNumber: {
    type: Number,
    default: 1 // 1st, 2nd, or 3rd attempt
  },
  
  // Evaluation
  status: {
    type: String,
    enum: ['active', 'accepted', 'reverted', 'awaiting_feedback', 'completed'],
    default: 'active'
  },
  
  startTime: {
    type: Date,
    default: Date.now
  },
  
  endTime: Date,
  
  // Anomaly metrics collected during trial
  metrics: {
    clickCount: { type: Number, default: 0 },
    misclickCount: { type: Number, default: 0 },
    rageClickCount: { type: Number, default: 0 },
    avgTimeToClick: { type: Number, default: 0 },
    formErrorCount: { type: Number, default: 0 },
    zoomEventCount: { type: Number, default: 0 },
    scrollDepth: { type: Number, default: 0 },
    dwellTime: { type: Number, default: 0 }
  },
  
  anomalyScore: {
    type: Number,
    default: 0
  },
  
  decision: {
    type: String,
    enum: ['accept', 'revert', 'prompt', 'pending'],
    default: 'pending'
  },
  
  promptedAt: Date,
  
  // Explicit feedback if prompt shown
  feedback: {
    given: { type: Boolean, default: false },
    type: { type: String, enum: ['like', 'dislike', 'manual'] },
    reason: { type: String, enum: ['too_big', 'too_small', 'other', 'dismiss', 'manual'] },
    timestamp: Date
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

trialSchema.index({ userId: 1, settingKey: 1, createdAt: -1 });
trialSchema.index({ sessionId: 1 });
trialSchema.index({ status: 1 });

// =====================================================
// 9. PREFERENCE STATE SCHEMA (Trial-Based System)
// =====================================================
const preferenceStateSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  settingKey: {
    type: String,
    required: true // e.g., 'visual.fontSize'
  },
  
  // Current state in ladder
  currentValue: {
    type: String,
    required: true // e.g., 'medium'
  },
  
  currentIndex: {
    type: Number,
    required: true // Index in ladder array
  },
  
  // Preference discovery
  preferredValue: String,    // Set when user confirms preference
  preferredIndex: Number,    // Index of preferred value
  
  locked: {
    type: Boolean,
    default: false // If true, don't change this setting anymore
  },
  
  // Trial history for this setting
  trialCount: {
    type: Number,
    default: 0
  },
  
  successfulTrials: {
    type: Number,
    default: 0
  },
  
  failedTrials: {
    type: Number,
    default: 0
  },
  
  // Cooldown management
  cooldownUntil: Date,       // Don't prompt before this time
  lastPromptAt: Date,        // Last time we asked for feedback
  lastTrialAt: Date,         // Last time we started a trial
  
  // Context-specific tracking
  negativeCountInContext: {
    type: Map,
    of: Number,
    default: new Map() // { 'checkout': 2, 'product': 0 }
  },
  
  // User engagement
  dismissCount: {
    type: Number,
    default: 0
  },
  
  feedbackCount: {
    type: Number,
    default: 0
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

preferenceStateSchema.index({ userId: 1, settingKey: 1 }, { unique: true });
preferenceStateSchema.index({ locked: 1 });

// =====================================================
// EXPORT MODELS
// =====================================================
const User = mongoose.model('User', userSchema);
const QTable = mongoose.model('QTable', qTableSchema);
const SettingsHistory = mongoose.model('SettingsHistory', settingsHistorySchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const OptimizationEvent = mongoose.model('OptimizationEvent', optimizationEventSchema);
const Session = mongoose.model('Session', sessionSchema);
const ManualSettings = mongoose.model('ManualSettings', manualSettingsSchema);
const Trial = mongoose.model('Trial', trialSchema);
const PreferenceState = mongoose.model('PreferenceState', preferenceStateSchema);

module.exports = {
  User,
  QTable,
  SettingsHistory,
  Feedback,
  OptimizationEvent,
  Session,
  ManualSettings,
  Trial,
  PreferenceState
};
