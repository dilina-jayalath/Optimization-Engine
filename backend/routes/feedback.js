// backend/routes/feedback.js
// Explicit feedback endpoint for Week 4

const express = require('express');
const axios = require('axios');
const router = express.Router();

const PERSONALIZATION_SERVICE = process.env.PERSONALIZATION_SERVICE_URL || 'http://localhost:5002';

/**
 * POST /api/feedback/explicit
 * 
 * Handle explicit user feedback (thumbs up/down)
 * Maps yes/no to reward value and forwards to Thompson Sampling
 * 
 * Body:
 * {
 *   userId: "user123",
 *   sessionId: "session_456",
 *   answer: "yes" | "no",
 *   comment?: string
 * }
 */
router.post('/explicit', async (req, res) => {
  try {
    const { userId, sessionId, answer, comment } = req.body;

    if (!userId || !sessionId || !answer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, sessionId, answer',
      });
    }

    console.log(`[Explicit Feedback] User ${userId} answered: ${answer}`);

    // Map answer to reward
    const reward = answer === 'yes' ? 0.95 : 0.15;

    // Create metrics for Thompson Sampling
    const metrics = {
      duration: 30000, // Assume 30s for explicit feedback
      interactionCount: 5,
      errorCount: answer === 'yes' ? 0 : 1,
      scrollDepth: 0.5,
      tasksCompleted: answer === 'yes' ? 1 : 0,
      immediateReversion: answer === 'no',
    };

    // Send to Thompson Sampling service
    try {
      await axios.post(`${PERSONALIZATION_SERVICE}/feedback`, {
        sessionId,
        metrics,
      });

      console.log(`[Explicit Feedback] Sent feedback to TS: reward=${reward}`);
    } catch (tsError) {
      console.error('[Explicit Feedback] Failed to send to TS:', tsError.message);
    }

    res.json({
      success: true,
      message: 'Feedback received',
      reward,
    });

  } catch (error) {
    console.error('[Explicit Feedback] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
