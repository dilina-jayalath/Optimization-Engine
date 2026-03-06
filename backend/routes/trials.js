const express = require('express');
const router = express.Router();
const { Trial, PreferenceState, User } = require('../mongodb/schemas');
const { 
  SETTING_LADDERS, 
  TRIAL_PRIORITIES, 
  COOLDOWN_CONFIG,
  ANOMALY_WEIGHTS,
  getLadder,
  getNextValue,
  isAtBoundary,
  getValueIndex
} = require('../config/ladders');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// RL Service URL
const PYTHON_RL_URL = process.env.PYTHON_RL_URL;

/**
 * Trial Management API
 * Implements the trial-based personalization system
 */

/**
 * POST /api/trials/propose
 * Get next trial proposal based on ML suggestion and user state
 * Now integrates with RL model to get intelligent suggestions!
 */
router.post('/propose', async (req, res) => {
  try {
    let { userId, sessionId, mlSuggestedProfile, context } = req.body;

    console.log(`[Trial] Proposing trial for userId=${userId}`);

    // Get all preference states for this user
    const preferences = await PreferenceState.find({ userId });
    const preferenceMap = new Map(
      preferences.map(p => [p.settingKey, p])
    );

    // If no ML suggestion provided, get from RL model
    if (!mlSuggestedProfile) {
      console.log('[Trial] No ML suggestion provided - calling RL model...');
      
      try {
        // Get current user state
        const currentSettings = {};
        for (const priority of TRIAL_PRIORITIES) {
          const pref = preferenceMap.get(priority);
          const ladder = getLadder(priority);
          currentSettings[priority] = pref ? pref.currentValue : ladder.default;
        }

        // Call RL model for suggestions
        const rlResponse = await axios.post(`${PYTHON_RL_URL}/rl/suggest`, {
          userId,
          currentSettings,
          context: context || {}
        }, { timeout: 5000 });

        mlSuggestedProfile = rlResponse.data.suggestions || {};
        console.log('[Trial] RL model suggestions:', mlSuggestedProfile);
        
        // If RL returned no suggestions, force exploration for new users
        if (Object.keys(mlSuggestedProfile).length === 0) {
          console.log('[Trial] No RL suggestions, forcing exploration...');
          for (const priority of TRIAL_PRIORITIES) {
            const pref = preferenceMap.get(priority);
            const ladder = getLadder(priority);
            if (!pref || !pref.locked) {
              const currentValue = pref ? pref.currentValue : ladder.default;
              const currentIdx = ladder.values.indexOf(currentValue);
              const nextIdx = (currentIdx + 1) % ladder.values.length;
              const nextValue = ladder.values[nextIdx];
              if (nextValue !== currentValue) {
                mlSuggestedProfile[priority] = nextValue;
                console.log(`[Trial] Exploration: ${priority} ${currentValue} → ${nextValue}`);
                break;
              }
            }
          }
        }
        
      } catch (rlError) {
        console.log('[Trial] RL model unavailable, using exploration strategy');
        // Fallback: suggest next value on ladder for first unlocked setting
        mlSuggestedProfile = {};
        for (const priority of TRIAL_PRIORITIES) {
          const pref = preferenceMap.get(priority);
          const ladder = getLadder(priority);
          if (!pref || !pref.locked) {
            const currentValue = pref ? pref.currentValue : ladder.default;
            const currentIdx = ladder.values.indexOf(currentValue);
            const nextIdx = (currentIdx + 1) % ladder.values.length;
            const nextValue = ladder.values[nextIdx];
            if (nextValue !== currentValue) {
              mlSuggestedProfile[priority] = nextValue;
              console.log(`[Trial] Fallback exploration: ${priority} ${currentValue} → ${nextValue}`);
              break;
            }
          }
        }
      }
    }

    // Find which setting to trial (pick highest priority unlocked setting)
    let proposedSetting = null;
    let proposedChange = null;

    for (const priority of TRIAL_PRIORITIES) {
      const pref = preferenceMap.get(priority);
      const ladder = getLadder(priority);

      if (!ladder) continue;

      // Skip if locked (user has confirmed preference)
      if (pref && pref.locked) continue;

      // Skip if in cooldown
      if (pref && pref.cooldownUntil && new Date() < pref.cooldownUntil) continue;

      // Check if ML suggests a different value
      const currentValue = pref ? pref.currentValue : ladder.default;
      const mlSuggestedValue = mlSuggestedProfile?.[priority];

      if (mlSuggestedValue && mlSuggestedValue !== currentValue) {
        proposedSetting = priority;
        proposedChange = {
          settingKey: priority,
          oldValue: currentValue,
          newValue: mlSuggestedValue,
          ladder: ladder.values,
          attemptNumber: (pref?.trialCount || 0) + 1
        };
        break;
      }
    }

    if (!proposedChange) {
      return res.json({
        success: true,
        hasTrial: false,
        message: 'No trial needed - all settings are optimal or locked'
      });
    }

    res.json({
      success: true,
      hasTrial: true,
      proposal: proposedChange,
      context: context || {}
    });

  } catch (error) {
    console.error('[Trial] Error proposing trial:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to propose trial'
    });
  }
});

/**
 * POST /api/trials/start
 * Start a new trial
 */
router.post('/start', async (req, res) => {
  try {
    const { 
      userId, 
      sessionId, 
      settingKey, 
      oldValue, 
      newValue, 
      context, 
      attemptNumber 
    } = req.body;

    if (!userId || !sessionId || !settingKey || !oldValue || !newValue) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, sessionId, settingKey, oldValue, newValue'
      });
    }

    console.log(`[Trial] Starting trial: ${settingKey} ${oldValue} → ${newValue}`);

    // Create trial record
    const trialId = uuidv4();
    const trial = await Trial.create({
      trialId,
      userId,
      sessionId,
      settingKey,
      oldValue,
      newValue,
      context: context || {},
      attemptNumber: attemptNumber || 1,
      status: 'active',
      startTime: new Date()
    });

    // Update preference state
    const ladder = getLadder(settingKey);
    const newIndex = ladder.values.indexOf(newValue);

    await PreferenceState.findOneAndUpdate(
      { userId, settingKey },
      {
        userId,
        settingKey,
        currentValue: newValue,
        currentIndex: newIndex,
        lastTrialAt: new Date(),
        $inc: { trialCount: 1 }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      trialId,
      evaluationWindow: COOLDOWN_CONFIG.evaluationWindow,
      minClicks: COOLDOWN_CONFIG.minClicksForEvaluation
    });

  } catch (error) {
    console.error('[Trial] Error starting trial:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start trial'
    });
  }
});

/**
 * POST /api/trials/evaluate
 * Evaluate trial based on passive metrics
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { trialId, metrics } = req.body;

    console.log(`[Trial] Evaluating trial ${trialId}`);

    const trial = await Trial.findOne({ trialId });
    if (!trial) {
      return res.status(404).json({
        success: false,
        error: 'Trial not found'
      });
    }

    // Calculate anomaly score
    const anomalyScore = calculateAnomalyScore(metrics);

    const pref = await PreferenceState.findOne({
      userId: trial.userId,
      settingKey: trial.settingKey
    });

    // Determine decision
    let decision;
    let shouldPrompt = false;

    if (anomalyScore < 0.3) {
      // Low anomaly - accept silently
      decision = 'accept';
    } else if (anomalyScore > 0.7) {
      // High anomaly - revert silently
      decision = 'revert';
    } else {
      // Moderate anomaly - check if we should prompt
      const contextKey = trial.context?.pageType || 'default';
      const negativeCount = pref?.negativeCountInContext?.get(contextKey) || 0;

      // Check cooldowns
      const canPrompt = await checkPromptCooldowns(pref, trial);

      if (canPrompt && (negativeCount >= 2 || anomalyScore > 0.5)) {
        decision = 'prompt';
        shouldPrompt = true;
      } else {
        decision = anomalyScore > 0.5 ? 'revert' : 'accept';
      }
    }

    // Update trial
    trial.metrics = metrics;
    trial.anomalyScore = anomalyScore;
    trial.decision = decision;
    trial.status = shouldPrompt ? 'awaiting_feedback' : 'completed';
    if (shouldPrompt) {
      trial.promptedAt = new Date();
    }
    trial.endTime = new Date();
    await trial.save();

    // Update preference state
    const updateData = {
      updatedAt: new Date()
    };

    if (decision === 'accept') {
      updateData.$inc = { successfulTrials: 1 };
    } else if (decision === 'revert') {
      updateData.$inc = { failedTrials: 1 };
      updateData.currentValue = trial.oldValue;
      updateData.currentIndex = getValueIndex(trial.settingKey, trial.oldValue);
      
      // Increment negative count for context
      const contextKey = trial.context?.pageType || 'default';
      const currentNegativeCount = pref?.negativeCountInContext?.get(contextKey) || 0;
      updateData[`negativeCountInContext.${contextKey}`] = currentNegativeCount + 1;
    } else if (decision === 'prompt') {
      updateData.lastPromptAt = new Date();
    }

    await PreferenceState.findOneAndUpdate(
      { userId: trial.userId, settingKey: trial.settingKey },
      updateData
    );

    console.log(`[Trial] Decision: ${decision}, Anomaly: ${anomalyScore.toFixed(2)}`);

    res.json({
      success: true,
      trialId,
      decision,
      anomalyScore,
      shouldPrompt,
      revertTo: decision === 'revert' ? trial.oldValue : null
    });

  } catch (error) {
    console.error('[Trial] Error evaluating trial:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate trial'
    });
  }
});

/**
 * POST /api/trials/feedback
 * Record explicit feedback from user
 */
router.post('/feedback', async (req, res) => {
  try {
    const { trialId, feedbackType, reason, overrideValue } = req.body;

    console.log(`[Trial] Feedback for ${trialId}: ${feedbackType} (${reason})`);

    const trial = await Trial.findOne({ trialId });
    if (!trial) {
      return res.status(404).json({
        success: false,
        error: 'Trial not found'
      });
    }

    const feedbackReason = feedbackType === 'manual' ? 'manual' : (reason || 'other');

    // Update trial with feedback
    trial.feedback = {
      given: true,
      type: feedbackType,
      reason: feedbackReason,
      timestamp: new Date()
    };
    trial.status = 'completed';
    await trial.save();

    // Train RL model with feedback
    try {
      const reward = feedbackType === 'like' ? 1.0 : 
                     feedbackType === 'dislike' ? -0.5 : 0.0;
      
      console.log(`[Trial] Training RL model with reward=${reward}`);
      
      await axios.post(`${PYTHON_RL_URL}/rl/feedback`, {
        userId: trial.userId,
        parameter: trial.settingKey,
        action: trial.newValue,
        reward,
        state: {
          oldValue: trial.oldValue,
          newValue: trial.newValue,
          feedbackType,
          reason
        }
      }, { timeout: 3000 });
      
      console.log('[Trial] RL model trained successfully');
    } catch (rlError) {
      console.log('[Trial] RL model training failed (non-critical):', rlError.message);
    }

    // Update preference state
    let pref = await PreferenceState.findOne({
      userId: trial.userId,
      settingKey: trial.settingKey
    });

    if (!pref) {
      pref = new PreferenceState({
        userId: trial.userId,
        settingKey: trial.settingKey,
        currentValue: trial.newValue,
        currentIndex: getValueIndex(trial.settingKey, trial.newValue)
      });
    }

    let nextSuggestion = null;
    let shouldLock = false;

    pref.feedbackCount = (pref.feedbackCount || 0) + 1;
    pref.lastPromptAt = new Date();

    if (feedbackType === 'manual') {
      const chosenValue = overrideValue || trial.newValue;
      const chosenIndex = getValueIndex(trial.settingKey, chosenValue);

      if (chosenIndex === -1) {
        return res.status(400).json({
          success: false,
          error: 'overrideValue must be one of the setting ladder values'
        });
      }

      pref.preferredValue = chosenValue;
      pref.preferredIndex = chosenIndex;
      pref.currentValue = chosenValue;
      pref.currentIndex = chosenIndex;
      pref.locked = true;
      pref.successfulTrials += 1;
      shouldLock = true;

      await upsertManualOverride(trial.userId, trial.settingKey, chosenValue);

      console.log(`[Trial] Manual override locked ${trial.settingKey} at ${chosenValue}`);
    } else if (feedbackType === 'like') {
      // User likes this value - lock it
      pref.preferredValue = trial.newValue;
      pref.preferredIndex = getValueIndex(trial.settingKey, trial.newValue);
      pref.locked = true;
      pref.successfulTrials += 1;
      shouldLock = true;

      console.log(`[Trial] Locked ${trial.settingKey} at ${trial.newValue}`);

    } else if (feedbackType === 'dislike') {
      // User dislikes - try next value based on reason
      pref.failedTrials += 1;

      // Check if we've hit max retries
      if (pref.trialCount >= COOLDOWN_CONFIG.maxRetriesPerSetting + 1) {
        // Too many attempts - set long cooldown
        pref.cooldownUntil = new Date(Date.now() + COOLDOWN_CONFIG.perSettingCooldown);
        console.log(`[Trial] Max retries reached for ${trial.settingKey}`);
      } else {
        // Try next value in direction indicated by reason
        const direction = reason === 'too_big' ? 'decrease' : 
                         reason === 'too_small' ? 'increase' : null;

        if (direction) {
          const nextValue = getNextValue(trial.settingKey, trial.newValue, direction);
          
          if (nextValue && nextValue !== trial.newValue) {
            nextSuggestion = {
              settingKey: trial.settingKey,
              value: nextValue,
              attemptNumber: trial.attemptNumber + 1
            };

            // Update current value to next suggestion
            pref.currentValue = nextValue;
            pref.currentIndex = getValueIndex(trial.settingKey, nextValue);
          } else {
            // At boundary - lock at current best
            pref.locked = true;
            shouldLock = true;
          }
        }

        // Set short cooldown
        pref.cooldownUntil = new Date(Date.now() + COOLDOWN_CONFIG.minPromptInterval);
      }

      if (reason === 'dismiss') {
        pref.dismissCount += 1;
        pref.cooldownUntil = new Date(Date.now() + COOLDOWN_CONFIG.perSettingCooldown);
      }
    }

    await pref.save();

    res.json({
      success: true,
      locked: shouldLock,
      nextSuggestion,
      message: shouldLock 
        ? `Preference locked at ${trial.newValue}` 
        : nextSuggestion 
          ? `Will try ${nextSuggestion.value} next` 
          : 'No more trials for now'
    });

  } catch (error) {
    console.error('[Trial] Error recording feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record feedback'
    });
  }
});

/**
 * GET /api/trials/preferences/:userId
 * Get all preference states for a user
 */
router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const preferences = await PreferenceState.find({ userId });
    const trials = await Trial.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      preferences,
      recentTrials: trials,
      summary: {
        locked: preferences.filter(p => p.locked).length,
        active: preferences.filter(p => !p.locked && !p.cooldownUntil).length,
        cooldown: preferences.filter(p => p.cooldownUntil && new Date() < p.cooldownUntil).length
      }
    });

  } catch (error) {
    console.error('[Trial] Error fetching preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch preferences'
    });
  }
});

/**
 * Helper Functions
 */

function calculateAnomalyScore(metrics) {
  // Baseline comparison (simplified - in production, compare to user's history)
  const baseline = {
    misclickRate: 0.05,    // 5% misclick rate is normal
    rageClickRate: 0.02,   // 2% rage clicks is normal
    avgTimeToClick: 1000,  // 1 second is normal
    formErrorRate: 0.10,   // 10% form errors is normal
    zoomEventRate: 0.01    // 1% zoom events is normal
  };

  const current = {
    misclickRate: metrics.clickCount > 0 ? metrics.misclickCount / metrics.clickCount : 0,
    rageClickRate: metrics.clickCount > 0 ? metrics.rageClickCount / metrics.clickCount : 0,
    avgTimeToClick: metrics.avgTimeToClick || 0,
    formErrorRate: metrics.clickCount > 0 ? metrics.formErrorCount / metrics.clickCount : 0,
    zoomEventRate: metrics.clickCount > 0 ? metrics.zoomEventCount / metrics.clickCount : 0
  };

  // Calculate deltas (normalized 0-1)
  const deltas = {
    misclickRate: Math.min((current.misclickRate - baseline.misclickRate) / 0.2, 1),
    rageClickRate: Math.min((current.rageClickRate - baseline.rageClickRate) / 0.1, 1),
    timeToClick: Math.min((current.avgTimeToClick - baseline.avgTimeToClick) / 2000, 1),
    formErrorRate: Math.min((current.formErrorRate - baseline.formErrorRate) / 0.2, 1),
    zoomEventRate: Math.min((current.zoomEventRate - baseline.zoomEventRate) / 0.05, 1)
  };

  // Weighted sum
  const score = 
    Math.max(0, deltas.misclickRate) * ANOMALY_WEIGHTS.misclickRate +
    Math.max(0, deltas.rageClickRate) * ANOMALY_WEIGHTS.rageClicks +
    Math.max(0, deltas.timeToClick) * ANOMALY_WEIGHTS.timeToClick +
    Math.max(0, deltas.formErrorRate) * ANOMALY_WEIGHTS.formErrors +
    Math.max(0, deltas.zoomEventRate) * ANOMALY_WEIGHTS.zoomEvents;

  return Math.min(score, 1.0);
}

async function checkPromptCooldowns(preferenceState, trial) {
  const now = new Date();

  if (preferenceState) {
    // Check global cooldown
    if (preferenceState.cooldownUntil && now < preferenceState.cooldownUntil) {
      return false;
    }

    // Check last prompt time
    if (preferenceState.lastPromptAt) {
      const timeSinceLastPrompt = now - preferenceState.lastPromptAt;
      if (timeSinceLastPrompt < COOLDOWN_CONFIG.minPromptInterval) {
        return false;
      }
    }

    // Check max retries
    if (preferenceState.trialCount >= COOLDOWN_CONFIG.maxRetriesPerSetting + 1) {
      return false;
    }

    // Check dismiss count
    if (preferenceState.dismissCount >= 3) {
      return false; // User clearly doesn't want prompts
    }
  }

  // Check per-session prompt limit
  if (COOLDOWN_CONFIG.maxPromptsPerSession && trial.sessionId) {
    const sessionPromptCount = await Trial.countDocuments({
      userId: trial.userId,
      sessionId: trial.sessionId,
      decision: 'prompt',
      trialId: { $ne: trial.trialId }
    });

    if (sessionPromptCount >= COOLDOWN_CONFIG.maxPromptsPerSession) {
      return false;
    }
  }

  // Never prompt on the same page twice
  const pageType = trial.context?.pageType;
  if (pageType) {
    const pagePromptCount = await Trial.countDocuments({
      userId: trial.userId,
      'context.pageType': pageType,
      decision: 'prompt',
      trialId: { $ne: trial.trialId }
    });

    if (pagePromptCount > 0) {
      return false;
    }
  }

  return true;
}

function mapSettingKeyToProfileKey(settingKey) {
  const map = {
    'visual.fontSize': 'font_size',
    'visual.lineHeight': 'line_height',
    'visual.theme': 'theme',
    'visual.contrast': 'contrast_mode',
    'layout.spacing': 'element_spacing_x',
    'motor.targetSize': 'target_size'
  };

  return map[settingKey] || settingKey;
}

async function upsertManualOverride(userId, settingKey, value) {
  const profileKey = mapSettingKeyToProfileKey(settingKey);
  const overridePath = `manualOverrides.${profileKey}`;

  await User.findOneAndUpdate(
    { userId },
    {
      $set: {
        [overridePath]: {
          value,
          timestamp: new Date(),
          reason: 'manual_override'
        }
      }
    },
    { upsert: true }
  );
}

module.exports = router;
