import React from 'react';

function ComparisonView({ currentSettings, previousSettings }) {
  if (!currentSettings) {
    return (
      <div className="text-center py-8 opacity-60">
        <p>No settings available</p>
      </div>
    );
  }

  const settingKeys = Object.keys(currentSettings);
  const hasChanges = previousSettings && JSON.stringify(currentSettings) !== JSON.stringify(previousSettings);

  return (
    <div className="max-h-[600px] overflow-y-auto">
      {hasChanges && previousSettings ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card bg-base-200">
            <div className="card-body p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-warning">←</span> Previous
              </h4>
              <div className="space-y-2">
                {settingKeys.map(key => (
                  <div key={key} className="flex justify-between items-center p-2 bg-base-100 rounded">
                    <span className="text-sm font-medium opacity-70">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="badge badge-ghost">
                      {String(previousSettings[key])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card bg-primary/10 border-2 border-primary">
            <div className="card-body p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-success"></span> Current
              </h4>
              <div className="space-y-2">
                {settingKeys.map(key => {
                  const isChanged = previousSettings[key] !== currentSettings[key];
                  return (
                    <div 
                      key={key} 
                      className={`flex justify-between items-center p-2 rounded ${
                        isChanged ? 'bg-success/20 border-2 border-success' : 'bg-base-100'
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${isChanged ? 'badge-success' : 'badge-ghost'}`}>
                          {String(currentSettings[key])}
                        </span>
                        {isChanged && <span className="text-lg"></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="space-y-2">
              {settingKeys.map(key => (
                <div key={key} className="flex justify-between items-center p-2 bg-base-100 rounded">
                  <span className="text-sm font-medium">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="badge badge-primary">
                    {String(currentSettings[key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ComparisonView;
