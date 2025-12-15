import { useState, useEffect, useCallback } from 'react';
import { applySettings } from '../services/api';

export function useHistory(userId) {
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [stats, setStats] = useState({
    totalChanges: 0,
    mlChanges: 0,
    manualChanges: 0,
    currentVersion: 0
  });

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem(`history_${userId}`);
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      setHistory(parsed);
      setCurrentIndex(parsed.length - 1);
    } else {
      // Initialize with default state
      const initialState = {
        id: Date.now(),
        name: 'Initial State',
        timestamp: new Date().toISOString(),
        source: 'system',
        description: 'Default application state',
        settings: {
          font_size: 'medium',
          theme: 'light',
          contrast_mode: 'normal',
          line_height: 1.5,
          target_size: 24
        }
      };
      setHistory([initialState]);
      setCurrentIndex(0);
    }
  }, [userId]);

  // Update stats whenever history changes
  useEffect(() => {
    const mlChanges = history.filter(h => h.source === 'ml').length;
    const manualChanges = history.filter(h => h.source === 'manual').length;
    
    setStats({
      totalChanges: history.length,
      mlChanges,
      manualChanges,
      currentVersion: currentIndex + 1
    });
  }, [history, currentIndex]);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem(`history_${userId}`, JSON.stringify(history));
    }
  }, [history, userId]);

  const addChange = useCallback((settings, source = 'manual', name, description) => {
    const newChange = {
      id: Date.now(),
      name: name || `Change ${history.length + 1}`,
      timestamp: new Date().toISOString(),
      source,
      description: description || '',
      settings: { ...settings }
    };

    const newHistory = [...history.slice(0, currentIndex + 1), newChange];
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);

    return newChange;
  }, [history, currentIndex]);

  const undo = useCallback(async () => {
    if (currentIndex <= 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    const previousIndex = currentIndex - 1;
    const previousState = history[previousIndex];

    try {
      await applySettings(userId, previousState.settings, 'undo');
      setCurrentIndex(previousIndex);
      return {
        success: true,
        name: previousState.name,
        settings: previousState.settings
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [currentIndex, history, userId]);

  const redo = useCallback(async () => {
    if (currentIndex >= history.length - 1) {
      return { success: false, error: 'Nothing to redo' };
    }

    const nextIndex = currentIndex + 1;
    const nextState = history[nextIndex];

    try {
      await applySettings(userId, nextState.settings, 'redo');
      setCurrentIndex(nextIndex);
      return {
        success: true,
        name: nextState.name,
        settings: nextState.settings
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [currentIndex, history, userId]);

  const revertToVersion = useCallback(async (index) => {
    if (index < 0 || index >= history.length) {
      return { success: false, error: 'Invalid version index' };
    }

    const targetState = history[index];

    try {
      await applySettings(userId, targetState.settings, 'revert');
      setCurrentIndex(index);
      return {
        success: true,
        timestamp: targetState.timestamp,
        settings: targetState.settings
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [history, userId]);

  const currentSettings = history[currentIndex]?.settings || null;
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    history,
    currentIndex,
    currentSettings,
    canUndo,
    canRedo,
    undo,
    redo,
    revertToVersion,
    addChange,
    stats
  };
}
