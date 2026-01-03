const express = require('express');
const router = express.Router();
const { Trial, PreferenceState } = require('../mongodb/schemas');
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

/**
 * Trial Management API
 * Implements the trial-based personalization system
 */

/**
 * POST /api/trials/propose
 * Get next trial proposal based on ML suggestion and user state
 */
router.post('/propose', async (req, res) => {
  try {
    const { userId, sessionId, mlSuggestedProfile, context } = req.body;

    console.log(`[Trial] Proposing trial for userId=${userId}`);

    // Get all preference states for this user
    const preferences = await PreferenceState.find({ userId });
    const preferenceMap = new Map(
      preferences.map(p => [p.settingKey, p])
    );

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
      const pref = await PreferenceState.findOne({
        userId: trial.userId,
        settingKey: trial.settingKey
      });

      const contextKey = trial.context?.pageType || 'default';
      const negativeCount = pref?.negativeCountInContext?.get(contextKey) || 0;

      // Check cooldowns
      const canPrompt = checkPromptCooldowns(pref, trial);

      if (canPrompt && (negativeCount >= 1 || anomalyScore > 0.5)) {
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
      updateData[`negativeCountInContext.${contextKey}`] = 
        (await PreferenceState.findOne({ userId: trial.userId, settingKey: trial.settingKey }))
          ?.negativeCountInContext?.get(contextKey) + 1 || 1;
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
    const { trialId, feedbackType, reason } = req.body;

    console.log(`[Trial] Feedback for ${trialId}: ${feedbackType} (${reason})`);

    const trial = await Trial.findOne({ trialId });
    if (!trial) {
      return res.status(404).json({
        success: false,
        error: 'Trial not found'
      });
    }

    // Update trial with feedback
    trial.feedback = {
      given: true,
      type: feedbackType,
      reason: reason || 'other',
      timestamp: new Date()
    };
    trial.status = 'completed';
    await trial.save();

    // Update preference state
    const pref = await PreferenceState.findOne({
      userId: trial.userId,
      settingKey: trial.settingKey
    });

    let nextSuggestion = null;
    let shouldLock = false;

    if (feedbackType === 'like') {
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
      pref.feedbackCount += 1;
      pref.lastPromptAt = new Date();

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

function checkPromptCooldowns(preferenceState, trial) {
  if (!preferenceState) return true;

  const now = new Date();

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

  return true;
}

module.exports = router;
