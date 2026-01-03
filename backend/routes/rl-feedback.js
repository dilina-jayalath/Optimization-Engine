// backend/routes/rl-feedback.js
// Connect user feedback to RL model for learning

const express = require('express');
const router = express.Router();
const axios = require('axios');

const RL_SERVICE_URL = process.env.RL_SERVICE_URL || 'http://localhost:8000';

/**
 * POST /api/rl-feedback/submit
 * User submits feedback on ML-suggested settings
 * This trains the RL model to improve future suggestions
 */
router.post('/submit', async (req, res) => {
  try {
    const {
      userId,
      settingKey,        // e.g., 'font_size', 'theme', 'target_size'
      oldValue,          // Previous value
      newValue,          // ML-suggested value
      feedback,          // 'positive', 'neutral', 'negative'
      source,            // 'ml', 'manual', 'trial'
      mlConfidence,      // ML confidence score (0-1)
      metadata = {}
    } = req.body;

    console.log('\n💬 [RL FEEDBACK] User feedback received:');
    console.log('   User:', userId);
    console.log('   Setting:', settingKey);
    console.log('   Change:', oldValue, '→', newValue);
    console.log('   Feedback:', feedback);
    console.log('   ML Confidence:', mlConfidence);

    // Convert feedback to reward signal (-1 to 1)
    const rewardMap = {
      'positive': 1.0,      // User loves it
      'neutral': 0.0,       // No strong feeling
      'negative': -1.0,     // User dislikes it
      'better': 1.0,        // Explicit "better"
      'same': 0.0,          // No improvement
      'worse': -1.0         // Made it worse
    };

    const reward = rewardMap[feedback] ?? 0.0;

    // Prepare RL training data
    const rlPayload = {
      userId,
      parameter: settingKey,
      action: newValue,
      reward,
      metadata: {
        oldValue,
        mlConfidence,
        source,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    console.log('🤖 [RL FEEDBACK] Sending to RL service for training...');

    // Send to Python RL service
    const rlResponse = await axios.post(
      `${RL_SERVICE_URL}/rl/feedback`,
      rlPayload,
      { timeout: 5000 }
    );

    console.log('✅ [RL FEEDBACK] RL model updated successfully');
    console.log('   Q-value update:', rlResponse.data.qValue);
    console.log('   Steps:', rlResponse.data.steps);

    // Store feedback in database (for analytics)
    // TODO: Save to MongoDB for tracking

    res.json({
      success: true,
      message: 'Feedback received and RL model trained',
      rlUpdate: {
        qValue: rlResponse.data.qValue,
        steps: rlResponse.data.steps,
        epsilon: rlResponse.data.epsilon
      },
      reward
    });

  } catch (error) {
    console.error('❌ [RL FEEDBACK] Error:', error.message);
    
    // Still return success even if RL service is down
    res.json({
      success: true,
      message: 'Feedback received (RL service unavailable)',
      error: error.message
    });
  }
});

/**
 * POST /api/rl-feedback/get-suggestion
 * Get RL model's suggestion for next best setting
 */
router.post('/get-suggestion', async (req, res) => {
  try {
    const { userId, currentSettings, parameter, currentValue } = req.body;

    console.log('\n🎯 [RL FEEDBACK] Requesting suggestion from RL model...');
    console.log('   User:', userId);
    console.log('   Current Settings:', currentSettings);

    // If currentSettings provided, pick a parameter to optimize
    let targetParameter = parameter;
    let targetCurrentValue = currentValue;
    
    if (currentSettings && !targetParameter) {
      // Pick a parameter to optimize (cycle through theme, fontSize, targetSize)
      const parameters = ['theme', 'fontSize', 'targetSize'];
      targetParameter = parameters[Math.floor(Math.random() * parameters.length)];
      targetCurrentValue = currentSettings[targetParameter];
      
      console.log('   Auto-selected parameter:', targetParameter);
    }

    if (!targetParameter) {
      return res.status(400).json({
        success: false,
        error: 'No parameter specified and no currentSettings provided'
      });
    }

    // Request action from RL model
    const rlResponse = await axios.post(
      `${RL_SERVICE_URL}/rl/choose-action`,
      {
        userId,
        parameter: targetParameter,
        state: { [targetParameter]: targetCurrentValue },
        context: {}
      },
      { timeout: 5000 }
    );

    const suggestion = rlResponse.data;

    console.log('✅ [RL FEEDBACK] RL suggestion received:', suggestion.action);
    console.log('   Q-value:', suggestion.qValue);
    console.log('   Exploration:', suggestion.isExploration);

    res.json({
      success: true,
      suggestion: {
        parameter: targetParameter,
        currentValue: targetCurrentValue,
        value: suggestion.action,
        qValue: suggestion.qValue,
        confidence: suggestion.qValue,  // Normalize Q-value as confidence
        isExploration: suggestion.isExploration,
        source: 'rl'
      }
    });

  } catch (error) {
    console.error('❌ [RL FEEDBACK] Error getting suggestion:', error.message);
    console.error('   Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || 'RL service may be down'
    });
  }
});

/**
 * GET /api/rl-feedback/stats/:userId
 * Get RL learning stats for a user
 */
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const rlResponse = await axios.get(
      `${RL_SERVICE_URL}/rl/stats/${userId}`,
      { timeout: 5000 }
    );

    res.json({
      success: true,
      stats: rlResponse.data
    });

  } catch (error) {
    console.error('❌ [RL FEEDBACK] Error getting stats:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
