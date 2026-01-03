"""
Simple Flask API for DQN Agent (Simplified for testing)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app)

# Simple in-memory storage for testing
agents_data = {}

@app.route('/rl/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'service': 'DQN RL Service (Simplified)',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'agents': len(agents_data)
    })

@app.route('/rl/initialize', methods=['POST'])
def initialize():
    """Initialize agent"""
    try:
        data = request.json
        user_id = data.get('userId')
        parameter = data.get('parameter')
        
        key = f"{user_id}:{parameter}"
        agents_data[key] = {
            'steps': 0,
            'epsilon': 1.0,
            'created': datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify({
            'success': True,
            'userId': user_id,
            'parameter': parameter,
            'stats': agents_data[key]
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/choose-action', methods=['POST'])
def choose_action():
    """
    Choose next action with smart suggestion logic
    Avoids current action if last feedback was negative
    """
    try:
        data = request.json
        user_id = data.get('userId')
        parameter = data.get('parameter')
        state = data.get('state', {})
        context = data.get('context', {})
        
        last_feedback = context.get('lastFeedback')
        avoid_current = context.get('avoidCurrent', False) or (last_feedback == 'negative')
        
        # Get action space for this parameter
        action_space = get_action_space(parameter)
        current_value = state.get(parameter)
        
        # Get or create agent data
        key = f"{user_id}:{parameter}"
        if key not in agents_data:
            agents_data[key] = {
                'steps': 0,
                'epsilon': 0.2,
                'q_values': {},
                'created': datetime.now(timezone.utc).isoformat()
            }
        
        agent_data = agents_data[key]
        epsilon = agent_data.get('epsilon', 0.2)
        q_values_dict = agent_data.get('q_values', {})
        
        # Initialize Q-values if not present
        if not q_values_dict:
            q_values_dict = {action: 0.5 for action in action_space}
            agent_data['q_values'] = q_values_dict
        
        import random
        
        # Smart action selection
        is_exploration = random.random() < epsilon
        
        if is_exploration:
            # Exploration: random but avoid current if negative feedback
            available_actions = action_space.copy()
            if avoid_current and current_value in available_actions:
                available_actions = [a for a in available_actions if a != current_value]
            
            action = random.choice(available_actions) if available_actions else random.choice(action_space)
        else:
            # Exploitation: choose best Q-value, avoid current if negative
            if avoid_current:
                # Filter out current value
                filtered_q = {k: v for k, v in q_values_dict.items() if k != current_value}
                if filtered_q:
                    action = max(filtered_q.items(), key=lambda x: x[1])[0]
                else:
                    action = max(q_values_dict.items(), key=lambda x: x[1])[0]
            else:
                action = max(q_values_dict.items(), key=lambda x: x[1])[0]
        
        # Get Q-values for response
        q_values_list = [q_values_dict.get(a, 0.5) for a in action_space]
        action_index = action_space.index(action) if action in action_space else 0
        q_value = q_values_dict.get(action, 0.5)
        
        # Get top 3 actions
        top_actions = sorted(
            [{'action': k, 'qValue': v} for k, v in q_values_dict.items()],
            key=lambda x: x['qValue'],
            reverse=True
        )[:3]
        
        # Generate recommendation text
        recommendation = get_recommendation_text(
            parameter,
            current_value,
            action,
            last_feedback
        )
        
        return jsonify({
            'success': True,
            'action': action,
            'actionIndex': action_index,
            'qValue': float(q_value),
            'epsilon': epsilon,
            'reasoning': {
                'exploration': is_exploration,
                'avoidedCurrent': avoid_current and action != current_value,
                'topActions': top_actions,
                'recommendation': recommendation
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/feedback', methods=['POST'])
def feedback():
    """
    Process feedback and update Q-values
    Implements simple Q-learning update
    """
    try:
        data = request.json
        user_id = data.get('userId')
        parameter = data.get('parameter')
        action = data.get('action')
        reward = data.get('reward', 0)
        metadata = data.get('metadata', {})
        
        key = f"{user_id}:{parameter}"
        if key not in agents_data:
            agents_data[key] = {
                'steps': 0,
                'epsilon': 0.2,
                'q_values': {},
                'created': datetime.now(timezone.utc).isoformat()
            }
        
        agent_data = agents_data[key]
        q_values = agent_data.get('q_values', {})
        
        # Initialize Q-value for this action if not present
        if action not in q_values:
            q_values[action] = 0.5
        
        # Simple Q-learning update: Q(a) = Q(a) + α[reward - Q(a)]
        learning_rate = 0.1
        old_q = q_values[action]
        q_values[action] = old_q + learning_rate * (reward - old_q)
        
        # Update agent data
        agent_data['q_values'] = q_values
        agent_data['steps'] += 1
        
        # Decay epsilon (exploration rate)
        if agent_data['epsilon'] > 0.01:
            agent_data['epsilon'] *= 0.995
        
        # Calculate mock loss (for compatibility)
        loss = abs(reward - old_q) * 0.1
        
        # Log learning
        print(f"📊 Updated Q({action}) = {q_values[action]:.3f} (was {old_q:.3f}, reward={reward:.2f})")
        
        return jsonify({
            'success': True,
            'loss': float(loss),
            'epsilon': agent_data['epsilon'],
            'steps': agent_data['steps'],
            'qValue': q_values[action],
            'stats': {
                'steps': agent_data['steps'],
                'epsilon': agent_data['epsilon'],
                'qValuesCount': len(q_values)
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/suggest', methods=['POST'])
def suggest():
    """
    Get personalization suggestions for all parameters
    Used by trial system to get ML-suggested profile
    """
    try:
        data = request.json
        user_id = data.get('userId')
        current_settings = data.get('currentSettings', {})
        context = data.get('context', {})
        
        print(f"🎯 Generating suggestions for userId={user_id}")
        
        suggestions = {}
        
        # For each parameter, get best action
        for parameter, current_value in current_settings.items():
            key = f"{user_id}:{parameter}"
            
            # Get or initialize agent data
            if key not in agents_data:
                agents_data[key] = {
                    'steps': 0,
                    'epsilon': 0.2,
                    'q_values': {},
                    'created': datetime.now(timezone.utc).isoformat()
                }
            
            agent_data = agents_data[key]
            q_values = agent_data.get('q_values', {})
            
            # Get action space
            action_space = get_action_space(parameter)
            
            # Initialize Q-values if empty
            if not q_values:
                q_values = {action: 0.5 for action in action_space}
                agent_data['q_values'] = q_values
            
            # Find best action (highest Q-value) that's different from current
            best_action = None
            best_q = -float('inf')
            
            for action, q_val in q_values.items():
                if action != current_value and q_val > best_q:
                    best_q = q_val
                    best_action = action
            
            # If we found a better action with Q > 0.5, suggest it
            if best_action and best_q > 0.5:
                suggestions[parameter] = best_action
                print(f"   {parameter}: {current_value} → {best_action} (Q={best_q:.3f})")
        
        if not suggestions:
            # No learned preferences, suggest exploration
            # Pick first unlocked parameter and suggest next value
            for parameter, current_value in list(current_settings.items())[:1]:
                action_space = get_action_space(parameter)
                if current_value in action_space:
                    current_idx = action_space.index(current_value)
                    next_idx = (current_idx + 1) % len(action_space)
                    suggestions[parameter] = action_space[next_idx]
                    print(f"   {parameter}: {current_value} → {suggestions[parameter]} (exploration)")
        
        return jsonify({
            'success': True,
            'suggestions': suggestions,
            'userId': user_id,
            'context': context
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/stats', methods=['GET'])
def stats():
    """Get stats"""
    try:
        user_id = request.args.get('userId')
        parameter = request.args.get('parameter')
        
        key = f"{user_id}:{parameter}"
        return jsonify({
            'userId': user_id,
            'parameter': parameter,
            'stats': agents_data.get(key, {})
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/batch-train', methods=['POST'])
def batch_train():
    """Batch training"""
    try:
        data = request.json
        user_id = data.get('userId')
        parameter = data.get('parameter')
        experiences = data.get('experiences', [])
        epochs = data.get('epochs', 10)
        
        key = f"{user_id}:{parameter}"
        if key not in agents_data:
            agents_data[key] = {'steps': 0, 'epsilon': 1.0}
        
        # Simulate training
        agents_data[key]['steps'] += len(experiences) * epochs
        
        return jsonify({
            'success': True,
            'experiencesStored': len(experiences),
            'epochs': epochs,
            'avgLoss': 0.05,
            'stats': agents_data[key]
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/save', methods=['POST'])
def save_model():
    """Save model (mock)"""
    try:
        data = request.json
        user_id = data.get('userId')
        parameter = data.get('parameter')
        
        return jsonify({
            'success': True,
            'modelPath': f'models/{user_id}_{parameter}.pth',
            'stats': agents_data.get(f"{user_id}:{parameter}", {})
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ===== HELPER FUNCTIONS =====

def get_action_space(parameter):
    """Get possible actions for a parameter"""
    action_spaces = {
        'fontSize': ['small', 'medium', 'large', 'x-large'],
        'lineHeight': [1.2, 1.4, 1.5, 1.6, 1.8, 2.0],
        'theme': ['light', 'dark', 'auto'],
        'contrastMode': ['normal', 'high'],
        'elementSpacing': ['compact', 'normal', 'wide'],
        'targetSize': [24, 28, 32, 36, 40, 44]
    }
    return action_spaces.get(parameter, ['default'])

def get_recommendation_text(parameter, current_value, suggested_value, last_feedback):
    """Generate human-readable recommendation"""
    if last_feedback == 'negative':
        return f"Since you didn't like {current_value}, trying {suggested_value}"
    elif last_feedback == 'positive':
        return f"You liked {current_value}, keeping similar settings"
    else:
        return f"Based on learning, suggesting {suggested_value}"

if __name__ == '__main__':
    print("🐍 Starting Enhanced DQN Service with Smart Suggestions...")
    print("📡 http://localhost:8000")
    print("✨ Features: Smart action selection, Q-learning, Feedback-aware suggestions")
    app.run(host='0.0.0.0', port=8000, debug=True)
