import React from 'react';
import { useSettings } from '../contexts/SettingsContext';

function SettingsDisplay() {
  const { settings } = useSettings();

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-xl">️ Active Settings (Live)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title">Font Size</div>
            <div className="stat-value text-2xl">{settings.fontSize}</div>
          </div>
          
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title">Button Size</div>
            <div className="stat-value text-2xl">{settings.targetSize}px</div>
          </div>
          
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title">Line Height</div>
            <div className="stat-value text-2xl">{settings.lineHeight}</div>
          </div>
          
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title">Theme</div>
            <div className="stat-value text-2xl capitalize">{settings.theme}</div>
          </div>
          
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title">Contrast</div>
            <div className="stat-value text-2xl capitalize">{settings.contrastMode}</div>
          </div>
          
          <div className="stat bg-base-200 rounded-lg p-4">
            <div className="stat-title">Spacing</div>
            <div className="stat-value text-2xl capitalize">{settings.elementSpacing}</div>
          </div>
        </div>
        
        <div className="alert alert-success mt-4">
          <span> These settings are applied to the entire website in real-time!</span>
        </div>
      </div>
    </div>
  );
}

export default SettingsDisplay;
