import React, { useState } from 'react';
import { submitFeedback, updateUserSettings } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';

function FeedbackForm({ userId, onFeedbackSubmitted, onSettingsUpdate }) {
  const { settings, updateSetting, reloadSettings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rating: 5,
    feedbackType: 'positive',
    comment: '',
    parameter: 'targetSize',
    currentValue: null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get current value based on parameter
      const currentValue = formData.currentValue || getCurrentValue(formData.parameter);

      // NEW SIMPLIFIED FORMAT - Send current value + feedback, RL predicts next
      const feedbackData = {
        parameter: formData.parameter,
        currentValue: currentValue,
        feedback: {
          type: formData.feedbackType,
          rating: parseInt(formData.rating),
          comment: formData.comment.trim() || undefined,
          accepted: formData.feedbackType === 'positive',
          responseTime: 2000
        },
        context: {
          deviceType: getDeviceType(),
          timeOfDay: getTimeOfDay(),
          sessionDuration: 60000,
          interactionCount: 5,
          pageUrl: window.location.href
        }
      };

      console.log(' Submitting feedback:', feedbackData);
      const result = await submitFeedback(userId, feedbackData);
      console.log(' Received result:', result);

      // Auto-apply RL suggestion if available
      if (result.data?.nextSuggestion) {
        const suggestion = result.data.nextSuggestion;
        console.log(' Auto-applying RL suggestion:', suggestion.suggestedValue);

        // First update local settings for immediate feedback
        updateSetting(formData.parameter, suggestion.suggestedValue);

        // Then reload from backend to ensure we have the latest RL suggestions
        setTimeout(async () => {
          await reloadSettings();
          console.log(' Reloaded settings from backend');
        }, 500);

        // Show success message with what was changed
        if (onSettingsUpdate) {
          onSettingsUpdate({
            [formData.parameter]: suggestion.suggestedValue,
            reason: suggestion.reason,
            confidence: suggestion.confidence
          });
        }
      }

      closeAndReset();

      // Notify parent component
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
      setIsSubmitting(false);
    }
  };

  const getCurrentValue = (parameter) => {
    // Return current value from global settings
    return settings[parameter] || formData.currentValue;
  };

  const getDeviceType = () => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  };

  const closeAndReset = () => {
    setFormData({
      rating: 5,
      feedbackType: 'positive',
      comment: '',
      parameter: 'targetSize',
      currentValue: null
    });
    setIsOpen(false);
    setIsSubmitting(false);
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
         Give Feedback
      </button>

      {isOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-2xl mb-4 flex items-center gap-2">
               Share Your Feedback
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
                      className={`text-5xl transition-transform hover:scale-110 ${star <= formData.rating ? 'opacity-100' : 'opacity-30'
                        }`}
                    >
                      {star <= formData.rating ? '' : ''}
                    </button>
                  ))}
                </div>
                <div className="text-center text-sm opacity-70">
                  {formData.rating === 5 && ' Excellent!'}
                  {formData.rating === 4 && ' Good!'}
                  {formData.rating === 3 && ' Okay'}
                  {formData.rating === 2 && ' Could be better'}
                  {formData.rating === 1 && ' Needs improvement'}
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
                     Positive
                  </button>
                  <button
                    type="button"
                    className={`btn join-item flex-1 ${formData.feedbackType === 'neutral' ? 'btn-warning' : 'btn-outline'}`}
                    onClick={() => setFormData(prev => ({ ...prev, feedbackType: 'neutral' }))}
                  >
                     Neutral
                  </button>
                  <button
                    type="button"
                    className={`btn join-item flex-1 ${formData.feedbackType === 'negative' ? 'btn-error' : 'btn-outline'}`}
                    onClick={() => setFormData(prev => ({ ...prev, feedbackType: 'negative' }))}
                  >
                     Negative
                  </button>
                </div>
              </div>

              {/* Parameter */}
              <div>
                <label className="label">
                  <span className="label-text font-semibold">What would you like to give feedback on?</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={formData.parameter}
                  onChange={(e) => setFormData(prev => ({ ...prev, parameter: e.target.value, currentValue: null }))}
                >
                  <option value="targetSize"> Button Size</option>
                  <option value="fontSize"> Font Size</option>
                  <option value="lineHeight"> Line Height</option>
                  <option value="theme"> Theme (Light/Dark)</option>
                  <option value="contrastMode"> Contrast Mode</option>
                  <option value="elementSpacing">↔️ Element Spacing</option>
                </select>
              </div>

              {/* Current Value */}
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Current Value (Active on Entire Website)</span>
                </label>
                <div className="alert alert-info">
                  <div className="flex-1">
                    <span>Current {formData.parameter}: <strong className="text-lg">{formData.currentValue || getCurrentValue(formData.parameter)}</strong></span>
                    <div className="text-xs mt-1 opacity-70">
                       This value is applied to the entire dashboard
                    </div>
                  </div>
                </div>
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
