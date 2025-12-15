import React from 'react';

function UserInfo({ userId, userData, onUserChange }) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-16">
                <span className="text-2xl font-bold">
                  {userId?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold">User ID: {userId}</h3>
              <p className="flex items-center gap-2 text-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </span>
                Active Session
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="badge badge-outline badge-lg">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserInfo;
