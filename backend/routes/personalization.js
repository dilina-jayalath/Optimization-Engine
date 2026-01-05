// backend/routes/personalization.js
const express = require('express');
const axios = require('axios');
const { Profile } = require('./profiles');
const { ManualSettings, PreferenceState, User } = require('../mongodb/schemas');
const { getMappedValue } = require('../config/ladders');
const { getCachedSession, setCachedSession, invalidateUserCache } = require('../utils/session-cache');
const router = express.Router();

// Python Personalization Service URL (Week 2 - Thompson Sampling)
const PERSONALIZATION_SERVICE = process.env.PERSONALIZATION_SERVICE_URL || 'http://localhost:5002';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const mapFeedbackToReward = (feedback) => {
  if (!feedback) return 0.5;

  if (typeof feedback.rating === 'number' && Number.isFinite(feedback.rating)) {
    const normalized = (feedback.rating - 1) / 4;
    return Math.max(0, Math.min(1, normalized));
  }

  const type = feedback.type;
  if (type === 'positive') return 1.0;
  if (type === 'neutral') return 0.5;
  if (type === 'negative') return 0.0;
  return 0.5;
};

const PROFILE_KEY_TO_SETTING_KEY = {
  fontSize: 'visual.fontSize',
  lineHeight: 'visual.lineHeight',
  theme: 'visual.theme',
  contrast: 'visual.contrast',
  spacing: 'layout.spacing',
  targetSize: 'motor.targetSize'
};

const SETTING_KEY_TO_PROFILE_KEY = Object.entries(PROFILE_KEY_TO_SETTING_KEY)
  .reduce((acc, [profileKey, settingKey]) => {
    acc[settingKey] = profileKey;
    return acc;
  }, {});

const mapSettingKeyToProfileKey = (settingKey) => {
  return SETTING_KEY_TO_PROFILE_KEY[settingKey] || settingKey;
};

const resolveProfileValue = (profileKey, value) => {
  const settingKey = PROFILE_KEY_TO_SETTING_KEY[profileKey];
  if (!settingKey) return value;

  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.includes('px')) return value;

  const mapped = getMappedValue(settingKey, value);
  return mapped ?? value;
};

/**
 * GET /api/personalization
 * 
 * Returns personalized UI settings for a user based on Thompson Sampling.
 * Week 2: Now uses learned preferences instead of baseline!
 * 
 * Query params:
 *   - userId: User ID
 *   - clientDomain: (Optional) Client website domain
 *   - mode: (Optional) 'explore' or 'exploit' (default: explore)
 * 
 * Response:
 *   {
 *     success: true,
 *     userId: "user123",
 *     settings: {
 *       variant: "large_high_contrast",
 *       fontSize: "18px",
 *       contrast: "high",
 *       spacing: "wide"
 *     },
 *     confidence: 0.85,
 *     source: "thompson-sampling"
 *   }
 */
router.get('/', async (req, res) => {
  try {
    const { userId, clientDomain, mode = 'explore', forceNew } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter',
      });
    }

    console.log(`[Personalization] Request for userId=${userId}, domain=${clientDomain || 'unknown'}, mode=${mode}`);

    // PRIORITY 1: Check for manual settings (user dashboard overrides)
    const manualSettings = await ManualSettings.findOne({ userId });
    if (manualSettings && manualSettings.enabled) {
      console.log(`[Personalization] Using manual settings for ${userId}`);
      
      const manualResponse = {
        success: true,
        userId,
        clientDomain: clientDomain || null,
        settings: {
          variant: 'manual',
          fontSize: manualSettings.fontSize,
          lineHeight: manualSettings.lineHeight,
          contrast: manualSettings.contrast,
          spacing: manualSettings.spacing,
          targetSize: manualSettings.targetSize,
          primaryColor: manualSettings.primaryColor,
          secondaryColor: manualSettings.secondaryColor,
          accentColor: manualSettings.accentColor,
          theme: manualSettings.theme,
        },
        source: 'manual',
        confidence: 1.0, // Manual settings are 100% confident
        timestamp: new Date().toISOString(),
      };
      
      return res.json(manualResponse);
    }

    // Check cache for existing personalization (sticky sessions)
    const cached = getCachedSession(userId, clientDomain);
    
    if (cached && !forceNew && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`[Personalization] Returning cached personalization for ${userId}`);
      return res.json({
        ...cached.response,
        cached: true,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000),
      });
    }

    // PRIORITY 2: Check for current settings (RL provided or persisted)
    // We fetch the user to get their latest stored settings
    const user = await User.findOne({ userId });
    
    if (user && user.currentSettings && Object.keys(user.currentSettings).length > 0) {
        console.log(`[Personalization] Using stored currentSettings for ${userId}`);
        
        // Map currentSettings schema to Personalization API schema
        // currentSettings uses keys like 'fontSize', 'targetSize' etc.
        const currentSettings = user.currentSettings;
        
        // Ensure manual overrides are merged in if they exist
        const manualOverrides = user.manualOverrides ? Object.fromEntries(user.manualOverrides) : {};
        
        const effectiveSettings = {
            ...currentSettings,
            ...manualOverrides
        };

        const personalizedResponse = {
            success: true,
            userId,
            clientDomain: clientDomain || null,
            settings: {
                variant: 'personalized',
                fontSize: effectiveSettings.fontSize || 'medium',
                lineHeight: effectiveSettings.lineHeight || 1.5,
                contrast: effectiveSettings.contrastMode || 'normal', // Note mapping
                spacing: effectiveSettings.elementSpacing || 'normal', // Note mapping
                targetSize: effectiveSettings.targetSize || 32,
                primaryColor: effectiveSettings.primaryColor || '#007bff',
                secondaryColor: effectiveSettings.secondaryColor || '#6c757d',
                accentColor: effectiveSettings.accentColor || '#28a745',
                theme: effectiveSettings.theme || 'light',
                reducedMotion: effectiveSettings.reducedMotion || false,
                tooltipAssist: effectiveSettings.tooltipAssist || false,
                layoutSimplification: effectiveSettings.layoutSimplification || false,
            },
            source: 'rl_persistence',
            confidence: 0.9,
            timestamp: new Date().toISOString(),
        };
        
        return res.json(personalizedResponse);
    }

    // Fallback to baseline (Week 1 behavior)
    const settings = {
      variant: 'baseline',
      fontSize: '16px',
      lineHeight: 1.5,
      contrast: 'normal',
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      accentColor: '#28a745',
      theme: 'light',
      reducedMotion: false,
      spacing: 'normal',
      targetSize: '44px',
      tooltipAssist: false,
      layoutSimplification: false,
    };

    res.json({
      success: true,
      userId,
      clientDomain: clientDomain || null,
      settings,
      confidence: 1.0,
      source: 'baseline',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Personalization API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/personalization/:userId
 * 
 * Returns the effective profile after applying trial preferences and overrides.
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    let user = await User.findOne({ userId });
    if (!user) {
      user = await new User({ userId }).save();
    }

    const manualSettings = await ManualSettings.findOne({ userId });
    if (manualSettings && manualSettings.enabled) {
      return res.json({
        success: true,
        userId,
        source: 'manual',
        effectiveProfile: {
          fontSize: manualSettings.fontSize,
          lineHeight: manualSettings.lineHeight,
          contrast: manualSettings.contrast,
          spacing: manualSettings.spacing,
          targetSize: manualSettings.targetSize,
          theme: manualSettings.theme,
          reducedMotion: manualSettings.reducedMotion,
          primaryColor: manualSettings.primaryColor,
          secondaryColor: manualSettings.secondaryColor,
          accentColor: manualSettings.accentColor
        },
        rawProfile: null,
        meta: {
          lockedSettings: [],
          preferenceCount: 0
        }
      });
    }

    const preferences = await PreferenceState.find({ userId });
    const preferenceOverrides = {};
    const lockedSettings = [];

    for (const pref of preferences) {
      const profileKey = mapSettingKeyToProfileKey(pref.settingKey);
      const chosenValue = pref.locked
        ? (pref.preferredValue || pref.currentValue)
        : pref.currentValue;
      preferenceOverrides[profileKey] = chosenValue;

      if (pref.locked) {
        lockedSettings.push(pref.settingKey);
      }
    }

    const manualOverridesRaw = user.manualOverrides
      ? Object.fromEntries(user.manualOverrides)
      : {};
    const manualOverrides = {};

    for (const [key, payload] of Object.entries(manualOverridesRaw)) {
      const value = payload && Object.prototype.hasOwnProperty.call(payload, 'value')
        ? payload.value
        : payload;
      const profileKey = mapSettingKeyToProfileKey(key);
      manualOverrides[profileKey] = value;
    }

    const mlProfile = user.mlProfile?.mergedProfile || {};
    const rawProfile = {
      ...mlProfile,
      ...preferenceOverrides,
      ...manualOverrides
    };
    const effectiveProfile = {};

    for (const [profileKey, value] of Object.entries(rawProfile)) {
      effectiveProfile[profileKey] = resolveProfileValue(profileKey, value);
    }

    res.json({
      success: true,
      userId,
      source: 'trial-based',
      effectiveProfile,
      rawProfile,
      sources: {
        mlProfile,
        trialOverrides: preferenceOverrides,
        manualOverrides
      },
      meta: {
        lockedSettings,
        preferenceCount: preferences.length
      }
    });
  } catch (error) {
    console.error('[Personalization API] Effective profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/personalization/feedback
 *
 * Submit explicit feedback for the current personalization session.
 *
 * Body:
 *   {
 *     userId: "user123",
 *     sessionId: "session_456",
 *     feedback: { type: "positive" | "neutral" | "negative", rating?: number }
 *   }
 */
router.post('/feedback', async (req, res) => {
  try {
    const { userId, sessionId, feedback } = req.body;

    if (!userId || !sessionId || !feedback || !feedback.type) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId, sessionId, or feedback.type',
      });
    }

    const reward = mapFeedbackToReward(feedback);

    try {
      const response = await axios.post(`${PERSONALIZATION_SERVICE}/feedback-explicit`, {
        sessionId,
        userId,
        reward,
        feedback,
      });

      if (response.data && response.data.success) {
        return res.json({
          success: true,
          sessionId,
          reward,
          updated: true,
        });
      }
    } catch (tsError) {
      console.error('[Personalization] Explicit feedback service error:', tsError.message);
    }

    return res.status(502).json({
      success: false,
      error: 'Personalization service unavailable',
    });
  } catch (error) {
    console.error('[Personalization API] Explicit feedback error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/personalization/revert
 * 
 * Handle user reversion to baseline.
 * This is a CRITICAL signal - user explicitly rejected personalization!
 * 
 * Body:
 *   {
 *     userId: "user123",
 *     sessionId: "session_456",
 *     reason: "immediate" | "delayed"
 *   }
 */
router.post('/revert', async (req, res) => {
  try {
    const { userId, sessionId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId',
      });
    }

    console.log(`[Personalization] REVERT signal from userId=${userId}, sessionId=${sessionId}, reason=${reason}`);

    // Clear cached personalization to force new selection
    invalidateUserCache(userId);
    console.log(`[Personalization] Cleared cache for ${userId}`);

    // Record revert in profile (Week 3)
    await Profile.findOneAndUpdate(
      { userId },
      { $inc: { revertCount: 1 }, $set: { lastRevertAt: new Date() } },
      { upsert: true }
    );

    // Send strong negative feedback to Thompson Sampling service
    try {
      await axios.post(`${PERSONALIZATION_SERVICE}/feedback`, {
        sessionId: sessionId || `revert_${userId}_${Date.now()}`,
        metrics: {
          duration: 5000,
          interactionCount: 1,
          errorCount: 1,
          scrollDepth: 0.05,
          tasksCompleted: 0,
          immediateReversion: true,
        },
      });
    } catch (tsError) {
      console.error('[Personalization] Failed to send revert feedback:', tsError.message);
    }

    res.json({
      success: true,
      message: 'Reversion recorded. Switching to baseline.',
      newSettings: {
        variant: 'baseline',
        fontSize: '16px',
        lineHeight: 1.5,
        contrast: 'normal',
        spacing: 'normal',
        targetSize: '44px',
        theme: 'light',
      },
    });

  } catch (error) {
    console.error('[Personalization API] Revert error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/personalization/cache/:userId
 * 
 * Clear cached personalization for a user (force new selection on next request)
 */
router.delete('/cache/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { clientDomain } = req.query;
    
    invalidateUserCache(userId);
    
    res.json({
      success: true,
      message: 'Cache cleared',
      userId,
    });
  } catch (error) {
    console.error('[Personalization API] Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
