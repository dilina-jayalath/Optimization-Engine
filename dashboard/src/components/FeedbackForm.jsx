import React, { useState } from 'react';
import { submitFeedback } from '../services/api';

function FeedbackForm({ userId, onFeedbackSubmitted }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rating: 5,
    feedbackType: 'positive',
    comment: '',
    componentId: 'dashboard_ui'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Submit to MongoDB via API - matching the schema structure
      const feedbackData = {
        optimization: {
          parameter: formData.componentId,
          oldValue: 'current_state',
          newValue: 'improved_state',
          suggestedBy: 'system'
        },
        feedback: {
          type: formData.feedbackType,
          rating: parseInt(formData.rating),
          comment: formData.comment,
          timestamp: new Date().toISOString()
        },
        reward: {
          value: (parseInt(formData.rating) - 3) * 0.5,
          normalized: (parseInt(formData.rating) - 3) / 2,
          components: {
            directFeedback: parseInt(formData.rating) / 5,
            timeToFeedback: 0,
            usagePattern: 0
          }
        },
        context: {
          sessionDuration: 0,
          interactionCount: 1,
          deviceType: navigator.userAgent,
          timeOfDay: new Date().toLocaleTimeString(),
          pageUrl: window.location.href
        }
      };

      const result = await submitFeedback(userId, feedbackData);
      
      // Notify parent component
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }
      
      // Reset form and close modal
      setFormData({
        rating: 5,
        feedbackType: 'positive',
        comment: '',
        componentId: 'dashboard_ui'
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRatingChange = (rating) => {
    setFormData(prev => ({
      ...prev,
      rating,
      feedbackType: rating >= 4 ? 'positive' : rating >= 3 ? 'neutral' : 'negative'
    }));
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn btn-primary gap-2 shadow-lg"
      >
        💬 Give Feedback
      </button>

      {isOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-2xl mb-4 flex items-center gap-2">
              💬 Share Your Feedback
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Rating */}
              <div>
                <label className="label">
                  <span className="label-text font-semibold">How would you rate your experience?</span>
                </label>
                <div className="flex gap-2 justify-center py-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange(star)}
                      className={`text-5xl transition-transform hover:scale-110 ${
                        star <= formData.rating ? 'opacity-100' : 'opacity-30'
                      }`}
                    >
                      {star <= formData.rating ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
                <div className="text-center text-sm opacity-70">
                  {formData.rating === 5 && '😊 Excellent!'}
                  {formData.rating === 4 && '😃 Good!'}
                  {formData.rating === 3 && '😐 Okay'}
                  {formData.rating === 2 && '😕 Could be better'}
                  {formData.rating === 1 && '😞 Needs improvement'}
                </div>
              </div>

              {/* Feedback Type */}
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Feedback Type</span>
                </label>
                <div className="join w-full">
                  <button
                    type="button"
                    className={`btn join-item flex-1 ${formData.feedbackType === 'positive' ? 'btn-success' : 'btn-outline'}`}
                    onClick={() => setFormData(prev => ({ ...prev, feedbackType: 'positive' }))}
                  >
                    😊 Positive
                  </button>
                  <button
                    type="button"
                    className={`btn join-item flex-1 ${formData.feedbackType === 'neutral' ? 'btn-warning' : 'btn-outline'}`}
                    onClick={() => setFormData(prev => ({ ...prev, feedbackType: 'neutral' }))}
                  >
                    😐 Neutral
                  </button>
                  <button
                    type="button"
                    className={`btn join-item flex-1 ${formData.feedbackType === 'negative' ? 'btn-error' : 'btn-outline'}`}
                    onClick={() => setFormData(prev => ({ ...prev, feedbackType: 'negative' }))}
                  >
                    😞 Negative
                  </button>
                </div>
              </div>

              {/* Component */}
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Which component?</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={formData.componentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, componentId: e.target.value }))}
                >
                  <option value="dashboard_ui">Dashboard UI</option>
                  <option value="theme_switcher">Theme Switcher</option>
                  <option value="history_timeline">History Timeline</option>
                  <option value="stats_cards">Stats Cards</option>
                  <option value="control_panel">Control Panel</option>
                  <option value="feedback_section">Feedback Section</option>
                </select>
              </div>

              {/* Comment */}
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Your feedback (optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full h-24"
                  placeholder="Tell us what you think..."
                  value={formData.comment}
                  onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                />
              </div>

              {/* Actions */}
              <div className="modal-action">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-ghost"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Submitting...
                    </>
                  ) : (
                    'Submit Feedback'
                  )}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setIsOpen(false)}></div>
        </div>
      )}
    </>
  );
}

export default FeedbackForm;
