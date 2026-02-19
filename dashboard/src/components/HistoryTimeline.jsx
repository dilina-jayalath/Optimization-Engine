import React from 'react';

function HistoryTimeline({ history, currentIndex, onRevert }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-xl font-semibold mb-2">No changes yet</h3>
        <p className="text-base-content/60">Your change history will appear here</p>
      </div>
    );
  }

  const getSourceBadge = (source) => {
    const badges = {
      ml: { class: 'badge-primary', icon: '🤖', label: 'ML' },
      manual: { class: 'badge-secondary', icon: '✋', label: 'Manual' },
      system: { class: 'badge-accent', icon: '⚙️', label: 'System' }
    };
    const badge = badges[source] || badges.system;
    return <span className={`badge ${badge.class} gap-1`}>{badge.icon} {badge.label}</span>;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChangedSettings = (current, previous) => {
    if (!previous) return Object.keys(current);

    return Object.keys(current).filter(key => {
      return JSON.stringify(current[key]) !== JSON.stringify(previous[key]);
    });
  };

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
      {history.map((item, index) => {
        const isCurrent = index === currentIndex;
        const changedSettings = index > 0
          ? getChangedSettings(item.settings, history[index - 1].settings)
          : Object.keys(item.settings);

        return (
          <div
            key={item.id}
            className={`card ${isCurrent ? 'bg-primary/10 border-2 border-primary' : 'bg-base-200'} shadow-md hover:shadow-lg transition-all`}
          >
            <div className="card-body p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base">{item.name}</h3>
                  {getSourceBadge(item.source)}
                </div>
                <div className="text-xs opacity-70 whitespace-nowrap">
                  {formatTime(item.timestamp)}
                </div>
              </div>

              {item.description && (
                <p className="text-sm opacity-80 mb-3">{item.description}</p>
              )}

              <div className="bg-base-100 rounded-lg p-3">
                <div className="text-xs font-semibold mb-2 opacity-70">
                  {changedSettings.length} setting(s) changed:
                </div>
                <div className="space-y-2">
                  {changedSettings.slice(0, 5).map(key => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="badge badge-sm badge-ghost">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {index > 0 && (
                          <span className="text-error line-through opacity-60">
                            {String(history[index - 1].settings[key])}
                          </span>
                        )}
                        <span className="opacity-50">→</span>
                        <span className="text-success font-medium">
                          {String(item.settings[key])}
                        </span>
                      </div>
                    </div>
                  ))}
                  {changedSettings.length > 5 && (
                    <div className="text-xs opacity-60 mt-2">
                      +{changedSettings.length - 5} more changes
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3">
                {!isCurrent ? (
                  <button
                    className="btn btn-secondary btn-sm w-full"
                    onClick={() => onRevert(index)}
                    title="Revert to this version"
                  >
                    ↶ Revert to this version
                  </button>
                ) : (
                  <div className="alert alert-success py-2">
                    <span className="text-sm">✓ Current State</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default HistoryTimeline;
