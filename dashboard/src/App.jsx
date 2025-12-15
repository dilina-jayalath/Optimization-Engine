import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import UserInfo from './components/UserInfo';
import StatsCards from './components/StatsCards';
import HistoryTimeline from './components/HistoryTimeline';
import ControlPanel from './components/ControlPanel';
import ComparisonView from './components/ComparisonView';
import FeedbackHistory from './components/FeedbackHistory';
import FeedbackForm from './components/FeedbackForm';
import Toast from './components/Toast';
import { useHistory } from './hooks/useHistory';
import { fetchUserData } from './services/api';

function App() {
  const [userId, setUserId] = useState('u_001'); // Default user
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [filterType, setFilterType] = useState('all'); // all, ml, manual, system
  const [activeTab, setActiveTab] = useState('changes'); // changes, feedback
  const [theme, setTheme] = useState('light');
  const [feedbackRefresh, setFeedbackRefresh] = useState(0);
  
  const {
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
  } = useHistory(userId);

  useEffect(() => {
    // Set theme on document
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    loadUserData();
    const interval = setInterval(loadUserData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const data = await fetchUserData(userId);
      setUserData(data);
    } catch (error) {
      showToast('Error loading user data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleFeedbackSubmitted = (feedback) => {
    showToast('Feedback submitted successfully! 🎉', 'success');
    setFeedbackRefresh(prev => prev + 1); // Trigger refresh
    setActiveTab('feedback'); // Switch to feedback tab to show the new feedback
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleUndo = async () => {
    const result = await undo();
    if (result.success) {
      showToast(`Reverted to: ${result.name}`, 'success');
      loadUserData();
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleRedo = async () => {
    const result = await redo();
    if (result.success) {
      showToast(`Applied: ${result.name}`, 'success');
      loadUserData();
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleRevert = async (index) => {
    const result = await revertToVersion(index);
    if (result.success) {
      showToast(`Reverted to version from ${new Date(result.timestamp).toLocaleString()}`, 'success');
      loadUserData();
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleExportHistory = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `history-${userId}-${Date.now()}.json`;
    link.click();
    showToast('History exported successfully', 'success');
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      localStorage.removeItem(`history_${userId}`);
      window.location.reload();
    }
  };

  const filteredHistory = history.filter(item => {
    if (filterType === 'all') return true;
    return item.source === filterType;
  });

  if (loading && !userData) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Theme Toggle Button */}
        <div className="fixed top-4 right-4 z-50">
          <button 
            onClick={toggleTheme}
            className="btn btn-circle btn-primary shadow-lg"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>

        <Header />
        
        <UserInfo 
          userId={userId}
          userData={userData}
          onUserChange={setUserId}
        />

        <StatsCards stats={stats} />

        <ControlPanel
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExport={handleExportHistory}
          onClear={handleClearHistory}
          filterType={filterType}
          onFilterChange={setFilterType}
        />

        <div className="card bg-base-100 shadow-xl">
          <div className="tabs tabs-boxed bg-base-200 p-2 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                className={`tab tab-lg ${activeTab === 'changes' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('changes')}
              >
                📜 Change History
              </button>
              <button
                className={`tab tab-lg ${activeTab === 'feedback' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('feedback')}
              >
                💬 Feedback & Impact
              </button>
            </div>
            <div className="ml-auto">
              <FeedbackForm 
                userId={userId}
                onFeedbackSubmitted={handleFeedbackSubmitted}
              />
            </div>
          </div>
        </div>

        {activeTab === 'changes' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title text-xl">📜 Change History</h2>
                  <span className="badge badge-info badge-lg">
                    {filteredHistory.length} changes
                  </span>
                </div>
                <HistoryTimeline
                  history={filteredHistory}
                  currentIndex={currentIndex}
                  onRevert={handleRevert}
                />
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4">🔍 Current Settings</h2>
                <ComparisonView
                  currentSettings={currentSettings}
                  previousSettings={currentIndex > 0 ? history[currentIndex - 1]?.settings : null}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-xl">💬 User Feedback & Resulting Changes</h2>
                <span className="badge badge-info badge-lg">Track feedback impact</span>
              </div>
              <FeedbackHistory userId={userId} refreshKey={feedbackRefresh} />
            </div>
          </div>
        )}

        <Toast
          show={toast.show}
          message={toast.message}
          type={toast.type}
        />
      </div>
    </div>
  );
}

export default App;
