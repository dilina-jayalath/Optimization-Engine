import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

export function SettingsProvider({ children, userId = 'u_001' }) {
  const DEFAULT_SETTINGS = {
    font_size: 16,
    target_size: 32,
    line_height: 1.5,
    theme: 'light',
    contrast_mode: 'normal',
    element_spacing_x: 8,
    element_spacing_y: 8,
    primary_color: '#1a73e8',
    secondary_color: '#1a73e8',
    accent_color: '#e37400'
  };

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [frozenSettings, setFrozenSettings] = useState(DEFAULT_SETTINGS);
  const [isPreviewEnabled, setIsPreviewEnabled] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load user settings from backend on mount
  useEffect(() => {
    loadUserSettings();
  }, [userId]);

  // Apply initial settings on mount
  useEffect(() => {
    console.log(' Initial mount - applying default settings');
    applyAllSettings(settings);
  }, []);

  const loadUserSettings = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/users/${userId}`);
      const data = await response.json();

      if (data.success && data.data) {
        // Merge current settings with RL suggestions (RL takes priority)
        const baseSettings = data.data.currentSettings || {};
        const rlSettings = data.data.rlSuggestedSettings || {};

        const mergedSettings = {
          ...baseSettings,
          ...rlSettings
        };

        console.log(' Backend settings:', { baseSettings, rlSettings, mergedSettings });

        setSettings(prev => ({
          ...prev,
          ...mergedSettings
        }));

        console.log(' Loaded and merged user settings from backend');
      }
      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load user settings:', error);
      setIsLoaded(true);
    }
  };

  // Apply settings to DOM whenever they change OR preview mode changes
  useEffect(() => {
    console.log(' Settings/Preview changed, applying to DOM');
    if (isPreviewEnabled) {
      applyAllSettings(settings);
    } else {
      // Use frozen settings when preview is disabled to maintain dashboard appearance
      applyAllSettings(frozenSettings);
    }
  }, [settings, isPreviewEnabled, frozenSettings]);

  const applyAllSettings = (newSettings) => {
    console.log(' Applying all settings to website:', newSettings);

    // Ensure DOM is ready
    if (!document.body) {
      console.warn('️ DOM not ready, skipping settings application');
      return;
    }

    // Font Size - Use !important to override Tailwind
    if (newSettings.font_size) {
      const size = `${newSettings.font_size}px`;

      // Remove existing fontSize style and re-apply with !important
      const style = document.createElement('style');
      style.id = 'rl-fontSize-override';
      // Remove old style if exists
      const oldStyle = document.getElementById('rl-fontSize-override');
      if (oldStyle) oldStyle.remove();

      style.textContent = `
        html, body, * {
          font-size: ${size} !important;
        }
      `;
      document.head.appendChild(style);
      console.log(` Applied font_size: ${size}`);
    }

    // Target/Button Size
    if (newSettings.target_size) {
      const size = Number(newSettings.target_size);

      const style = document.createElement('style');
      style.id = 'rl-targetSize-override';
      const oldStyle = document.getElementById('rl-targetSize-override');
      if (oldStyle) oldStyle.remove();

      style.textContent = `
        .btn, button {
          min-height: ${size}px !important;
          padding: ${size / 4}px ${size / 2}px !important;
        }
      `;
      document.head.appendChild(style);
      console.log(` Applied target_size: ${size}px`);
    }

    // Line Height
    if (newSettings.line_height) {
      const lineHeight = Number(newSettings.line_height);

      const style = document.createElement('style');
      style.id = 'rl-lineHeight-override';
      const oldStyle = document.getElementById('rl-lineHeight-override');
      if (oldStyle) oldStyle.remove();

      style.textContent = `
        html, body, * {
          line-height: ${lineHeight} !important;
        }
      `;
      document.head.appendChild(style);
      console.log(` Applied line_height: ${lineHeight}`);
    }

    // Theme - DaisyUI requires 'data-theme' on html element
    if (newSettings.theme) {
      const html = document.documentElement;
      html.setAttribute('data-theme', newSettings.theme);
      // Force DaisyUI theme refresh
      html.className = html.className; // Trigger re-render
      console.log(` Applied theme: ${newSettings.theme}`);
    }

    // Contrast Mode
    if (newSettings.contrast_mode) {
      document.documentElement.setAttribute('data-contrast', newSettings.contrast_mode);

      const style = document.createElement('style');
      style.id = 'rl-contrast-override';
      const oldStyle = document.getElementById('rl-contrast-override');
      if (oldStyle) oldStyle.remove();

      if (newSettings.contrast_mode === 'high') {
        style.textContent = `
          body {
            filter: contrast(1.5) !important;
          }
        `;
        document.head.appendChild(style);
      }
      console.log(` Applied contrast_mode: ${newSettings.contrast_mode}`);
    }

    // Element Spacing
    if (newSettings.element_spacing_x !== undefined || newSettings.element_spacing_y !== undefined) {
      const spacingX = newSettings.element_spacing_x || 8;
      const spacingY = newSettings.element_spacing_y || 8;

      const style = document.createElement('style');
      style.id = 'rl-spacing-override';
      const oldStyle = document.getElementById('rl-spacing-override');
      if (oldStyle) oldStyle.remove();

      style.textContent = `
        .gap-2, .gap-4, .gap-6, .space-x-4, .space-x-6, .flex-row {
          column-gap: ${spacingX}px !important;
        }
        .gap-2, .gap-4, .gap-6, .space-y-4, .space-y-6, .flex-col {
          row-gap: ${spacingY}px !important;
        }
      `;
      document.head.appendChild(style);
      console.log(` Applied element_spacing_x: ${spacingX}px, _y: ${spacingY}px`);
    }

    // Branding Colors
    if (newSettings.primary_color) {
      document.documentElement.style.setProperty('--p', hexToHsl(newSettings.primary_color));
      console.log(` Applied primary_color: ${newSettings.primary_color}`);
    }
    if (newSettings.secondary_color) {
      document.documentElement.style.setProperty('--s', hexToHsl(newSettings.secondary_color));
      console.log(` Applied secondary_color: ${newSettings.secondary_color}`);
    }
    if (newSettings.accent_color) {
      document.documentElement.style.setProperty('--a', hexToHsl(newSettings.accent_color));
      console.log(` Applied accent_color: ${newSettings.accent_color}`);
    }

    // Reduced Motion
    if (newSettings.reduced_motion !== undefined) {
      const style = document.createElement('style');
      style.id = 'rl-motion-override';
      const oldStyle = document.getElementById('rl-motion-override');
      if (oldStyle) oldStyle.remove();

      if (newSettings.reduced_motion) {
        style.textContent = `
          *, ::before, ::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        `;
        document.head.appendChild(style);
        console.log(' Applied reduced_motion: true');
      }
    }

    console.log(' All settings applied successfully');
  };

  // Helper to convert Hex to HSL for DaisyUI
  const hexToHsl = (hex) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt('0x' + hex[1] + hex[1]);
      g = parseInt('0x' + hex[2] + hex[2]);
      b = parseInt('0x' + hex[3] + hex[3]);
    } else if (hex.length === 7) {
      r = parseInt('0x' + hex[1] + hex[2]);
      g = parseInt('0x' + hex[3] + hex[4]);
      b = parseInt('0x' + hex[5] + hex[6]);
    }
    // Convert to HSL
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    // DaisyUI expects just the numbers "H S% L%" for --p, --s etc.
    return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
  };

  const updateSetting = (parameter, value) => {
    console.log(` Updating ${parameter} to ${value}`);

    // Update state first
    setSettings(prev => {
      const updated = {
        ...prev,
        [parameter]: value
      };
      return updated;
    });

    // Visual feedback - flash effect
    document.body.style.transition = 'opacity 0.3s';
    document.body.style.opacity = '0.8';
    setTimeout(() => {
      document.body.style.opacity = '1';
    }, 300);
  };

  const updateMultipleSettings = (newSettings) => {
    console.log(' Updating multiple settings:', newSettings);

    setSettings(prev => ({
      ...prev,
      ...newSettings
    }));

    // Visual feedback - flash effect
    document.body.style.transition = 'opacity 0.3s';
    document.body.style.opacity = '0.7';
    setTimeout(() => {
      document.body.style.opacity = '1';
    }, 300);
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSetting,
      updateMultipleSettings,
      resetSettings,
      reloadSettings: loadUserSettings,
      reloadSettings: loadUserSettings,
      isLoaded,
      isLoaded,
      isPreviewEnabled,
      setIsPreviewEnabled: (enabled) => {
        if (!enabled) {
          console.log('️ Freezing settings for dashboard preview off');
          setFrozenSettings(settings);
        }
        setIsPreviewEnabled(enabled);
      }
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
