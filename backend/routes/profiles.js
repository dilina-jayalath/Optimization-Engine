// backend/routes/profiles.js
// Week 3: Accessibility/user profile management for personalization context

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const profileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  visual_impairment: { type: Number, default: 0.5 }, // 0.0 none -> 1.0 severe
  motor_skills: { type: Number, default: 0.5 },      // 0.0 poor -> 1.0 excellent
  cognitive_load: { type: Number, default: 0.5 },    // 0.0 low -> 1.0 high
  preferredContrast: { type: String, default: 'normal' },
  prefersLargeText: { type: Boolean, default: false },
  prefersReducedMotion: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now },
  revertCount: { type: Number, default: 0 },
  lastRevertAt: { type: Date, default: null },
});

const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);

// GET /api/profiles/:userId - fetch profile (defaults if not exists)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    let profile = await Profile.findOne({ userId });
    if (!profile) {
      profile = new Profile({ userId });
      await profile.save();
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error('[Profiles] Error fetching profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/profiles/:userId - update context profile
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body || {};

    const allowed = [
      'visual_impairment',
      'motor_skills',
      'cognitive_load',
      'preferredContrast',
      'prefersLargeText',
      'prefersReducedMotion',
    ];

    const payload = {};
    allowed.forEach((k) => {
      if (updates[k] !== undefined) payload[k] = updates[k];
    });
    payload.lastUpdated = new Date();

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: payload },
      { new: true, upsert: true }
    );

    res.json({ success: true, profile });
  } catch (error) {
    console.error('[Profiles] Error updating profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/profiles/:userId/revert - record explicit revert signal
router.post('/:userId/revert', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $inc: { revertCount: 1 }, $set: { lastRevertAt: new Date() } },
      { new: true, upsert: true }
    );

    res.json({ success: true, profile });
  } catch (error) {
    console.error('[Profiles] Error recording revert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, Profile };
