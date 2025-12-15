/**
 * Reward Calculator
 * 
 * Calculates rewards from user feedback for Q-Learning updates
 */

class RewardCalculator {
  constructor(options = {}) {
    this.rewardValues = options.rewardValues || {
      positive: 1.0,
      neutral: 0.0,
      negative: -1.0
    };
    
    this.timeDecayFactor = options.timeDecayFactor || 0.9;
    this.usageBonus = options.usageBonus || 0.2;
  }

  /**
   * Calculate reward from feedback
   */
  calculateReward(feedback, context = {}) {
    // Base reward from feedback type
    let reward = this.rewardValues[feedback.type] || 0;
    
    // Time-based decay (faster feedback = higher reward)
    let timePenalty = 0;
    if (context.timeToFeedback) {
      timePenalty = Math.min(context.timeToFeedback / 30000, 1); // 30 seconds max
      reward *= (1 - timePenalty * (1 - this.timeDecayFactor));
    }
    
    // Usage bonus (if user kept using the setting)
    if (context.continuedUsing && feedback.type === 'positive') {
      reward += this.usageBonus;
    }
    
    // Rating bonus (if 1-5 rating provided)
    if (feedback.rating) {
      const ratingBonus = (feedback.rating - 3) / 10; // -0.2 to +0.2
      reward += ratingBonus;
    }
    
    // Normalize reward to [-1, 1]
    reward = Math.max(-1, Math.min(1, reward));
    
    return {
      value: reward,
      normalized: reward,
      components: {
        baseFeedback: this.rewardValues[feedback.type],
        timeDecay: context.timeToFeedback ? -timePenalty * (1 - this.timeDecayFactor) : 0,
        usageBonus: context.continuedUsing ? this.usageBonus : 0,
        ratingBonus: feedback.rating ? (feedback.rating - 3) / 10 : 0
      }
    };
  }

  /**
   * Calculate reward from implicit signals
   */
  calculateImplicitReward(signals = {}) {
    let reward = 0;
    
    // Time spent on page (longer = better)
    if (signals.timeOnPage) {
      reward += Math.min(signals.timeOnPage / 60000, 0.3); // Max 0.3 for 1 min+
    }
    
    // Interaction count (more = better)
    if (signals.interactions) {
      reward += Math.min(signals.interactions / 10, 0.2); // Max 0.2 for 10+ interactions
    }
    
    // Scroll depth (deeper = better)
    if (signals.scrollDepth) {
      reward += signals.scrollDepth * 0.1; // Max 0.1 for 100% scroll
    }
    
    // No immediate rejection (stayed for at least 5 seconds)
    if (signals.stayedFor >= 5000) {
      reward += 0.1;
    }
    
    return Math.max(-1, Math.min(1, reward));
  }

  /**
   * Calculate combined reward (explicit + implicit)
   */
  calculateCombinedReward(feedback, context = {}, signals = {}) {
    const explicitReward = this.calculateReward(feedback, context);
    const implicitReward = this.calculateImplicitReward(signals);
    
    // Weight explicit feedback more heavily
    const combined = explicitReward.value * 0.7 + implicitReward * 0.3;
    
    return {
      value: combined,
      normalized: Math.max(-1, Math.min(1, combined)),
      explicit: explicitReward,
      implicit: implicitReward
    };
  }
}

module.exports = RewardCalculator;
