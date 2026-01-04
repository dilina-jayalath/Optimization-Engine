import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { submitFeedback, updateManualSettings } from '../services/api';

function ManualSettingsControl({ userId, onSettingChange }) {
  const { settings, updateSetting } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleManualChange = async (parameter, newValue) => {
    const oldValue = settings[parameter];

    if (oldValue === newValue) {
      console.log('⚠️ No change detected');
      return;
    }

    setIsSaving(true);

    try {
      // Update UI immediately
      updateSetting(parameter, newValue);

      const nextSettings = {
        ...settings,
        [parameter]: newValue
      };

      await updateManualSettings(userId, {
        enabled: true,
        fontSize: nextSettings.fontSize,
        lineHeight: nextSettings.lineHeight,
        contrast: nextSettings.contrastMode,
        spacing: nextSettings.elementSpacing,
        targetSize: nextSettings.targetSize,
        theme: nextSettings.theme,
        theme: nextSettings.theme,
        reducedMotion: nextSettings.reducedMotion ?? false,
        tooltipAssist: nextSettings.tooltipAssist ?? false,
        layoutSimplification: nextSettings.layoutSimplification ?? false,
        primaryColor: nextSettings.primaryColor,
        secondaryColor: nextSettings.secondaryColor,
        accentColor: nextSettings.accentColor
      });

      // Send to backend as implicit positive feedback
      // User manually chose this value = they want it = positive feedback
      const feedbackData = {
        parameter: parameter,
        currentValue: oldValue,
        feedback: {
          type: 'positive',
          rating: 5, // Manual selection = strong positive signal
          comment: `User manually changed ${parameter} from ${oldValue} to ${newValue}`,
          accepted: true,
          responseTime: 0,
          isManualSelection: true // Flag to indicate this was a manual choice
        },
        context: {
          deviceType: getDeviceType(),
          timeOfDay: getTimeOfDay(),
          sessionDuration: 60000,
          interactionCount: 1,
          pageUrl: window.location.href,
          source: 'manual_control'
        },
        optimization: {
          parameter: parameter,
          oldValue: oldValue,
          newValue: newValue,
          suggestedBy: 'user_manual'
        }
      };

      console.log('📤 Sending manual change as positive feedback to RL:', feedbackData);
      const result = await submitFeedback(userId, feedbackData);
      console.log('✅ RL model learned from manual change:', result);

      if (onSettingChange) {
        onSettingChange({ parameter, oldValue, newValue });
      }
    } catch (error) {
      console.error('❌ Error sending manual change to RL:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getDeviceType = () => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary gap-2"
      >
        ⚙️ Manual Settings
      </button>

      {isOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-2xl mb-4">⚙️ Manual Settings Control</h3>
            <p className="text-sm opacity-70 mb-6">
              Your manual changes help train the RL model! 🤖 Each selection teaches the AI your preferences.
            </p>

            <div className="space-y-6">
              {/* Font Size */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Font Size</span>
                  <span className="label-text-alt">Current: {settings.fontSize}</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={settings.fontSize}
                  onChange={(e) => handleManualChange('fontSize', e.target.value)}
                  disabled={isSaving}
                >
                  <option value="small">Small (14px)</option>
                  <option value="medium">Medium (16px)</option>
                  <option value="large">Large (18px)</option>
                  <option value="x-large">X-Large (20px)</option>
                </select>
              </div>

              {/* Target Size */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Button Size</span>
                  <span className="label-text-alt">Current: {settings.targetSize}px</span>
                </label>
                <input
                  type="range"
                  min="24"
                  max="48"
                  step="4"
                  value={settings.targetSize}
                  onChange={(e) => handleManualChange('targetSize', Number(e.target.value))}
                  className="range range-primary"
                  disabled={isSaving}
                />
                <div className="w-full flex justify-between text-xs px-2 mt-2">
                  <span>24px</span>
                  <span>32px</span>
                  <span>40px</span>
                  <span>48px</span>
                </div>
              </div>

              {/* Line Height */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Line Height</span>
                  <span className="label-text-alt">Current: {settings.lineHeight}</span>
                </label>
                <input
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.1"
                  value={settings.lineHeight}
                  onChange={(e) => handleManualChange('lineHeight', Number(e.target.value))}
                  className="range range-primary"
                  disabled={isSaving}
                />
                <div className="w-full flex justify-between text-xs px-2 mt-2">
                  <span>1.2</span>
                  <span>1.5</span>
                  <span>1.8</span>
                  <span>2.0</span>
                </div>
              </div>

              {/* Theme */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Theme</span>
                  <span className="label-text-alt">Current: {settings.theme}</span>
                </label>
                <div className="join w-full">
                  <button
                    className={`btn join-item flex-1 ${settings.theme === 'light' ? 'btn-active' : 'btn-outline'}`}
                    onClick={() => handleManualChange('theme', 'light')}
                    disabled={isSaving}
                  >
                    ☀️ Light
                  </button>
                  <button
                    className={`btn join-item flex-1 ${settings.theme === 'dark' ? 'btn-active' : 'btn-outline'}`}
                    onClick={() => handleManualChange('theme', 'dark')}
                    disabled={isSaving}
                  >
                    🌙 Dark
                  </button>
                </div>
              </div>

              {/* Contrast Mode */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Contrast Mode</span>
                  <span className="label-text-alt">Current: {settings.contrastMode}</span>
                </label>
                <div className="join w-full">
                  <button
                    className={`btn join-item flex-1 ${settings.contrastMode === 'normal' ? 'btn-active' : 'btn-outline'}`}
                    onClick={() => handleManualChange('contrastMode', 'normal')}
                    disabled={isSaving}
                  >
                    Normal
                  </button>
                  <button
                    className={`btn join-item flex-1 ${settings.contrastMode === 'high' ? 'btn-active' : 'btn-outline'}`}
                    onClick={() => handleManualChange('contrastMode', 'high')}
                    disabled={isSaving}
                  >
                    High
                  </button>
                </div>
              </div>

              {/* Element Spacing */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Element Spacing</span>
                  <span className="label-text-alt">Current: {settings.elementSpacing}</span>
                </label>
                <div className="join w-full">
                  <button
                    className={`btn join-item flex-1 ${settings.elementSpacing === 'compact' ? 'btn-active' : 'btn-outline'}`}
                    onClick={() => handleManualChange('elementSpacing', 'compact')}
                    disabled={isSaving}
                  >
                    Compact
                  </button>
                  <button
                    className={`btn join-item flex-1 ${settings.elementSpacing === 'normal' ? 'btn-active' : 'btn-outline'}`}
                    onClick={() => handleManualChange('elementSpacing', 'normal')}
                    disabled={isSaving}
                  >
                    Normal
                  </button>
                  <button
                    className={`btn join-item flex-1 ${settings.elementSpacing === 'spacious' ? 'btn-active' : 'btn-outline'}`}
                    onClick={() => handleManualChange('elementSpacing', 'spacious')}
                    disabled={isSaving}
                  >
                    Spacious
                  </button>
                </div>
              </div>

              {/* Accessibility Section */}
              <div className="divider text-sm font-bold opacity-50">ACCESSIBILITY</div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text font-semibold">Reduced Motion</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={settings.reducedMotion || false}
                    onChange={(e) => handleManualChange('reducedMotion', e.target.checked)}
                    disabled={isSaving}
                  />
                </label>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text font-semibold">Tooltip Assist</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={settings.tooltipAssist || false}
                    onChange={(e) => handleManualChange('tooltipAssist', e.target.checked)}
                    disabled={isSaving}
                  />
                </label>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text font-semibold">Layout Simplification</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={settings.layoutSimplification || false}
                    onChange={(e) => handleManualChange('layoutSimplification', e.target.checked)}
                    disabled={isSaving}
                  />
                </label>
              </div>

              {/* Branding Section */}
              <div className="divider text-sm font-bold opacity-50">BRANDING COLORS</div>

              <div className="grid grid-cols-3 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-xs">Primary</span>
                  </label>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-lg border border-base-300"
                    value={settings.primaryColor || '#007bff'}
                    onChange={(e) => handleManualChange('primaryColor', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-xs">Secondary</span>
                  </label>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-lg border border-base-300"
                    value={settings.secondaryColor || '#6c757d'}
                    onChange={(e) => handleManualChange('secondaryColor', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-xs">Accent</span>
                  </label>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-lg border border-base-300"
                    value={settings.accentColor || '#28a745'}
                    onChange={(e) => handleManualChange('accentColor', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Info Alert */}
              <div className="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>🤖 The RL model learns from your manual choices as strong positive feedback!</span>
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={() => setIsOpen(false)}
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Done'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !isSaving && setIsOpen(false)}></div>
        </div>
      )}
    </>
  );
}

export default ManualSettingsControl;
