// backend/routes/rl-feedback.js
// Connect user feedback to RL model for learning

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Feedback, OptimizationEvent } = require('../mongodb/schemas');

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

// NEW: Component-specific feedback (Alt+Click)
router.post('/component-issue', async (req, res) => {
  try {
    const { 
      userId, 
      componentId, 
      componentType, 
      issue, 
      severity, 
      comment, 
      context: feedbackContext // Renamed to avoid confusion
    } = req.body;

    console.log(`[RL Feedback] 🐛 Component Issue Reported:`, { userId, componentId, issue });

    // 1. Log the feedback
    const feedbackEntry = new Feedback({
      userId,
      optimization: {
          parameter: 'component_level', 
          oldValue: 'unknown',
          newValue: 'reported_issue',
          suggestedBy: 'user_manual'
      },
      feedback: {
          type: 'negative',
          rating: 1, 
          comment: `[${componentType}] ${issue}: ${comment || ''}`
      },
      reward: {
          value: -1.0,
          normalized: -1.0
      },
      context: {
          deviceType: feedbackContext?.deviceType || 'unknown',
          pageUrl: feedbackContext?.pageUrl
      },
      metadata: {
        componentId,
        componentType,
        severity,
        issueType: issue,
        componentProps: feedbackContext?.componentProps
      }
    });
    await feedbackEntry.save();

    // 2. Penalize the RL model (Implicitly)
    const currentState = await OptimizationEvent.findOne({ userId }).sort({ timestamp: -1 });
    const penalty = -0.2 * (severity || 1);

    try {
        const lastAction = currentState?.details?.value || {};
        
        await axios.post(`${RL_SERVICE_URL}/rl/feedback`, {
            userId,
            state: {}, 
            action: lastAction, 
            reward: penalty,
            nextState: {} 
        });
        console.log(`[RL Feedback] 📉 Model penalized by ${penalty}`);
    } catch (rlError) {
        console.error('[RL Feedback] Failed to update RL model:', rlError.message);
    }

const RLMongoDBService = require('../mongodb/service');
const dbService = new RLMongoDBService();

    // 3. Get Smart Suggestion to fix the issue
    let nextSuggestion = null;
    let suggestionError = null;
    
    try {
        // Map common issues to parameters
        const issueToParam = {
            'too_small': 'targetSize',
            'too_large': 'targetSize', // Added for button/text size
            'hard_to_read': 'fontSize', 
            'bad_contrast': 'contrastMode',
            'line_height': 'lineHeight',
            'layout': 'elementSpacing',
            'wrong_color': 'theme' 
        };
        
        const targetParam = issueToParam[issue] || 'theme';
        
        // Safe access to current value
        const currentStyle = feedbackContext?.componentProps?.style || {};
        const currentProfile = feedbackContext?.currentProfile || {};
        
        const currentVal = currentStyle[targetParam] || currentProfile[targetParam === 'fontSize' ? 'font_size' : targetParam === 'targetSize' ? 'target_size' : targetParam];

        console.log(`[RL Feedback] 🧠 Requesting fix for ${targetParam} (current: ${currentVal})`);

        // Prepare RL payload
        // Ensure state keys match what RL expects (numbers or strings)
        const rlState = { [targetParam]: currentVal, ...currentProfile };

        const rlResponse = await axios.post(`${RL_SERVICE_URL}/rl/choose-action`, {
            userId,
            parameter: targetParam,
            state: rlState,
            context: { 
                reason: `User reported issue: ${issue}`,
                direction: ({
                    'too_small': 'increase',
                    'too_large': 'decrease',
                    'hard_to_read': 'increase',
                    'bad_contrast': 'increase' // Assuming this means more contrast
                })[issue]
            }
        });

        if (rlResponse.data && rlResponse.data.success) {
            nextSuggestion = {
                parameter: targetParam,
                currentValue: currentVal,
                suggestedValue: rlResponse.data.action,
                confidence: rlResponse.data.qValue,
                reason: `Fixing ${issue.replace('_', ' ')}`
            };
            console.log(`[RL Feedback] 💡 Suggesting fix: ${targetParam} -> ${nextSuggestion.suggestedValue}`);

            // NEW: Persist to Database so it survives refresh!
            try {
                // Determine parameter name consistent with user settings schema
                // e.g. 'fontSize' is usually stored as 'fontSize' in currentSettings, but profile uses 'font_size'
                // Let's use the exact key dashboard/settings API uses.
                const settingsUpdate = { [targetParam]: nextSuggestion.suggestedValue };
                
                // Use 'rl_optimization' which is a valid enum value in SettingsHistory schema
                await dbService.updateUserSettings(userId, settingsUpdate, 'rl_optimization');
                console.log(`[RL Feedback] 💾 Persisted setting to DB:`, settingsUpdate);
            } catch (dbErr) {
                 console.error('[RL Feedback] Failed to persist setting:', dbErr.message);
            }
        }
    } catch (suggestError) {
        console.error('[RL Feedback] Failed to get suggestion:', suggestError.message);
        suggestionError = suggestError.message;
        if (suggestError.response) {
            suggestionError += ` (Status ${suggestError.response.status}: ${JSON.stringify(suggestError.response.data)})`;
        }
    }

    res.json({ 
      success: true, 
      message: 'Feedback recorded and model updated',
      penaltyApplied: penalty,
      nextSuggestion, 
      suggestionError
    });

  } catch (error) {
    console.error('[RL Feedback] Error processing component issue:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * POST /api/rl-feedback/sync-daily
 * 
 * Invoked by the frontend explicitly (e.g. at the end of the day or session)
 * Pushes the user's customized LocalStorage profile to the Python ML Engine.
 */
router.post('/sync-daily', async (req, res) => {
  try {
    const { userId, profile } = req.body;

    if (!userId || !profile) {
      return res.status(400).json({ success: false, error: 'Missing userId or profile' });
    }

    console.log(`[RL Sync] 🔄 Initiating daily sync to ML engine for user ${userId}`);

    try {
      // Forward the maintained profile state to the Python RL microservice 
      const response = await axios.post(`${RL_SERVICE_URL}/rl/sync`, {
        userId,
        profile,
        timestamp: new Date().toISOString()
      });

      if (response.data && response.data.success) {
        console.log(`[RL Sync] ✅ Successfully synchronized user profile to ML`);
      } else {
         console.warn(`[RL Sync] ⚠️ ML Engine responded but indicated failure or no success flag`);
      }
    } catch (mlErr) {
       console.error(`[RL Sync] ❌ Failed to reach Python ML Engine: ${mlErr.message}`);
       // We don't fail the request completely if ML is down, but we log the issue
    }

    res.json({
      success: true,
      message: 'Initial daily sync procedure completed'
    });

  } catch (error) {
    console.error('[RL Sync] Error during daily sync:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
