/**
 * ML Integration Module
 * 
 * Loads and merges ML predictions from your ML pipeline:
 * - category-wise.json (general predictions)
 * - user-wise.json (user-specific predictions)
 */

class MLIntegration {
  constructor() {
    this.categoryWiseProfile = null;
    this.userWiseProfile = null;
    this.mergedProfile = null;
  }

  /**
   * Load ML profiles
   */
  async loadProfiles(categoryWisePath, userWisePath) {
    try {
      // Load category-wise profile
      if (categoryWisePath) {
        this.categoryWiseProfile = await this.loadJSON(categoryWisePath);
      }
      
      // Load user-wise profile
      if (userWisePath) {
        this.userWiseProfile = await this.loadJSON(userWisePath);
      }
      
      // Merge profiles
      this.mergedProfile = this.mergeProfiles();
      
      return this.mergedProfile;
    } catch (error) {
      console.error('Error loading ML profiles:', error);
      throw error;
    }
  }

  /**
   * Load JSON file
   */
  async loadJSON(path) {
    const fs = require('fs').promises;
    const data = await fs.readFile(path, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Merge category-wise and user-wise profiles
   * User-wise has higher priority
   */
  mergeProfiles() {
    if (!this.categoryWiseProfile && !this.userWiseProfile) {
      return null;
    }
    
    const merged = {
      profile: {},
      confidence: 0,
      sources: []
    };
    
    // Start with category-wise
    if (this.categoryWiseProfile) {
      merged.profile = { ...this.categoryWiseProfile.profile };
      merged.confidence = this.categoryWiseProfile.confidence || 0;
      merged.sources.push('category-wise');
    }
    
    // Override with user-wise (higher priority)
    if (this.userWiseProfile) {
      merged.profile = {
        ...merged.profile,
        ...this.userWiseProfile.profile
      };
      
      // Use higher confidence
      if (this.userWiseProfile.confidence > merged.confidence) {
        merged.confidence = this.userWiseProfile.confidence;
      }
      
      merged.sources.push('user-wise');
    }
    
    return merged;
  }

  /**
   * Get ML suggestion for a specific parameter
   */
  getMLSuggestion(parameter) {
    if (!this.mergedProfile) {
      return null;
    }
    
    return this.mergedProfile.profile[parameter] || null;
  }

  /**
   * Get all ML suggestions
   */
  getAllSuggestions() {
    if (!this.mergedProfile) {
      return {};
    }
    
    return this.mergedProfile.profile;
  }

  /**
   * Get confidence score
   */
  getConfidence() {
    if (!this.mergedProfile) {
      return 0;
    }
    
    return this.mergedProfile.confidence;
  }

  /**
   * Get explanations from node_outputs (if available)
   */
  getExplanations() {
    const explanations = {};
    
    if (this.userWiseProfile && this.userWiseProfile.node_outputs) {
      for (const [key, value] of Object.entries(this.userWiseProfile.node_outputs)) {
        if (value && value.explanation) {
          explanations[key] = value.explanation;
        }
      }
    }
    
    if (this.categoryWiseProfile && this.categoryWiseProfile.node_outputs) {
      for (const [key, value] of Object.entries(this.categoryWiseProfile.node_outputs)) {
        if (value && value.explanation && !explanations[key]) {
          explanations[key] = value.explanation;
        }
      }
    }
    
    return explanations;
  }

  /**
   * Check if profiles are loaded
   */
  isLoaded() {
    return this.mergedProfile !== null;
  }

  /**
   * Get profile summary
   */
  getSummary() {
    return {
      categoryWise: this.categoryWiseProfile ? {
        confidence: this.categoryWiseProfile.confidence,
        parameters: Object.keys(this.categoryWiseProfile.profile || {})
      } : null,
      userWise: this.userWiseProfile ? {
        confidence: this.userWiseProfile.confidence,
        parameters: Object.keys(this.userWiseProfile.profile || {})
      } : null,
      merged: this.mergedProfile ? {
        confidence: this.mergedProfile.confidence,
        parameters: Object.keys(this.mergedProfile.profile),
        sources: this.mergedProfile.sources
      } : null
    };
  }
}

module.exports = MLIntegration;
