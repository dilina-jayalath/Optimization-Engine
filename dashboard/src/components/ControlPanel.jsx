import React from 'react';
import { SlidersHorizontal, RotateCcw, RotateCw, Download, Trash2, Filter, Brain, Settings2, Hand } from 'lucide-react';

function ControlPanel({ 
  canUndo, 
  canRedo, 
  onUndo, 
  onRedo, 
  onExport, 
  onClear,
  filterType,
  onFilterChange 
}) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <SlidersHorizontal size={18} /> Controls
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-secondary btn-sm"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo last change (Ctrl+Z)"
              >
                <RotateCcw size={14} /> Undo
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo change (Ctrl+Y)"
              >
                <RotateCw size={14} /> Redo
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={onExport}
                title="Export history as JSON"
              >
                 <Download size={14} /> Export
              </button>
              <button
                className="btn btn-error btn-sm"
                onClick={onClear}
                title="Clear all history"
              >
                <Trash2 size={14} /> Clear History
              </button>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Filter size={18} /> Filter
            </h3>
            <div className="join">
              <button
                className={`btn btn-sm join-item ${filterType === 'all' ? 'btn-active' : 'btn-ghost'}`}
                onClick={() => onFilterChange('all')}
              >
                All
              </button>
              <button
                className={`btn btn-sm join-item ${filterType === 'ml' ? 'btn-active' : 'btn-ghost'}`}
                onClick={() => onFilterChange('ml')}
              >
                 <Brain size={14} /> ML
              </button>
              <button
                className={`btn btn-sm join-item ${filterType === 'manual' ? 'btn-active' : 'btn-ghost'}`}
                onClick={() => onFilterChange('manual')}
              >
                 <Hand size={14} /> Manual
              </button>
              <button
                className={`btn btn-sm join-item ${filterType === 'system' ? 'btn-active' : 'btn-ghost'}`}
                onClick={() => onFilterChange('system')}
              >
                <Settings2 size={14} /> System
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
