import React from 'react';

function Header() {
  return (
    <div className="hero bg-gradient-to-r from-primary to-secondary rounded-box shadow-xl">
      <div className="hero-content text-center py-8">
        <div>
          <h1 className="text-5xl font-bold text-primary-content flex items-center justify-center gap-3">
            <span className="text-6xl">🎨</span>
            Adaptive UI Dashboard
          </h1>
          <p className="py-4 text-lg text-primary-content/80">
            Monitor and manage your personalized UI changes
          </p>
        </div>
      </div>
    </div>
  );
}

export default Header;
