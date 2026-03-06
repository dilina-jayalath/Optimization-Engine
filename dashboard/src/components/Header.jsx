import React from 'react';
import { Sparkles } from 'lucide-react';

function Header() {
  return (
    <div className="hero bg-gradient-to-r from-primary to-secondary rounded-box shadow-xl border border-base-100/20">
      <div className="hero-content text-center py-10">
        <div className="space-y-3">
          <span className="badge badge-neutral badge-outline text-xs tracking-wide uppercase">Client Dashboard</span>
          <h1 className="text-4xl md:text-5xl font-bold text-primary-content flex items-center justify-center gap-4">
            <img src="/aura.svg" alt="Aura Logo" className="w-14 h-14 md:w-16 md:h-16" />
            Aura Dashboard
          </h1>
          <p className="text-base md:text-lg text-primary-content/90 max-w-2xl mx-auto">
            Monitor adaptive settings, track model decisions, and manage user experience updates in one place.
          </p>
          <div className="flex justify-center">
            <div className="badge badge-ghost text-primary-content border-primary-content/30 gap-1">
              <Sparkles size={14} /> Live optimization controls
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
