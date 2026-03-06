const express = require('express');
const axios = require('axios');
const router = express.Router();

const PYTHON_RL_URL = process.env.PYTHON_RL_URL;

/**
 * POST /api/temp-user/check
 * 
 * Check if the current user behavior indicates a temporary/bot user.
 * Forwards metrics to the Python RL Service.
 */
router.post('/check', async (req, res) => {
  try {
    const { metrics, recent_interactions } = req.body;

    if (!metrics) {
      return res.status(400).json({
        success: false,
        error: 'Missing behavior metrics'
      });
    }

    // Construct payload for Python Service
    // The Python service expects a batch or a single interaction sequence.
    // Based on demo_temp_user.py, it expects:
    // {
    //   "user_id": "...",
    //   "session_id": "...",
    //   "interactions": [ ... ],
    //   "metrics": { ... }
    // }
    
    // However, the Python endpoint /rl/temp-user/score might expect a slightly different format.
    // Let's assume we pass what the frontend sends, perhaps enriched.
    
    const timestamp = new Date().toISOString();
    
    // Construct payload for Python Service (InteractionBatch schema)
    const pythonPayload = {
        user_id: req.body.user_id || `anon_${Date.now()}`,
        batch_id: `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        captured_at: timestamp,
        events_agg: {
            // Map frontend metrics to python schema
            click_count: metrics.clickCount || 0,
            misclick_rate: metrics.misclickCount && metrics.clickCount ? (metrics.misclickCount / metrics.clickCount) : 0.0,
            avg_click_interval_ms: metrics.avgTimeToClick || 0.0,
            rage_clicks: metrics.rageClickCount || 0,
            zoom_events: metrics.zoomEventCount || 0,
            scroll_speed_px_s: metrics.scrollVelocity || 0.0,
            avg_dwell_ms: 0.0 // Default/Not yet tracked
        },
        page_context: {
            domain: 'novacart.local',
            route: '/checkout',
            app_type: 'ecommerce'
        }
    };

    console.log('[TempUserAPI] Sending check to Python Service:', JSON.stringify(pythonPayload.metrics));

    const response = await axios.post(`${PYTHON_RL_URL}/rl/temp-user/score`, pythonPayload);

    // Python Service Response Format (from demo_temp_user.py experience):
    // {
    //   "result": {
    //      "is_temp_user": true/false,
    //      "confidence": 0.85,
    //      "action": "reject" | "quarantine" | "keep",
    //      "reason": "erratic_mouse_movement"
    //   }
    // }

    const result = response.data.result || response.data;

    console.log('[TempUserAPI] Result:', result);

    res.json({
      success: true,
      isTempUser: result.action === 'reject' || result.action === 'quarantine',
      action: result.action,
      confidence: result.confidence,
      reason: result.reason
    });

  } catch (error) {
    console.error('[TempUserAPI] Error checking temp user status:', error.message);
    // Fail gracefully - assume NOT a temp user if service is down
    res.json({
      success: false,
      isTempUser: false,
      error: error.message
    });
  }
});

module.exports = router;
