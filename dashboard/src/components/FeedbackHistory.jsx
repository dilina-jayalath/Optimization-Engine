import React, { useState, useEffect } from 'react';
import { getFeedbackHistory } from '../services/api';

function FeedbackHistory({ userId, refreshKey }) {
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeedback();
  }, [userId, refreshKey]);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      // Load from MongoDB via API
      const data = await getFeedbackHistory(userId);
      console.log('Fetched feedback from API:', data);
      
      // Use MongoDB data directly (already in correct schema format)
      setFeedbackList(data);
    } catch (error) {
      console.error('Error loading feedback:', error);
      // Fallback to mock data if API fails
      setFeedbackList(getMockFeedback());
    } finally {
      setLoading(false);
    }
  };

  const getMockFeedback = () => {
    return [
        {
          id: 1,
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          rating: 5,
          feedbackType: 'positive',
          comment: 'Love the new dark theme! Much easier on my eyes.',
          componentId: 'theme_switcher',
          resultingChanges: [
            { setting: 'theme', oldValue: 'light', newValue: 'dark' },
            { setting: 'contrast_mode', oldValue: 'normal', newValue: 'high' }
          ],
          status: 'applied',
          impact: 'high'
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          rating: 4,
          feedbackType: 'neutral',
          comment: 'Font size is better but could be a bit larger',
          componentId: 'text_display',
          resultingChanges: [
            { setting: 'font_size', oldValue: 'medium', newValue: 'large' }
          ],
          status: 'applied',
          impact: 'medium'
        },
        {
          id: 3,
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
          rating: 3,
          feedbackType: 'negative',
          comment: 'Buttons are still too small for me to click accurately',
          componentId: 'button_group',
          resultingChanges: [
            { setting: 'target_size', oldValue: 24, newValue: 32 },
            { setting: 'element_spacing', oldValue: 'normal', newValue: 'wide' }
          ],
          status: 'applied',
          impact: 'high'
        },
        {
          id: 4,
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          rating: 5,
          feedbackType: 'positive',
          comment: 'Perfect! Everything is so much more accessible now.',
          componentId: 'overall_ui',
          resultingChanges: [],
          status: 'acknowledged',
          impact: 'low'
        },
        {
          id: 5,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          rating: 2,
          feedbackType: 'negative',
          comment: 'Line height feels cramped when reading long text',
          componentId: 'content_area',
          resultingChanges: [
            { setting: 'line_height', oldValue: 1.5, newValue: 1.8 }
          ],
          status: 'pending',
          impact: 'medium'
        }
      ];
  };

  const getFeedbackIcon = (type) => {
    switch (type) {
      case 'positive': return '';
      case 'negative': return '';
      case 'neutral': return '';
      default: return '';
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      applied: { class: 'badge-success', text: 'Applied', icon: '' },
      pending: { class: 'badge-warning', text: 'Pending', icon: '⏳' },
      acknowledged: { class: 'badge-info', text: 'Acknowledged', icon: '' },
      ignored: { class: 'badge-error', text: 'Ignored', icon: '' }
    };
    return badges[status] || badges.acknowledged;
  };

  const getImpactBadge = (impact) => {
    const badges = {
      high: { class: 'badge-error', text: 'High' },
      medium: { class: 'badge-warning', text: 'Medium' },
      low: { class: 'badge-success', text: 'Low' }
    };
    return badges[impact] || badges.low;
  };

  const getRatingStars = (rating) => {
    return ''.repeat(rating) + ''.repeat(5 - rating);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Less than an hour ago';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const stats = {
    total: feedbackList.length,
    positive: feedbackList.filter(f => f.feedback?.type === 'positive').length,
    negative: feedbackList.filter(f => f.feedback?.type === 'negative').length,
    neutral: feedbackList.filter(f => f.feedback?.type === 'neutral').length,
    applied: feedbackList.filter(f => f.processed === true).length,
    pending: feedbackList.filter(f => f.processed === false).length,
    avgRating: feedbackList.length > 0 
      ? (feedbackList.reduce((sum, f) => sum + (f.feedback?.rating || 0), 0) / feedbackList.length).toFixed(1)
      : 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="ml-4">Loading feedback...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4 text-center">
            <div className="text-3xl font-bold text-primary">{stats.total}</div>
            <div className="text-sm opacity-70">Total Feedback</div>
          </div>
        </div>
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4 text-center">
            <div className="text-3xl font-bold text-warning"> {stats.avgRating}</div>
            <div className="text-sm opacity-70">Avg Rating</div>
          </div>
        </div>
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4 text-center">
            <div className="text-3xl font-bold text-success">{stats.applied}</div>
            <div className="text-sm opacity-70">Applied</div>
          </div>
        </div>
        <div className="card bg-base-200 shadow">
          <div className="card-body p-4 text-center">
            <div className="text-3xl font-bold text-info">{stats.pending}</div>
            <div className="text-sm opacity-70">Pending</div>
          </div>
        </div>
      </div>

      {/* Sentiment Bar */}
      <div className="card bg-base-200 shadow">
        <div className="card-body p-4">
          <h3 className="text-sm font-semibold mb-2">Sentiment Distribution</h3>
          <div className="flex h-8 rounded-lg overflow-hidden">
            <div 
              className="bg-success flex items-center justify-center text-xs font-semibold text-success-content"
              style={{ width: `${(stats.positive / stats.total) * 100}%` }}
            >
              {stats.positive > 0 && `${stats.positive} `}
            </div>
            <div 
              className="bg-warning flex items-center justify-center text-xs font-semibold text-warning-content"
              style={{ width: `${(stats.neutral / stats.total) * 100}%` }}
            >
              {stats.neutral > 0 && `${stats.neutral} `}
            </div>
            <div 
              className="bg-error flex items-center justify-center text-xs font-semibold text-error-content"
              style={{ width: `${(stats.negative / stats.total) * 100}%` }}
            >
              {stats.negative > 0 && `${stats.negative} `}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {feedbackList.map((feedback) => {
          const status = feedback.processed ? 'applied' : 'pending';
          const statusBadge = getStatusBadge(status);
          const impactBadge = getImpactBadge(feedback.impact || 'medium');
          
          return (
            <div key={feedback._id || feedback.id} className="card bg-base-200 shadow-lg hover:shadow-xl transition-all">
              <div className="card-body p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{getFeedbackIcon(feedback.feedback?.type)}</span>
                    <div>
                      <div className="text-lg">{getRatingStars(feedback.feedback?.rating || 0)}</div>
                      <div className="text-xs opacity-60">{formatDate(feedback.feedback?.timestamp || feedback.createdAt)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className={`badge ${statusBadge.class} gap-1`}>
                      {statusBadge.icon} {statusBadge.text}
                    </span>
                    <span className={`badge ${impactBadge.class}`}>
                      {impactBadge.text}
                    </span>
                  </div>
                </div>

                {/* Comment */}
                <div className="bg-base-100 p-3 rounded-lg mb-3">
                  <p className="text-sm italic">"{feedback.feedback?.comment || 'No comment provided'}"</p>
                  <p className="text-xs opacity-50 mt-2">Parameter: {feedback.optimization?.parameter}</p>
                </div>

                {/* Optimization Details */}
                {feedback.optimization && (
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <span></span> Optimization Applied
                    </h4>
                    <div className="bg-base-100 p-2 rounded">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="badge badge-sm badge-ghost">
                          {feedback.optimization.parameter?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-error line-through opacity-60">
                          {String(feedback.optimization.oldValue || 'N/A')}
                        </span>
                        <span className="opacity-50">→</span>
                        <span className="text-success font-medium">
                          {String(feedback.optimization.newValue)}
                        </span>
                        <span className="badge badge-sm badge-primary ml-auto">
                          {feedback.optimization.suggestedBy}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!feedback.processed && (
                  <div className="alert alert-warning py-2">
                    <span className="text-xs">⏳ Feedback received - processing pending</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FeedbackHistory;
