const express = require('express');
const router = express.Router();
const { ManualSettings } = require('../mongodb/schemas');

/**
 * Manual Settings API
 * 
 * Allows users to override AI personalization with manual settings.
 * Manual settings take precedence over Thompson Sampling.
 */

/**
 * GET /api/manual-settings/:userId
 * Get current manual settings for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    let settings = await ManualSettings.findOne({ userId });
    
    if (!settings) {
      // Return default settings if none exist
      return res.json({
        success: true,
        userId,
        hasManualSettings: false,
        settings: null,
      });
    }

    res.json({
      success: true,
      userId,
      hasManualSettings: settings.enabled,
      settings: {
        enabled: settings.enabled,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        contrast: settings.contrast,
        spacing: settings.spacing,
        targetSize: settings.targetSize,
        theme: settings.theme,
        reducedMotion: settings.reducedMotion,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        lastModified: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Manual Settings] Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch manual settings',
    });
  }
});

/**
 * PUT /api/manual-settings/:userId
 * Update manual settings for a user
 */
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      enabled,
      fontSize,
      lineHeight,
      contrast,
      spacing,
      targetSize,
      theme,
      reducedMotion,
      primaryColor,
      secondaryColor,
      accentColor,
    } = req.body;

    console.log(`[Manual Settings] Updating settings for userId=${userId}`, {
      enabled,
      fontSize,
      contrast,
    });

    const settings = await ManualSettings.findOneAndUpdate(
      { userId },
      {
        userId,
        enabled: enabled ?? true,
        fontSize: fontSize || '16px',
        lineHeight: lineHeight || 1.5,
        contrast: contrast || 'normal',
        spacing: spacing || 'normal',
        targetSize: targetSize || '44px',
        theme: theme || 'light',
        reducedMotion: reducedMotion ?? false,
        primaryColor: primaryColor || '#007bff',
        secondaryColor: secondaryColor || '#6c757d',
        accentColor: accentColor || '#28a745',
      },
      { upsert: true, new: true }
    );

    console.log(`[Manual Settings] Settings updated successfully for ${userId}`);

    res.json({
      success: true,
      userId,
      settings: {
        enabled: settings.enabled,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        contrast: settings.contrast,
        spacing: settings.spacing,
        targetSize: settings.targetSize,
        theme: settings.theme,
        reducedMotion: settings.reducedMotion,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        lastModified: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Manual Settings] Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update manual settings',
    });
  }
});

/**
 * DELETE /api/manual-settings/:userId
 * Disable manual settings and return to AI personalization
 */
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    await ManualSettings.findOneAndUpdate(
      { userId },
      { enabled: false },
      { upsert: true }
    );

    console.log(`[Manual Settings] Disabled manual settings for ${userId}, returning to AI mode`);

    res.json({
      success: true,
      userId,
      message: 'Manual settings disabled, returning to AI personalization',
    });
  } catch (error) {
    console.error('[Manual Settings] Error disabling settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable manual settings',
    });
  }
});

/**
 * POST /api/manual-settings/:userId/reset
 * Reset to default settings
 */
router.post('/:userId/reset', async (req, res) => {
  try {
    const { userId } = req.params;

    const settings = await ManualSettings.findOneAndUpdate(
      { userId },
      {
        userId,
        enabled: false,
        fontSize: '16px',
        lineHeight: 1.5,
        contrast: 'normal',
        spacing: 'normal',
        targetSize: '44px',
        theme: 'light',
        reducedMotion: false,
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        accentColor: '#28a745',
      },
      { upsert: true, new: true }
    );

    console.log(`[Manual Settings] Reset settings to defaults for ${userId}`);

    res.json({
      success: true,
      userId,
      message: 'Settings reset to defaults',
      settings: {
        enabled: settings.enabled,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        contrast: settings.contrast,
        spacing: settings.spacing,
        targetSize: settings.targetSize,
        theme: settings.theme,
        reducedMotion: settings.reducedMotion,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
      },
    });
  } catch (error) {
    console.error('[Manual Settings] Error resetting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset settings',
    });
  }
});

module.exports = router;
