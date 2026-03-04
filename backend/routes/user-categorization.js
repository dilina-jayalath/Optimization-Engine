// backend/routes/user-categorization.js
// Categorize users based on WCAG accessibility needs

const express = require('express');
const router = express.Router();

/**
 * WCAG User Categories
 * Based on Web Content Accessibility Guidelines
 */
const WCAG_CATEGORIES = {
  VISION_IMPAIRED: {
    name: 'Vision Impaired',
    wcagLevel: 'AA',
    needs: ['high_contrast', 'large_fonts', 'clear_spacing'],
    settings: {
      theme: 'dark',
      fontSize: 'x-large',
      contrast: 'high',
      lineHeight: 1.8,
      spacing: 'relaxed',
      targetSize: 48,
      primaryColor: '#ffffff',
      accentColor: '#00ff00'
    },
    priority: ['fontSize', 'contrast', 'targetSize', 'theme']
  },
  
  MOTOR_IMPAIRED: {
    name: 'Motor Impaired',
    wcagLevel: 'AA',
    needs: ['large_targets', 'generous_spacing', 'reduced_motion'],
    settings: {
      targetSize: 56,
      spacing: 'relaxed',
      reducedMotion: true,
      fontSize: 'large',
      lineHeight: 1.8
    },
    priority: ['targetSize', 'spacing', 'reducedMotion']
  },
  
  COGNITIVE_NEEDS: {
    name: 'Cognitive Needs',
    wcagLevel: 'AAA',
    needs: ['simple_layout', 'clear_text', 'consistent_interface'],
    settings: {
      fontSize: 'large',
      lineHeight: 2.0,
      spacing: 'relaxed',
      contrast: 'high',
      theme: 'light',
      reducedMotion: true
    },
    priority: ['fontSize', 'lineHeight', 'spacing', 'contrast']
  },
  
  ELDERLY: {
    name: 'Elderly User',
    wcagLevel: 'AA',
    needs: ['readable_text', 'easy_interaction', 'clear_interface'],
    settings: {
      fontSize: 'x-large',
      targetSize: 52,
      lineHeight: 1.8,
      contrast: 'enhanced',
      spacing: 'comfortable',
      reducedMotion: true
    },
    priority: ['fontSize', 'targetSize', 'lineHeight', 'contrast']
  },
  
  STANDARD: {
    name: 'Standard User',
    wcagLevel: 'A',
    needs: ['general_usability'],
    settings: {
      fontSize: 'medium',
      targetSize: 44,
      lineHeight: 1.5,
      contrast: 'normal',
      spacing: 'normal',
      theme: 'light'
    },
    priority: ['theme', 'fontSize']
  }
};

/**
 * Analyze user behavior to determine category
 */
function analyzeUserCategory(behaviorData) {
  const scores = {
    VISION_IMPAIRED: 0,
    MOTOR_IMPAIRED: 0,
    COGNITIVE_NEEDS: 0,
    ELDERLY: 0,
    STANDARD: 0
  };

  // Analysis based on user feedback patterns
  if (behaviorData.preferredFontSize === 'x-large' || behaviorData.preferredFontSize === 'large') {
    scores.VISION_IMPAIRED += 2;
    scores.ELDERLY += 1;
  }

  if (behaviorData.preferredTargetSize > 48) {
    scores.MOTOR_IMPAIRED += 2;
    scores.ELDERLY += 1;
  }

  if (behaviorData.preferredContrast === 'high') {
    scores.VISION_IMPAIRED += 2;
    scores.COGNITIVE_NEEDS += 1;
  }

  if (behaviorData.preferredReducedMotion === true) {
    scores.MOTOR_IMPAIRED += 1;
    scores.COGNITIVE_NEEDS += 1;
    scores.ELDERLY += 1;
  }

  if (behaviorData.preferredSpacing === 'relaxed') {
    scores.COGNITIVE_NEEDS += 1;
    scores.ELDERLY += 1;
  }

  // Multiple high preferences suggest elderly or complex needs
  const highPreferences = Object.values(behaviorData).filter(v => 
    v === 'x-large' || v === 'high' || v > 48
  ).length;

  if (highPreferences >= 3) {
    scores.ELDERLY += 2;
  }

  // Find highest score
  const category = Object.keys(scores).reduce((a, b) => 
    scores[a] > scores[b] ? a : b
  );

  return scores[category] > 0 ? category : 'STANDARD';
}

/**
 * POST /api/user-categorization/analyze
 * Analyze user and determine their WCAG category
 */
router.post('/analyze', async (req, res) => {
  try {
    const { userId, feedbackHistory, currentSettings } = req.body;

    console.log(`\n [USER CATEGORIZATION] Analyzing user: ${userId}`);

    // Analyze feedback history to determine preferences
    const behaviorData = {
      preferredFontSize: 'medium',
      preferredTargetSize: 44,
      preferredContrast: 'normal',
      preferredReducedMotion: false,
      preferredSpacing: 'normal',
      preferredTheme: 'light'
    };

    // Extract preferences from feedback history
    if (feedbackHistory && feedbackHistory.length > 0) {
      const positiveFeedback = feedbackHistory.filter(f => f.feedback === 'positive');
      
      // Find most positively rated settings
      const fontSizes = positiveFeedback.filter(f => f.settingKey === 'fontSize' || f.settingKey === 'font_size');
      if (fontSizes.length > 0) {
        behaviorData.preferredFontSize = fontSizes[fontSizes.length - 1].newValue;
      }

      const targetSizes = positiveFeedback.filter(f => f.settingKey === 'targetSize' || f.settingKey === 'target_size');
      if (targetSizes.length > 0) {
        const lastTarget = targetSizes[targetSizes.length - 1].newValue;
        behaviorData.preferredTargetSize = typeof lastTarget === 'number' ? lastTarget : parseInt(lastTarget);
      }

      const contrasts = positiveFeedback.filter(f => f.settingKey === 'contrast');
      if (contrasts.length > 0) {
        behaviorData.preferredContrast = contrasts[contrasts.length - 1].newValue;
      }
    }

    // Use current settings if no history
    if (currentSettings) {
      behaviorData.preferredFontSize = currentSettings.fontSize || behaviorData.preferredFontSize;
      behaviorData.preferredTargetSize = currentSettings.targetSize || behaviorData.preferredTargetSize;
      behaviorData.preferredContrast = currentSettings.contrast || behaviorData.preferredContrast;
      behaviorData.preferredTheme = currentSettings.theme || behaviorData.preferredTheme;
    }

    // Determine category
    const category = analyzeUserCategory(behaviorData);
    const categoryInfo = WCAG_CATEGORIES[category];

    console.log(` [USER CATEGORIZATION] User categorized as: ${categoryInfo.name}`);
    console.log(`   WCAG Level: ${categoryInfo.wcagLevel}`);
    console.log(`   Needs: ${categoryInfo.needs.join(', ')}`);

    res.json({
      success: true,
      userId,
      category,
      categoryInfo: {
        name: categoryInfo.name,
        wcagLevel: categoryInfo.wcagLevel,
        needs: categoryInfo.needs,
        recommendedSettings: categoryInfo.settings,
        priority: categoryInfo.priority
      },
      behaviorData
    });

  } catch (error) {
    console.error(' [USER CATEGORIZATION] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/user-categorization/suggest
 * Get category-based suggestions (no random exploration)
 */
router.post('/suggest', async (req, res) => {
  try {
    const { userId, category, currentSettings } = req.body;

    if (!category || !WCAG_CATEGORIES[category]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing category'
      });
    }

    const categoryInfo = WCAG_CATEGORIES[category];
    const recommended = categoryInfo.settings;
    const priorities = categoryInfo.priority;

    console.log(`\n [USER CATEGORIZATION] Generating suggestions for ${categoryInfo.name}`);

    // Find next setting to improve based on priority
    let suggestionParameter = null;
    let suggestionValue = null;

    for (const param of priorities) {
      const currentValue = currentSettings[param];
      const recommendedValue = recommended[param];

      if (currentValue !== recommendedValue) {
        suggestionParameter = param;
        suggestionValue = recommendedValue;
        break;
      }
    }

    // If all priorities matched, suggest remaining settings
    if (!suggestionParameter) {
      for (const [param, value] of Object.entries(recommended)) {
        if (currentSettings[param] !== value) {
          suggestionParameter = param;
          suggestionValue = value;
          break;
        }
      }
    }

    if (!suggestionParameter) {
      return res.json({
        success: true,
        message: 'All WCAG recommendations already applied',
        category: categoryInfo.name,
        allOptimized: true
      });
    }

    console.log(` [USER CATEGORIZATION] Suggesting: ${suggestionParameter} = ${suggestionValue}`);
    console.log(`   Reason: WCAG ${categoryInfo.wcagLevel} for ${categoryInfo.name}`);

    res.json({
      success: true,
      userId,
      category: categoryInfo.name,
      wcagLevel: categoryInfo.wcagLevel,
      suggestion: {
        parameter: suggestionParameter,
        currentValue: currentSettings[suggestionParameter],
        value: suggestionValue,
        reason: `Recommended for ${categoryInfo.name} (WCAG ${categoryInfo.wcagLevel})`,
        priority: priorities.indexOf(suggestionParameter) + 1,
        isExploration: false,
        source: 'wcag-category'
      }
    });

  } catch (error) {
    console.error(' [USER CATEGORIZATION] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/user-categorization/categories
 * Get all available WCAG categories
 */
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    categories: Object.keys(WCAG_CATEGORIES).map(key => ({
      id: key,
      name: WCAG_CATEGORIES[key].name,
      wcagLevel: WCAG_CATEGORIES[key].wcagLevel,
      needs: WCAG_CATEGORIES[key].needs,
      recommendedSettings: WCAG_CATEGORIES[key].settings
    }))
  });
});

module.exports = router;
