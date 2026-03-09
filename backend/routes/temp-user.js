const express = require('express');
const axios = require('axios');
const router = express.Router();

const MLPE_API_URL = process.env.MLPE_API_URL || process.env.MLPE_BACKEND_URL || 'https://aura-ml-backend-production-bdd3.up.railway.app';
const TEMPLATE_CACHE_TTL_MS = Number(process.env.TEMP_TEMPLATE_CACHE_TTL_MS || 60000);
const MIN_TEMPLATE_SAMPLES = Number(process.env.TEMP_TEMPLATE_MIN_SAMPLES || 5);
const QUARANTINE_DEVIATION = Number(process.env.TEMP_USER_QUARANTINE_DEVIATION || 0.45);
const REJECT_DEVIATION = Number(process.env.TEMP_USER_REJECT_DEVIATION || 0.60);

const templateCache = new Map(); // userId -> { expiresAt: number, template: object | null }

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function norm(value, low, high) {
  if (high <= low) return 0;
  return clamp01((value - low) / (high - low));
}

function buildFeatureVector(metrics) {
  const clickCount = Number(metrics.clickCount || 0);
  const misclickRate = Number(
    metrics.misclickRate != null
      ? metrics.misclickRate
      : (metrics.misclickCount && clickCount ? metrics.misclickCount / clickCount : 0)
  );
  const avgClickIntervalMs = Number(metrics.avgTimeToClick || metrics.avgClickIntervalMs || 0);
  const avgDwellMs = Number(metrics.avgDwellMs || 0);
  const rageClicks = Number(metrics.rageClickCount || 0);
  const zoomEvents = Number(metrics.zoomEventCount || 0);
  const scrollSpeed = Number(metrics.scrollVelocity || metrics.scrollSpeedPxS || 0);

  return [
    clickCount,
    misclickRate,
    avgClickIntervalMs,
    avgDwellMs,
    rageClicks,
    zoomEvents,
    scrollSpeed,
  ];
}

function normalizedVector(vec) {
  return [
    norm(vec[0], 5.0, 40.0),
    clamp01(vec[1]),
    norm(vec[2], 150.0, 600.0),
    norm(vec[3], 300.0, 2000.0),
    norm(vec[4], 0.0, 6.0),
    norm(vec[5], 0.0, 5.0),
    norm(vec[6], 200.0, 700.0),
  ];
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = (a[i] || 0) - (b[i] || 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function classifyFromTemplate(features, template) {
  const mean = Array.isArray(template?.mean) ? template.mean : [];
  const count = Number(template?.count || 0);
  if (mean.length !== 7 || count < MIN_TEMPLATE_SAMPLES) {
    return {
      outcome: 'unknown',
      isTempUser: false,
      similarity: null,
      deviation: null,
      reason: count < MIN_TEMPLATE_SAMPLES ? 'template_warming_up' : 'template_invalid',
    };
  }

  const vec = normalizedVector(features);
  const base = normalizedVector(mean);
  const dist = euclideanDistance(vec, base);
  const maxDist = Math.sqrt(vec.length);
  const similarity = clamp01(1 - (maxDist ? dist / maxDist : 0));
  const deviation = clamp01(1 - similarity);

  let outcome = 'keep';
  let reason = null;
  if (deviation >= REJECT_DEVIATION) {
    outcome = 'reject';
    reason = 'high_template_deviation_reject';
  } else if (deviation >= QUARANTINE_DEVIATION) {
    outcome = 'quarantine';
    reason = 'high_template_deviation_quarantine';
  }

  return {
    outcome,
    isTempUser: outcome !== 'keep',
    similarity,
    deviation,
    reason,
  };
}

async function fetchTemplate(userId) {
  const now = Date.now();
  const cached = templateCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.template;

  const response = await axios.get(`${MLPE_API_URL}/temp-detector/template`, {
    params: { user_id: userId },
    timeout: 2500,
  });
  const payload = response.data || {};
  const template = payload.template_found ? payload : null;
  templateCache.set(userId, { expiresAt: now + TEMPLATE_CACHE_TTL_MS, template });
  return template;
}

/**
 * POST /api/temp-user/check
 * 
 * Check if the current user behavior indicates a temporary user.
 * Uses user template fetched from ML Personalization Engine.
 */
router.post('/check', async (req, res) => {
  try {
    const { userId, metrics } = req.body;

    if (!metrics) {
      return res.status(400).json({
        success: false,
        error: 'Missing behavior metrics'
      });
    }

    if (!userId || userId === 'guest') {
      return res.json({
        success: true,
        mode: 'template',
        action: 'unknown',
        isTempUser: false,
        confidence: null,
        similarity: null,
        reason: 'template_unavailable_for_guest'
      });
    }

    const features = buildFeatureVector(metrics);
    const template = await fetchTemplate(userId);

    if (!template) {
      return res.json({
        success: true,
        mode: 'template',
        action: 'unknown',
        isTempUser: false,
        confidence: null,
        similarity: null,
        reason: 'template_not_found'
      });
    }

    const result = classifyFromTemplate(features, template);
    console.log(
      `[TempUserAPI] user=${userId} outcome=${result.outcome} deviation=${result.deviation}`
    );

    res.json({
      success: true,
      mode: 'template',
      isTempUser: result.isTempUser,
      action: result.outcome,
      confidence: result.deviation,
      similarity: result.similarity,
      reason: result.reason,
      template: {
        count: template.count,
        updatedAt: template.updated_at,
      }
    });

  } catch (error) {
    console.error('[TempUserAPI] Error checking temp user status:', error.message);
    res.json({
      success: false,
      isTempUser: false,
      error: error.message
    });
  }
});

module.exports = router;
