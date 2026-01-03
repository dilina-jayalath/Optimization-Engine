/**
 * Setting Ladders Configuration
 * 
 * Defines ordered discrete values for each tunable setting.
 * Used for bounded search and directional feedback.
 */

const SETTING_LADDERS = {
  // Typography
  fontSize: {
    key: 'visual.fontSize',
    values: ['small', 'medium', 'large', 'xlarge'],
    mapping: {
      small: '14px',
      medium: '16px',
      large: '18px',
      xlarge: '20px'
    },
    default: 'medium',
    category: 'typography'
  },

  lineHeight: {
    key: 'visual.lineHeight',
    values: ['compact', 'normal', 'relaxed', 'loose'],
    mapping: {
      compact: 1.3,
      normal: 1.5,
      relaxed: 1.7,
      loose: 2.0
    },
    default: 'normal',
    category: 'typography'
  },

  // Motor/Touch
  targetSize: {
    key: 'motor.targetSize',
    values: ['small', 'medium', 'large', 'xlarge'],
    mapping: {
      small: '40px',
      medium: '44px',
      large: '48px',
      xlarge: '52px'
    },
    default: 'medium',
    category: 'motor'
  },

  // Visual
  contrast: {
    key: 'visual.contrast',
    values: ['normal', 'high', 'maximum'],
    mapping: {
      normal: 'normal',
      high: 'high',
      maximum: 'maximum'
    },
    default: 'normal',
    category: 'visual'
  },

  // Spacing
  spacing: {
    key: 'layout.spacing',
    values: ['compact', 'normal', 'wide', 'xwide'],
    mapping: {
      compact: '6px',
      normal: '8px',
      wide: '12px',
      xwide: '16px'
    },
    default: 'normal',
    category: 'layout'
  },

  // Theme
  theme: {
    key: 'visual.theme',
    values: ['light', 'dark'],
    mapping: {
      light: 'light',
      dark: 'dark'
    },
    default: 'light',
    category: 'visual'
  }
};

/**
 * Trial Priority Configuration
 * Determines which settings to trial first
 */
const TRIAL_PRIORITIES = [
  'motor.targetSize',    // Highest priority - accessibility critical
  'visual.fontSize',     // High priority - affects readability
  'visual.contrast',     // Medium priority - affects visibility
  'layout.spacing',      // Lower priority - affects comfort
  'visual.lineHeight',   // Lower priority - fine-tuning
  'visual.theme'         // Lowest priority - preference
];

/**
 * Anomaly Scoring Weights
 * Used to detect if a trial change is causing problems
 */
const ANOMALY_WEIGHTS = {
  misclickRate: 0.3,      // Clicking wrong targets
  rageClicks: 0.25,       // Repeated frustrated clicks
  timeToClick: 0.2,       // Slower than usual
  formErrors: 0.15,       // Increased validation errors
  zoomEvents: 0.1         // User manually zooming
};

/**
 * Cooldown Configuration
 * Prevents rapid prompting
 */
const COOLDOWN_CONFIG = {
  minPromptInterval: 10 * 60 * 1000,        // 10 minutes between any prompts
  perSettingCooldown: 24 * 60 * 60 * 1000,  // 24 hours after dismiss
  maxPromptsPerSession: 1,                   // Only 1 prompt per session
  maxRetriesPerSetting: 2,                   // Max 2 retries to find preference
  evaluationWindow: 60 * 1000,               // 60 seconds to evaluate trial
  minClicksForEvaluation: 5                  // Min interactions before evaluating
};

/**
 * Helper Functions
 */

/**
 * Get ladder by setting key
 */
function getLadder(settingKey) {
  return Object.values(SETTING_LADDERS).find(ladder => ladder.key === settingKey);
}

/**
 * Get numeric value from ladder
 */
function getMappedValue(settingKey, discreteValue) {
  const ladder = getLadder(settingKey);
  if (!ladder) return null;
  return ladder.mapping[discreteValue];
}

/**
 * Get index in ladder
 */
function getValueIndex(settingKey, discreteValue) {
  const ladder = getLadder(settingKey);
  if (!ladder) return -1;
  return ladder.values.indexOf(discreteValue);
}

/**
 * Get next value in direction
 */
function getNextValue(settingKey, currentValue, direction) {
  const ladder = getLadder(settingKey);
  if (!ladder) return null;

  const currentIndex = ladder.values.indexOf(currentValue);
  if (currentIndex === -1) return null;

  let nextIndex;
  if (direction === 'increase' || direction === 'too_small') {
    nextIndex = Math.min(currentIndex + 1, ladder.values.length - 1);
  } else if (direction === 'decrease' || direction === 'too_big') {
    nextIndex = Math.max(currentIndex - 1, 0);
  } else {
    return null;
  }

  return ladder.values[nextIndex];
}

/**
 * Check if at ladder boundary
 */
function isAtBoundary(settingKey, discreteValue, direction) {
  const ladder = getLadder(settingKey);
  if (!ladder) return true;

  const currentIndex = ladder.values.indexOf(discreteValue);
  if (currentIndex === -1) return true;

  if (direction === 'increase' && currentIndex === ladder.values.length - 1) return true;
  if (direction === 'decrease' && currentIndex === 0) return true;

  return false;
}

module.exports = {
  SETTING_LADDERS,
  TRIAL_PRIORITIES,
  ANOMALY_WEIGHTS,
  COOLDOWN_CONFIG,
  getLadder,
  getMappedValue,
  getValueIndex,
  getNextValue,
  isAtBoundary
};
