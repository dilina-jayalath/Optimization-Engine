import React, { useEffect, useState } from 'react';
import { fetchEffectiveProfile, fetchTrialPreferences } from '../services/api';

function TrialInsights({ userId }) {
  const [profileData, setProfileData] = useState(null);
  const [trialData, setTrialData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profile, trials] = await Promise.all([
        fetchEffectiveProfile(userId),
        fetchTrialPreferences(userId)
      ]);

      setProfileData(profile);
      setTrialData(trials);
    } catch (error) {
      console.error('Failed to load trial insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
  };

  const renderProfile = () => {
    if (!profileData?.success) return null;
    const profile = profileData.effectiveProfile || {};
    const entries = Object.entries(profile);

    if (entries.length === 0) {
      return <p className="text-sm text-base-content/70">No effective profile data yet.</p>;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {entries.map(([key, value]) => (
          <div key={key} className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title">{key}</div>
            <div className="stat-value text-lg">{String(value)}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderPreferences = () => {
    const preferences = trialData?.preferences || [];
    if (preferences.length === 0) {
      return <p className="text-sm text-base-content/70">No preference states yet.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Current</th>
              <th>Preferred</th>
              <th>Locked</th>
              <th>Cooldown</th>
            </tr>
          </thead>
          <tbody>
            {preferences.map((pref) => (
              <tr key={`${pref.userId}-${pref.settingKey}`}>
                <td>{pref.settingKey}</td>
                <td>{pref.currentValue}</td>
                <td>{pref.preferredValue || '--'}</td>
                <td>{pref.locked ? 'yes' : 'no'}</td>
                <td>{formatDate(pref.cooldownUntil)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTrials = () => {
    const trials = trialData?.recentTrials || [];
    if (trials.length === 0) {
      return <p className="text-sm text-base-content/70">No recent trials yet.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Change</th>
              <th>Decision</th>
              <th>Anomaly</th>
              <th>Feedback</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((trial) => (
              <tr key={trial.trialId}>
                <td>{trial.settingKey}</td>
                <td>{trial.oldValue} → {trial.newValue}</td>
                <td>{trial.decision}</td>
                <td>{typeof trial.anomalyScore === 'number' ? trial.anomalyScore.toFixed(2) : '--'}</td>
                <td>{trial.feedback?.type || '--'}</td>
                <td>{formatDate(trial.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-xl">Trial-Based Insights</h2>
          <button className="btn btn-sm btn-outline" onClick={loadData}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2">
            <span className="loading loading-spinner loading-sm text-primary"></span>
            <span className="text-sm">Loading trial data...</span>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Effective Profile</h3>
              <span className="badge badge-outline">
                locked: {profileData?.meta?.lockedSettings?.length || 0}
              </span>
            </div>
            {renderProfile()}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Preference States</h3>
            {renderPreferences()}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Recent Trials</h3>
            {renderTrials()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrialInsights;
