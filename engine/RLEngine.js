/**
 * Q-Learning Reinforcement Learning Engine
 * 
 * YOUR RL IMPLEMENTATION
 * - Exploration/Exploitation (epsilon-greedy)
 * - Q-value updates
 * - Action selection
 * - Reward calculation integration
 */

class RLEngine {
  constructor(options = {}) {
    this.alpha = options.learningRate || 0.1;      // Learning rate
    this.gamma = options.discountFactor || 0.9;    // Discount factor
    this.epsilon = options.explorationRate || 0.2; // Exploration rate
    
    // Q-tables: { parameter: { state: { action: qValue } } }
    this.qTables = new Map();
    
    // Parameters to optimize
    this.parameters = options.parameters || [
      'fontSize',
      'lineHeight',
      'theme',
      'contrastMode',
      'elementSpacing',
      'targetSize'
    ];
    
    // Action spaces for each parameter
    this.actionSpaces = {
      fontSize: ['small', 'medium', 'large', 'x-large'],
      lineHeight: [1.2, 1.4, 1.5, 1.6, 1.8, 2.0],
      theme: ['light', 'dark', 'auto'],
      contrastMode: ['normal', 'high'],
      elementSpacing: ['compact', 'normal', 'wide'],
      targetSize: [24, 28, 32, 36, 40]
    };
    
    // Initialize Q-tables
    this.initializeQTables();
  }

  /**
   * Initialize Q-tables for all parameters
   */
  initializeQTables() {
    this.parameters.forEach(param => {
      if (!this.qTables.has(param)) {
        this.qTables.set(param, new Map());
      }
    });
  }

  /**
   * Choose action using epsilon-greedy strategy
   */
  chooseAction(parameter, state = 'current', mlSuggestion = null) {
    // Exploration: random action
    if (Math.random() < this.epsilon) {
      const actions = this.actionSpaces[parameter];
      return actions[Math.floor(Math.random() * actions.length)];
    }
    
    // Exploitation: best known action
    const qTable = this.qTables.get(parameter);
    const stateValues = qTable.get(state) || new Map();
    
    // If we have ML suggestion and no Q-values yet, use ML
    if (stateValues.size === 0 && mlSuggestion !== null) {
      return mlSuggestion;
    }
    
    // Get action with highest Q-value
    let bestAction = null;
    let bestValue = -Infinity;
    
    for (const [action, qValue] of stateValues.entries()) {
      if (qValue > bestValue) {
        bestValue = qValue;
        bestAction = action;
      }
    }
    
    // If no Q-values exist, use ML suggestion or random
    if (bestAction === null) {
      if (mlSuggestion !== null) {
        return mlSuggestion;
      }
      const actions = this.actionSpaces[parameter];
      return actions[Math.floor(Math.random() * actions.length)];
    }
    
    return bestAction;
  }

  /**
   * Update Q-value based on reward
   */
  updateQValue(parameter, state, action, reward, nextState = null) {
    const qTable = this.qTables.get(parameter);
    
    // Get current Q-value
    if (!qTable.has(state)) {
      qTable.set(state, new Map());
    }
    const stateValues = qTable.get(state);
    const currentQ = stateValues.get(action) || 0;
    
    // Calculate max Q-value for next state
    let maxNextQ = 0;
    if (nextState && qTable.has(nextState)) {
      const nextStateValues = qTable.get(nextState);
      maxNextQ = Math.max(...Array.from(nextStateValues.values()), 0);
    }
    
    // Q-Learning update rule
    // Q(s,a) = Q(s,a) + α[r + γ·max(Q(s',a')) - Q(s,a)]
    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
    
    // Update Q-table
    stateValues.set(action, newQ);
    
    return newQ;
  }

  /**
   * Get best action and its Q-value
   */
  getBestAction(parameter, state = 'current') {
    const qTable = this.qTables.get(parameter);
    const stateValues = qTable.get(state) || new Map();
    
    if (stateValues.size === 0) {
      return { action: null, qValue: 0 };
    }
    
    let bestAction = null;
    let bestValue = -Infinity;
    
    for (const [action, qValue] of stateValues.entries()) {
      if (qValue > bestValue) {
        bestValue = qValue;
        bestAction = action;
      }
    }
    
    return { action: bestAction, qValue: bestValue };
  }

  /**
   * Get all Q-values for a parameter
   */
  getQTable(parameter) {
    const qTable = this.qTables.get(parameter);
    if (!qTable) return {};
    
    const result = {};
    for (const [state, actions] of qTable.entries()) {
      result[state] = Object.fromEntries(actions);
    }
    return result;
  }

  /**
   * Load Q-tables from storage
   */
  loadQTables(qtablesData) {
    this.qTables.clear();
    
    for (const [parameter, states] of Object.entries(qtablesData)) {
      const qTable = new Map();
      
      for (const [state, actions] of Object.entries(states)) {
        const actionsMap = new Map(Object.entries(actions));
        qTable.set(state, actionsMap);
      }
      
      this.qTables.set(parameter, qTable);
    }
  }

  /**
   * Export Q-tables for storage
   */
  exportQTables() {
    const result = {};
    
    for (const [parameter, qTable] of this.qTables.entries()) {
      result[parameter] = {};
      
      for (const [state, actions] of qTable.entries()) {
        result[parameter][state] = Object.fromEntries(actions);
      }
    }
    
    return result;
  }

  /**
   * Get statistics about learning
   */
  getStatistics() {
    const stats = {
      totalParameters: this.parameters.length,
      parametersWithQValues: 0,
      totalStateActionPairs: 0,
      averageQValue: 0,
      explorationRate: this.epsilon
    };
    
    let totalQValues = 0;
    let qValueCount = 0;
    
    for (const [parameter, qTable] of this.qTables.entries()) {
      let hasValues = false;
      
      for (const [state, actions] of qTable.entries()) {
        if (actions.size > 0) {
          hasValues = true;
          stats.totalStateActionPairs += actions.size;
          
          for (const qValue of actions.values()) {
            totalQValues += qValue;
            qValueCount++;
          }
        }
      }
      
      if (hasValues) {
        stats.parametersWithQValues++;
      }
    }
    
    if (qValueCount > 0) {
      stats.averageQValue = totalQValues / qValueCount;
    }
    
    return stats;
  }

  /**
   * Decay exploration rate over time
   */
  decayExploration(minEpsilon = 0.05) {
    this.epsilon = Math.max(minEpsilon, this.epsilon * 0.995);
  }

  /**
   * Reset Q-tables
   */
  reset() {
    this.qTables.clear();
    this.initializeQTables();
  }
}

module.exports = RLEngine;
