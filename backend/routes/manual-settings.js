const express = require('express');
const router = express.Router();
const { ManualSettings, User } = require('../mongodb/schemas');
const { broadcastSettingsUpdate } = require('./settings-events');

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
        accentColor: settings.accentColor,
        tooltipAssist: settings.tooltipAssist,
        layoutSimplification: settings.layoutSimplification,
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
      tooltipAssist,
      layoutSimplification,
    } = req.body;

    console.log(`[Manual Settings] Updating settings for userId=${userId}`, {
      enabled,
      fontSize,
      contrast,
      tooltipAssist,
      layoutSimplification
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
        tooltipAssist: tooltipAssist ?? false,
        layoutSimplification: layoutSimplification ?? false,
      },
      { upsert: true, new: true }
    );

    const targetSizeValue = Number.parseInt(String(settings.targetSize), 10);

    await User.findOneAndUpdate(
      { userId },
      {
        $set: {
          'currentSettings.fontSize': settings.fontSize,
          'currentSettings.lineHeight': settings.lineHeight,
          'currentSettings.theme': settings.theme,
          'currentSettings.contrastMode': settings.contrast,
          'currentSettings.elementSpacing': settings.spacing,
          'currentSettings.targetSize': Number.isNaN(targetSizeValue) ? settings.targetSize : targetSizeValue,
          'currentSettings.tooltipAssist': settings.tooltipAssist,
          'currentSettings.layoutSimplification': settings.layoutSimplification
        }
      },
      { upsert: true }
    );

    console.log(`[Manual Settings] Settings updated successfully for ${userId}`);

    // Broadcast settings update to all connected clients via SSE
    broadcastSettingsUpdate(userId, {
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
      tooltipAssist: settings.tooltipAssist,
      layoutSimplification: settings.layoutSimplification,
    }, 'manual');

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
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        tooltipAssist: settings.tooltipAssist,
        layoutSimplification: settings.layoutSimplification,
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
        tooltipAssist: false,
        layoutSimplification: false,
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
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        tooltipAssist: settings.tooltipAssist,
        layoutSimplification: settings.layoutSimplification,
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

/**
 * POST /api/manual-settings/apply
 * Quick apply settings and broadcast via SSE (for demos and RL optimization)
 */
router.post('/apply', async (req, res) => {
  try {
    const { userId, settings: newSettings } = req.body;

    if (!userId || !newSettings) {
      return res.status(400).json({
        success: false,
        error: 'userId and settings are required'
      });
    }

    console.log(`[Manual Settings] Quick apply for userId=${userId}`, newSettings);

    // Update settings in database
    const settings = await ManualSettings.findOneAndUpdate(
      { userId },
      {
        userId,
        enabled: true,
        ...(newSettings.fontSize && { fontSize: newSettings.fontSize }),
        ...(newSettings.lineHeight && { lineHeight: newSettings.lineHeight }),
        ...(newSettings.contrast && { contrast: newSettings.contrast }),
        ...(newSettings.spacing && { spacing: newSettings.spacing }),
        ...(newSettings.targetSize && { targetSize: newSettings.targetSize }),
        ...(newSettings.theme && { theme: newSettings.theme }),
        ...(newSettings.reducedMotion !== undefined && { reducedMotion: newSettings.reducedMotion }),
        ...(newSettings.primaryColor && { primaryColor: newSettings.primaryColor }),
        ...(newSettings.secondaryColor && { secondaryColor: newSettings.secondaryColor }),
        ...(newSettings.accentColor && { accentColor: newSettings.accentColor }),
        ...(newSettings.tooltipAssist !== undefined && { tooltipAssist: newSettings.tooltipAssist }),
        ...(newSettings.layoutSimplification !== undefined && { layoutSimplification: newSettings.layoutSimplification }),
      },
      { upsert: true, new: true }
    );

    // Also update User.currentSettings for dashboard persistence
    const userUpdateData = {};
    if (newSettings.fontSize) userUpdateData['currentSettings.fontSize'] = newSettings.fontSize;
    if (newSettings.lineHeight) userUpdateData['currentSettings.lineHeight'] = newSettings.lineHeight;
    if (newSettings.theme) userUpdateData['currentSettings.theme'] = newSettings.theme;
    if (newSettings.contrast) userUpdateData['currentSettings.contrastMode'] = newSettings.contrast;
    if (newSettings.spacing) userUpdateData['currentSettings.elementSpacing'] = newSettings.spacing;
    if (newSettings.targetSize) {
      const targetSizeValue = Number.parseInt(String(newSettings.targetSize), 10);
      userUpdateData['currentSettings.targetSize'] = Number.isNaN(targetSizeValue) ? newSettings.targetSize : targetSizeValue;
    }
    if (newSettings.tooltipAssist !== undefined) userUpdateData['currentSettings.tooltipAssist'] = newSettings.tooltipAssist;
    if (newSettings.layoutSimplification !== undefined) userUpdateData['currentSettings.layoutSimplification'] = newSettings.layoutSimplification;

    if (Object.keys(userUpdateData).length > 0) {
      await User.findOneAndUpdate(
        { userId },
        { $set: userUpdateData },
        { upsert: true }
      );
      console.log(`[Manual Settings] ✅ User.currentSettings updated for ${userId}`, userUpdateData);
    }

    // Broadcast via SSE
    broadcastSettingsUpdate(userId, newSettings, 'manual');

    console.log(`[Manual Settings] ✅ Settings applied and broadcasted for ${userId}`);

    res.json({
      success: true,
      userId,
      message: 'Settings applied and broadcasted',
      settings: newSettings
    });
  } catch (error) {
    console.error('[Manual Settings] Error applying settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply settings',
      details: error.message
    });
  }
});

module.exports = router;
