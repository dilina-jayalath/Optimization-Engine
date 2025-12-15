import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function fetchUserData(userId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/${userId}`);
    return response.data.data;
  } catch (error) {
    console.error('Error fetching user data:', error);
    // Return mock data for development
    return {
      userId,
      currentSettings: {
        font_size: 'large',
        theme: 'dark',
        contrast_mode: 'high',
        line_height: 1.6,
        target_size: 28
      },
      mlProfile: {},
      lastActive: new Date().toISOString()
    };
  }
}

export async function applySettings(userId, settings, source = 'manual') {
  try {
    const response = await axios.post(`${API_BASE_URL}/users/${userId}/settings`, {
      settings,
      source
    });
    return response.data.data;
  } catch (error) {
    console.error('Error applying settings:', error);
    // For development, simulate success
    return settings;
  }
}

export async function exportHistory(userId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/${userId}/history/export`);
    return response.data.data;
  } catch (error) {
    console.error('Error exporting history:', error);
    throw error;
  }
}

export async function submitFeedback(userId, feedbackData) {
  try {
    // Pass through the complete MongoDB schema structure from FeedbackForm
    const response = await axios.post(`${API_BASE_URL}/users/${userId}/feedback`, feedbackData);
    return response.data.data;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

export async function getFeedbackHistory(userId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/${userId}/feedback`);
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching feedback history:', error);
    return [];
  }
}

export async function clearHistory(userId) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/users/${userId}/history`);
    return response.data;
  } catch (error) {
    console.error('Error clearing history:', error);
    throw error;
  }
}
