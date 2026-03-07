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
      font_size: 20, // using approximate pixel num instead of 'x-large'
      contrast_mode: 'high',
      line_height: 1.8,
      element_spacing_x: 12, // originally 'relaxed'
      element_spacing_y: 12,
      element_padding_x: 12,
      element_padding_y: 12,
      target_size: 48,
      primary_color: '#ffffff',
      accent_color: '#00ff00'
    },
    priority: ['font_size', 'contrast_mode', 'target_size', 'theme']
  },
  
  MOTOR_IMPAIRED: {
    name: 'Motor Impaired',
    wcagLevel: 'AA',
    needs: ['large_targets', 'generous_spacing', 'reduced_motion'],
    settings: {
      target_size: 56,
      element_spacing_x: 12,
      element_spacing_y: 12,
      reduced_motion: true,
      font_size: 20,
      line_height: 1.8
    },
    priority: ['target_size', 'element_spacing_x', 'element_spacing_y', 'reduced_motion']
  },
  
  COGNITIVE_NEEDS: {
    name: 'Cognitive Needs',
    wcagLevel: 'AAA',
    needs: ['simple_layout', 'clear_text', 'consistent_interface'],
    settings: {
      font_size: 20,
      line_height: 2.0,
      element_spacing_x: 12,
      element_spacing_y: 12,
      contrast_mode: 'high',
      theme: 'light',
      reduced_motion: true
    },
    priority: ['font_size', 'line_height', 'element_spacing_x', 'element_spacing_y', 'contrast_mode']
  },
  
  ELDERLY: {
    name: 'Elderly User',
    wcagLevel: 'AA',
    needs: ['readable_text', 'easy_interaction', 'clear_interface'],
    settings: {
      font_size: 20,
      target_size: 52,
      line_height: 1.8,
      contrast_mode: 'high',
      element_spacing_x: 8,
      element_spacing_y: 8,
      reduced_motion: true
    },
    priority: ['font_size', 'target_size', 'line_height', 'contrast_mode']
  },
  
  STANDARD: {
    name: 'Standard User',
    wcagLevel: 'A',
    needs: ['general_usability'],
    settings: {
      font_size: 16,
      target_size: 44,
      line_height: 1.5,
      contrast_mode: 'normal',
      element_spacing_x: 8,
      element_spacing_y: 8,
      theme: 'light'
    },
    priority: ['theme', 'font_size']
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
      preferredFontSize: 16,
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
      const fontSizes = positiveFeedback.filter(f => f.settingKey === 'font_size');
      if (fontSizes.length > 0) {
        behaviorData.preferredFontSize = fontSizes[fontSizes.length - 1].newValue;
      }

      const targetSizes = positiveFeedback.filter(f => f.settingKey === 'target_size');
      if (targetSizes.length > 0) {
        const lastTarget = targetSizes[targetSizes.length - 1].newValue;
        behaviorData.preferredTargetSize = typeof lastTarget === 'number' ? lastTarget : parseInt(lastTarget);
      }

      const contrasts = positiveFeedback.filter(f => f.settingKey === 'contrast_mode');
      if (contrasts.length > 0) {
        behaviorData.preferredContrast = contrasts[contrasts.length - 1].newValue;
      }
    }

    // Use current settings if no history
    if (currentSettings) {
      behaviorData.preferredFontSize = currentSettings.font_size || behaviorData.preferredFontSize;
      behaviorData.preferredTargetSize = currentSettings.target_size || behaviorData.preferredTargetSize;
      behaviorData.preferredContrast = currentSettings.contrast_mode || behaviorData.preferredContrast;
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
