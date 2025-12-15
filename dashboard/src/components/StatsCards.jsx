import React from 'react';

function StatsCards({ stats }) {
  return (
    <div className="stats stats-vertical lg:stats-horizontal shadow-xl bg-base-100 w-full">
      <div className="stat">
        <div className="stat-figure text-primary text-4xl">📊</div>
        <div className="stat-title">Total Changes</div>
        <div className="stat-value text-primary">{stats.totalChanges}</div>
        <div className="stat-desc">All modifications tracked</div>
      </div>

      <div className="stat">
        <div className="stat-figure text-secondary text-4xl">🤖</div>
        <div className="stat-title">ML Optimizations</div>
        <div className="stat-value text-secondary">{stats.mlChanges}</div>
        <div className="stat-desc">AI-driven improvements</div>
      </div>

      <div className="stat">
        <div className="stat-figure text-accent text-4xl">✋</div>
        <div className="stat-title">Manual Changes</div>
        <div className="stat-value text-accent">{stats.manualChanges}</div>
        <div className="stat-desc">User adjustments</div>
      </div>

      <div className="stat">
        <div className="stat-figure text-info text-4xl">⏱️</div>
        <div className="stat-title">Current Version</div>
        <div className="stat-value text-info">v{stats.currentVersion}</div>
        <div className="stat-desc">Latest state</div>
      </div>
    </div>
  );
}

export default StatsCards;
