import React from 'react';

function Header() {
  return (
    <div className="hero bg-gradient-to-r from-primary to-secondary rounded-box shadow-xl">
      <div className="hero-content text-center py-8">
        <div>
          <h1 className="text-5xl font-bold text-primary-content flex items-center justify-center gap-4">
            <img src="/aura.svg" alt="Aura Logo" className="w-16 h-16" />
            Aura Dashboard
          </h1>
          <p className="py-4 text-lg text-primary-content/80">
            Unleash the future of Adaptive UI
          </p>
        </div>
      </div>
    </div>
  );
}

export default Header;
