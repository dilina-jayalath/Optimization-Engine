const express = require('express');
const router = express.Router();
const { ManualSettings, User } = require('../mongodb/schemas');
const { broadcastSettingsUpdate } = require('./settings-events');
const { invalidateUserCache } = require('../utils/session-cache');

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
        font_size: settings.font_size,
        line_height: settings.line_height,
        contrast_mode: settings.contrast_mode,
        element_spacing_x: settings.element_spacing_x,
        element_spacing_y: settings.element_spacing_y,
        element_padding_x: settings.element_padding_x,
        element_padding_y: settings.element_padding_y,
        target_size: settings.target_size,
        theme: settings.theme,
        reduced_motion: settings.reduced_motion,
        primary_color: settings.primary_color,
        primary_color_content: settings.primary_color_content,
        secondary_color: settings.secondary_color,
        secondary_color_content: settings.secondary_color_content,
        accent_color: settings.accent_color,
        accent_color_content: settings.accent_color_content,
        tooltip_assist: settings.tooltip_assist,
        layout_simplification: settings.layout_simplification,
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
    const settings = await ManualSettings.findOneAndUpdate(
      { userId },
      {
        userId,
        enabled: req.body.enabled ?? true,
        font_size: req.body.font_size || 16,
        line_height: req.body.line_height || 1.5,
        contrast_mode: req.body.contrast_mode || 'normal',
        element_spacing_x: req.body.element_spacing_x || 8,
        element_spacing_y: req.body.element_spacing_y || 8,
        element_padding_x: req.body.element_padding_x || 8,
        element_padding_y: req.body.element_padding_y || 8,
        target_size: req.body.target_size || 44,
        theme: req.body.theme || 'light',
        reduced_motion: req.body.reduced_motion ?? false,
        primary_color: req.body.primary_color || '#007bff',
        primary_color_content: req.body.primary_color_content || '#ffffff',
        secondary_color: req.body.secondary_color || '#6c757d',
        secondary_color_content: req.body.secondary_color_content || '#ffffff',
        accent_color: req.body.accent_color || '#28a745',
        accent_color_content: req.body.accent_color_content || '#ffffff',
        tooltip_assist: req.body.tooltip_assist ?? false,
        layout_simplification: req.body.layout_simplification ?? false,
      },
      { upsert: true, new: true }
    );

    const targetSizeValue = Number.parseInt(String(settings.target_size), 10);

    await User.findOneAndUpdate(
      { userId },
      {
        $set: {
          'currentSettings.font_size': settings.font_size,
          'currentSettings.line_height': settings.line_height,
          'currentSettings.theme': settings.theme,
          'currentSettings.contrast_mode': settings.contrast_mode,
          'currentSettings.element_spacing_x': settings.element_spacing_x,
          'currentSettings.element_spacing_y': settings.element_spacing_y,
          'currentSettings.element_padding_x': settings.element_padding_x,
          'currentSettings.element_padding_y': settings.element_padding_y,
          'currentSettings.target_size': Number.isNaN(targetSizeValue) ? settings.target_size : targetSizeValue,
          'currentSettings.tooltip_assist': settings.tooltip_assist,
          'currentSettings.layout_simplification': settings.layout_simplification,
          'currentSettings.reduced_motion': settings.reduced_motion,
          'currentSettings.primary_color': settings.primary_color,
          'currentSettings.secondary_color': settings.secondary_color,
          'currentSettings.accent_color': settings.accent_color
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

    invalidateUserCache(userId);

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
        font_size: 16,
        line_height: 1.5,
        contrast_mode: 'normal',
        element_spacing_x: 8,
        element_spacing_y: 8,
        element_padding_x: 8,
        element_padding_y: 8,
        target_size: 44,
        theme: 'light',
        reduced_motion: false,
        primary_color: '#007bff',
        primary_color_content: '#ffffff',
        secondary_color: '#6c757d',
        secondary_color_content: '#ffffff',
        accent_color: '#28a745',
        accent_color_content: '#ffffff',
        tooltip_assist: false,
        layout_simplification: false,
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
        font_size: settings.font_size,
        line_height: settings.line_height,
        contrast_mode: settings.contrast_mode,
        element_spacing_x: settings.element_spacing_x,
        element_spacing_y: settings.element_spacing_y,
        element_padding_x: settings.element_padding_x,
        element_padding_y: settings.element_padding_y,
        target_size: settings.target_size,
        theme: settings.theme,
        reduced_motion: settings.reduced_motion,
        primary_color: settings.primary_color,
        primary_color_content: settings.primary_color_content,
        secondary_color: settings.secondary_color,
        secondary_color_content: settings.secondary_color_content,
        accent_color: settings.accent_color,
        accent_color_content: settings.accent_color_content,
        tooltip_assist: settings.tooltip_assist,
        layout_simplification: settings.layout_simplification,
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
        ...(newSettings.font_size && { font_size: newSettings.font_size }),
        ...(newSettings.line_height && { line_height: newSettings.line_height }),
        ...(newSettings.contrast_mode && { contrast_mode: newSettings.contrast_mode }),
        ...(newSettings.element_spacing_x && { element_spacing_x: newSettings.element_spacing_x }),
        ...(newSettings.element_spacing_y && { element_spacing_y: newSettings.element_spacing_y }),
        ...(newSettings.element_padding_x && { element_padding_x: newSettings.element_padding_x }),
        ...(newSettings.element_padding_y && { element_padding_y: newSettings.element_padding_y }),
        ...(newSettings.target_size && { target_size: newSettings.target_size }),
        ...(newSettings.theme && { theme: newSettings.theme }),
        ...(newSettings.reduced_motion !== undefined && { reduced_motion: newSettings.reduced_motion }),
        ...(newSettings.primary_color && { primary_color: newSettings.primary_color }),
        ...(newSettings.primary_color_content && { primary_color_content: newSettings.primary_color_content }),
        ...(newSettings.secondary_color && { secondary_color: newSettings.secondary_color }),
        ...(newSettings.secondary_color_content && { secondary_color_content: newSettings.secondary_color_content }),
        ...(newSettings.accent_color && { accent_color: newSettings.accent_color }),
        ...(newSettings.accent_color_content && { accent_color_content: newSettings.accent_color_content }),
        ...(newSettings.tooltip_assist !== undefined && { tooltip_assist: newSettings.tooltip_assist }),
        ...(newSettings.layout_simplification !== undefined && { layout_simplification: newSettings.layout_simplification }),
      },
      { upsert: true, new: true }
    );

    // Also update User.currentSettings for dashboard persistence
    const userUpdateData = {};
    if (newSettings.font_size) userUpdateData['currentSettings.font_size'] = newSettings.font_size;
    if (newSettings.line_height) userUpdateData['currentSettings.line_height'] = newSettings.line_height;
    if (newSettings.theme) userUpdateData['currentSettings.theme'] = newSettings.theme;
    if (newSettings.contrast_mode) userUpdateData['currentSettings.contrast_mode'] = newSettings.contrast_mode;
    if (newSettings.element_spacing_x) userUpdateData['currentSettings.element_spacing_x'] = newSettings.element_spacing_x;
    if (newSettings.element_spacing_y) userUpdateData['currentSettings.element_spacing_y'] = newSettings.element_spacing_y;
    if (newSettings.element_padding_x) userUpdateData['currentSettings.element_padding_x'] = newSettings.element_padding_x;
    if (newSettings.element_padding_y) userUpdateData['currentSettings.element_padding_y'] = newSettings.element_padding_y;
    if (newSettings.target_size) {
      const targetSizeValue = Number.parseInt(String(newSettings.target_size), 10);
      userUpdateData['currentSettings.target_size'] = Number.isNaN(targetSizeValue) ? newSettings.target_size : targetSizeValue;
    }
    if (newSettings.tooltip_assist !== undefined) userUpdateData['currentSettings.tooltip_assist'] = newSettings.tooltip_assist;
    if (newSettings.layout_simplification !== undefined) userUpdateData['currentSettings.layout_simplification'] = newSettings.layout_simplification;


    if (Object.keys(userUpdateData).length > 0) {
      await User.findOneAndUpdate(
        { userId },
        { $set: userUpdateData },
        { upsert: true }
      );
      console.log(`[Manual Settings]  User.currentSettings updated for ${userId}`, userUpdateData);
    }

    // Broadcast via SSE
    broadcastSettingsUpdate(userId, newSettings, 'manual');

    // Invalidate Personalization Cache so next load gets new settings
    invalidateUserCache(userId);

    console.log(`[Manual Settings]  Settings applied and broadcasted for ${userId}`);

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
