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
  const [settings, setSettings] = useState({
    fontSize: 'medium',
    targetSize: 32,
    lineHeight: 1.5,
    theme: 'light',
    contrastMode: 'normal',
    elementSpacing: 'normal'
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load user settings from backend on mount
  useEffect(() => {
    loadUserSettings();
  }, [userId]);

  // Apply initial settings on mount
  useEffect(() => {
    console.log('🚀 Initial mount - applying default settings');
    applyAllSettings(settings);
  }, []);

  const loadUserSettings = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
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

        console.log('📥 Backend settings:', { baseSettings, rlSettings, mergedSettings });

        setSettings(prev => ({
          ...prev,
          ...mergedSettings
        }));

        console.log('✅ Loaded and merged user settings from backend');
      }
      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load user settings:', error);
      setIsLoaded(true);
    }
  };

  // Apply settings to DOM whenever they change
  useEffect(() => {
    console.log('🔄 Settings changed, applying to DOM:', settings);
    applyAllSettings(settings);
  }, [settings]);

  const applyAllSettings = (newSettings) => {
    console.log('🎨 Applying all settings to website:', newSettings);

    // Ensure DOM is ready
    if (!document.body) {
      console.warn('⚠️ DOM not ready, skipping settings application');
      return;
    }

    // Font Size - Use !important to override Tailwind
    if (newSettings.fontSize) {
      const fontSizeMap = {
        'small': '14px',
        'medium': '16px',
        'large': '18px',
        'x-large': '20px'
      };
      const size = fontSizeMap[newSettings.fontSize] || newSettings.fontSize;

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
      console.log(`✅ Applied fontSize: ${size}`);
    }

    // Target/Button Size
    if (newSettings.targetSize) {
      const size = Number(newSettings.targetSize);

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
      console.log(`✅ Applied targetSize: ${size}px`);
    }

    // Line Height
    if (newSettings.lineHeight) {
      const lineHeight = Number(newSettings.lineHeight);

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
      console.log(`✅ Applied lineHeight: ${lineHeight}`);
    }

    // Theme - DaisyUI requires 'data-theme' on html element
    if (newSettings.theme) {
      const html = document.documentElement;
      html.setAttribute('data-theme', newSettings.theme);
      // Force DaisyUI theme refresh
      html.className = html.className; // Trigger re-render
      console.log(`✅ Applied theme: ${newSettings.theme}`);
    }

    // Contrast Mode
    if (newSettings.contrastMode) {
      document.documentElement.setAttribute('data-contrast', newSettings.contrastMode);

      const style = document.createElement('style');
      style.id = 'rl-contrast-override';
      const oldStyle = document.getElementById('rl-contrast-override');
      if (oldStyle) oldStyle.remove();

      if (newSettings.contrastMode === 'high') {
        style.textContent = `
          body {
            filter: contrast(1.5) !important;
          }
        `;
        document.head.appendChild(style);
      }
      console.log(`✅ Applied contrastMode: ${newSettings.contrastMode}`);
    }

    // Element Spacing
    if (newSettings.elementSpacing) {
      const spacingMap = {
        compact: '0.25rem',
        normal: '0.5rem',
        spacious: '1rem'
      };
      const spacing = spacingMap[newSettings.elementSpacing] || '0.5rem';

      const style = document.createElement('style');
      style.id = 'rl-spacing-override';
      const oldStyle = document.getElementById('rl-spacing-override');
      if (oldStyle) oldStyle.remove();

      style.textContent = `
        .gap-2, .gap-4, .gap-6, .space-y-4, .space-y-6 {
          gap: ${spacing} !important;
        }
      `;
      document.head.appendChild(style);
      console.log(`✅ Applied elementSpacing: ${spacing}`);
    }

    // Branding Colors
    if (newSettings.primaryColor) {
      document.documentElement.style.setProperty('--p', hexToHsl(newSettings.primaryColor));
      console.log(`✅ Applied primaryColor: ${newSettings.primaryColor}`);
    }
    if (newSettings.secondaryColor) {
      document.documentElement.style.setProperty('--s', hexToHsl(newSettings.secondaryColor));
      console.log(`✅ Applied secondaryColor: ${newSettings.secondaryColor}`);
    }
    if (newSettings.accentColor) {
      document.documentElement.style.setProperty('--a', hexToHsl(newSettings.accentColor));
      console.log(`✅ Applied accentColor: ${newSettings.accentColor}`);
    }

    // Reduced Motion
    if (newSettings.reducedMotion) {
      const style = document.createElement('style');
      style.id = 'rl-motion-override';
      const oldStyle = document.getElementById('rl-motion-override');
      if (oldStyle) oldStyle.remove();

      style.textContent = `
        *, ::before, ::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      `;
      document.head.appendChild(style);
      console.log('✅ Applied reducedMotion: true');
    } else {
      const oldStyle = document.getElementById('rl-motion-override');
      if (oldStyle) oldStyle.remove();
    }

    console.log('✅ All settings applied successfully');
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
    console.log(`✨ Updating ${parameter} to ${value}`);

    // Update state first
    setSettings(prev => {
      const updated = {
        ...prev,
        [parameter]: value
      };
      // Apply settings immediately after state update
      setTimeout(() => applyAllSettings(updated), 0);
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
    console.log('✨ Updating multiple settings:', newSettings);

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
    setSettings({
      fontSize: 'medium',
      targetSize: 32,
      lineHeight: 1.5,
      theme: 'light',
      contrastMode: 'normal',
      elementSpacing: 'normal'
    });
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSetting,
      updateMultipleSettings,
      resetSettings,
      reloadSettings: loadUserSettings,
      isLoaded
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
