// backend/routes/personalization.js
const express = require('express');
const axios = require('axios');
const { Profile } = require('./profiles');
const { ManualSettings } = require('../mongodb/schemas');
const router = express.Router();

// Python Personalization Service URL (Week 2 - Thompson Sampling)
const PERSONALIZATION_SERVICE = process.env.PERSONALIZATION_SERVICE_URL || 'http://localhost:5002';

// In-memory cache for session-sticky personalization (use Redis in production)
const sessionCache = new Map();
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
    const cacheKey = `${userId}_${clientDomain || 'default'}`;
    const cached = sessionCache.get(cacheKey);
    
    if (cached && !forceNew && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`[Personalization] Returning cached personalization for ${userId}`);
      return res.json({
        ...cached.response,
        cached: true,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000),
      });
    }

    // Week 3: Fetch accessibility context from profile
    const profile = await Profile.findOne({ userId }) || await new Profile({ userId }).save();

    const context = {
      visual_impairment: Number(profile.visual_impairment ?? 0.5),
      motor_skills: Number(profile.motor_skills ?? 0.5),
      cognitive_load: Number(profile.cognitive_load ?? 0.5),
    };

    // Week 2: Call Thompson Sampling service for personalization
    try {
      const tsResponse = await axios.post(`${PERSONALIZATION_SERVICE}/personalize`, {
        userId,
        context,
        mode, // 'explore' or 'exploit'
      });

      if (tsResponse.data?.success) {
        const { settings, armIndex, sessionId } = tsResponse.data;

        const personalizationResponse = {
          success: true,
          userId,
          clientDomain: clientDomain || null,
          settings: {
            variant: settings.name || 'personalized',
            fontSize: settings.fontSize,
            lineHeight: settings.lineHeight,
            contrast: settings.contrast,
            spacing: settings.spacing,
            targetSize: settings.targetSize,
            // Map to your existing format
            primaryColor: settings.contrast === 'high' ? '#000000' : '#007bff',
            theme: settings.contrast === 'high' ? 'dark' : 'light',
          },
          sessionId,
          armIndex,
          source: 'thompson-sampling',
          mode,
          confidence: 0.8,  // Thompson Sampling provides implicit confidence
          timestamp: new Date().toISOString(),
        };

        // Cache the personalization (sticky for 30 minutes)
        sessionCache.set(cacheKey, {
          response: personalizationResponse,
          timestamp: Date.now(),
        });
        
        return res.json(personalizationResponse);
      }
    } catch (tsError) {
      console.error('[Personalization] Thompson Sampling service error:', tsError.message);
      // Fallback to baseline if Thompson Sampling fails
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
    const cacheKey = `${userId}_${req.body.clientDomain || 'default'}`;
    sessionCache.delete(cacheKey);
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
    
    const cacheKey = `${userId}_${clientDomain || 'default'}`;
    const existed = sessionCache.has(cacheKey);
    sessionCache.delete(cacheKey);
    
    res.json({
      success: true,
      message: existed ? 'Cache cleared' : 'No cache found',
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
