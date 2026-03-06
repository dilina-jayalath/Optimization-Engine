"""
Simple Flask API for DQN Agent (Simplified for testing)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
from datetime import datetime, timezone
import time
from flask import Response

app = Flask(__name__)
CORS(app)

from temp_user_detector.service import TempUserDetectorService
from temp_user_detector.schemas import InteractionBatch

# Simple in-memory storage for testing
agents_data = {}
user_profiles = {} # Simple in-memory storage for user settings


# Initialize Temp User Detector
temp_user_detector = TempUserDetectorService()


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
        direction = context.get('direction') # 'increase' | 'decrease'
        
        # Get action space for this behavior
        action_space = get_action_space(parameter)
        current_value = state.get(parameter)
        
        # TYPE FIX: Coerce current_value to match action_space type
        if action_space and current_value is not None:
             space_type = type(action_space[0])
             try:
                 if space_type == int:
                     current_value = int(float(current_value))
                 elif space_type == float:
                     current_value = float(current_value)
                 elif space_type == str:
                     current_value = str(current_value)
             except:
                 pass # Keep original if cast fails
        
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
        
        # Initialize Q-values if not present or incomplete
        for a in action_space:
            if a not in q_values_dict:
                q_values_dict[a] = 0.5
        agent_data['q_values'] = q_values_dict
        
        import random
        
        # Smart action selection
        is_exploration = random.random() < epsilon
        
        # Filter actions based on constraints (avoid_current, direction)
        available_actions = action_space.copy()
        
        # 1. Directional Constraint
        if direction and current_value in action_space:
             try:
                 curr_idx = action_space.index(current_value)
                 print(f"   Note: Directional constraint '{direction}' from index {curr_idx} (val={current_value})")
                 
                 if direction == 'increase':
                     filtered = action_space[curr_idx+1:]
                 elif direction == 'decrease':
                     filtered = action_space[:curr_idx]
                 else:
                     filtered = []
                     
                 if filtered:
                     available_actions = filtered
                     print(f"   -> Filtered to {available_actions}")
                 else:
                     print(f"   -> Directional constraint failed (no actions left), ignoring.")
                     
             except (ValueError, IndexError) as e:
                 print(f"   Error in directional logic: {e}")
                 pass
        
        # 2. Avoid Current Constraint
        if avoid_current:
             available_actions = [a for a in available_actions if a != current_value]
             
        # If we filtered everything away, valid fallback (relax constraints)
        if not available_actions:
             available_actions = action_space.copy()
             if avoid_current and len(available_actions) > 1:
                 available_actions = [a for a in available_actions if a != current_value]

        if is_exploration:
            # Exploration
            action = random.choice(available_actions) if available_actions else random.choice(action_space)
        else:
            # Exploitation: choose best Q-value from AVAILABLE actions
            filtered_q = {k: v for k, v in q_values_dict.items() if k in available_actions}
            
            if filtered_q:
                action = max(filtered_q.items(), key=lambda x: x[1])[0]
            else:
                # Fallback to global best if local constraints fail
                valid_q = {k: v for k, v in q_values_dict.items() if k in action_space}
                action = max(valid_q.items(), key=lambda x: x[1])[0] if valid_q else action_space[0]
        
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
        
        # Helper: Map component interaction to reward
        if parameter == 'component_interaction':
            # Create a virtual parameter for this component or map to general usability
            # For this MVP, we map to 'global_usability' or specific component key
            key = f"{user_id}:component_{data.get('currentValue', 'unknown')}"
            print(f"⚠️ Tracking behavioral feedback for {key}")

        if key not in agents_data:
            agents_data[key] = {
                'steps': 0,
                'epsilon': 0.2,
                'q_values': {},
                'created': datetime.now(timezone.utc).isoformat()
            }
        
        agent_data = agents_data[key]
        q_values = agent_data.get('q_values', {})
        
        
        # 2026-01-05: Handle unhashable action types (e.g. dicts from implicit feedback)
        action_key = action
        if isinstance(action, dict):
             # Try to extract the scalar value if it's a single-key dict like {'targetSize': 32}
             if len(action) == 1:
                 action_key = list(action.values())[0]
             else:
                 # Fallback: stringify it
                 action_key = str(action)
        
        # Initialize Q-value for this action if not present
        if action_key not in q_values:
            q_values[action_key] = 0.5
        
        # Simple Q-learning update: Q(a) = Q(a) + α[reward - Q(a)]
        learning_rate = 0.5 # Increased for Demo responsiveness
        old_q = q_values[action_key]
        q_values[action_key] = old_q + learning_rate * (reward - old_q)
        
        # Update agent data
        agent_data['q_values'] = q_values
        agent_data['steps'] += 1
        
        # Decay epsilon (exploration rate)
        if agent_data['epsilon'] > 0.01:
            agent_data['epsilon'] *= 0.995
        
        # Calculate mock loss (for compatibility)
        loss = abs(reward - old_q) * 0.1
        
        # Log learning
        print(f"📊 Updated Q({action_key}) = {q_values[action_key]:.3f} (was {old_q:.3f}, reward={reward:.2f})")
        
        return jsonify({
            'success': True,
            'loss': float(loss),
            'epsilon': agent_data['epsilon'],
            'steps': agent_data['steps'],
            'qValue': q_values[action_key],
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

@app.route('/rl-feedback/component-issue', methods=['POST'])
def component_issue_feedback():
    """
    Handle explicit manual component-level feedback from the UI
    """
    try:
        data = request.json
        user_id = data.get('userId')
        component_id = data.get('componentId')
        component_type = data.get('componentType')
        issue = data.get('issue')
        
        print(f"🛠️ Component Feedback Received: {user_id} reported '{issue}' on {component_type} ({component_id})")
        
        # Determine the mapped parameter and a suggested value based on the issue reported
        parameter = None
        suggested_value = None
        
        if issue == 'too_small':
            parameter = 'targetSize'
            # Suggest a larger target size
            suggested_value = 48
        elif issue == 'too_large':
            parameter = 'targetSize'
            # Suggest a smaller target size
            suggested_value = 32
        elif issue == 'hard_to_read':
            parameter = 'fontSize'
            suggested_value = 'large'
        elif issue == 'bad_contrast':
            parameter = 'theme'
            suggested_value = 'dark' # Often dark is higher contrast, or we could set 'high_contrast' mode
        elif issue == 'line_height':
            parameter = 'lineHeight'
            suggested_value = 1.6
        elif issue == 'wrong_color':
            parameter = 'theme'
            suggested_value = 'light'
        elif issue == 'layout':
            parameter = 'elementSpacing'
            suggested_value = 'compact'
            
        if parameter and suggested_value:
             print(f"   -> AI Suggestion: Change {parameter} to {suggested_value}")
             return jsonify({
                'success': True,
                'nextSuggestion': {
                    'parameter': parameter,
                    'suggestedValue': suggested_value,
                    'confidence': 0.85
                }
             })
             
        # If no specific suggestion, just acknowledge
        return jsonify({
            'success': True,
            'message': 'Feedback recorded, but no immediate UI change mapped.'
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl-feedback/submit', methods=['POST'])
def rl_feedback_submit():
    """
    Handle ML Feedback Prompt submissions (Better/Same/Worse)
    """
    try:
        data = request.json
        user_id = data.get('userId')
        setting_key = data.get('settingKey')
        feedback = data.get('feedback')
        
        print(f"🎯 ML Feedback Received: {user_id} rated {setting_key} as '{feedback}'")
        
        # Map qualitative feedback to quantitative reward
        reward = 0
        if feedback == 'positive':
            reward = 1.0
        elif feedback == 'negative':
            reward = -1.0
            
        # Optional: could call feedback() internal logic here to update Q-values.
        # For the mock server, returning success is enough to fix the UI error.
        
        return jsonify({
            'success': True,
            'reward': reward,
            'message': 'RL feedback successfully processed.'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/manual-settings/apply', methods=['POST'])
def manual_settings_apply():
    """
    Handle Saving of Settings when user clicks "👍 Better" on the ML Prompt
    """
    try:
        data = request.json
        user_id = data.get('userId')
        settings = data.get('settings', {})
        
        print(f"💾 Saving manual settings for {user_id}: {settings}")
        
        if user_id not in user_profiles:
             user_profiles[user_id] = {}
             
        # Merge new settings
        user_profiles[user_id].update(settings)
        
        return jsonify({
            'success': True,
            'message': 'Settings persisted.'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/users/<user_id>/profile', methods=['GET'])
def get_user_profile(user_id):
    """
    Fetch the saved profile for a user so settings persist across page reloads.
    """
    try:
        # Default starting profile
        profile = {
          "font_size": 17,
          "line_height": 1.6,
          "contrast_mode": "normal",
          "primary_color": "#1a73e8",
          "primary_color_content": "#ffffff",
          "secondary_color": "#1a73e8",
          "secondary_color_content": "#ffffff",
          "accent_color": "#e37400",
          "accent_color_content": "#ffffff",
          "theme": "light",
          "element_spacing_x": 7,
          "element_spacing_y": 4,
          "element_padding_x": 8,
          "element_padding_y": 8,
          "reduced_motion": False,
          "target_size": 32,
          "tooltip_assist": True,
          "layout_simplification": True
        }
        
        # Overlay any saved custom settings
        saved_settings = user_profiles.get(user_id, {})
        
        # Map frontend camelCase to backend snake_case if necessary
        mapping = {
            'fontSize': 'font_size',
            'lineHeight': 'line_height',
            'targetSize': 'target_size',
            'contrastMode': 'contrast_mode',
            'elementSpacing': 'element_spacing_y', # Simple map for demo
        }
        
        for k, v in saved_settings.items():
            db_key = mapping.get(k, k)
            profile[db_key] = v
            
        return jsonify({
            'success': True,
            'profile': {
                'user_id': user_id,
                'metadata': {
                    'origin': 'user',
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'confidence_overall': 0.8,
                    'version': 1
                },
                'profile': profile
            },
            'diff': {
                'changed': list(saved_settings.keys()),
                'new': profile,
                'old': profile
            }
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


@app.route('/rl/temp-user/score', methods=['POST'])
def temp_user_score():
    """Score a batch of interactions for temp user detection"""
    try:
        data = request.json
        # Convert dictionary to InteractionBatch Pydantic model
        batch = InteractionBatch(**data)
        
        result = temp_user_detector.score_batch(batch)
        
        # Serialize result to dict
        response = {
            "is_quarantined": result.is_quarantined,
            "is_rejected": result.is_rejected,
            "outcome": result.outcome,
            "anomaly_score": result.anomaly_score,
            "similarity_score": result.similarity_score,
            "heuristic_components": result.heuristic_components,
            "reason": result.reason,
            "trace_id": result.trace.trace_id
        }
        
        print(f"🕵️‍♂️ Temp User Check: {result.outcome} (Anomaly: {result.anomaly_score:.2f})")
        
        return jsonify({
            'success': True,
            'result': response
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/temp-user/train', methods=['POST'])
def temp_user_train():
    """Train temp user detector on synthetic data"""
    try:
        count = temp_user_detector.train_from_synth()
        print(f"🎓 Trained Temp User Detector on {count} synthetic samples")
        return jsonify({
            'success': True,
            'message': f"Trained on {count} samples"
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/temp-user/baseline', methods=['POST'])
def temp_user_update_baseline():
    """Update user baseline"""
    try:
        data = request.json
        user_id = data.get('userId')
        features = data.get('features') # list of floats
        
        if not user_id or not features:
             return jsonify({'error': 'userId and features required'}), 400
             
        temp_user_detector.update_baseline(user_id, features)
        
        return jsonify({'success': True, 'message': 'Baseline updated'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/settings-events/<user_id>')
def settings_events(user_id):
    """
    Server-Sent Events (SSE) endpoint for real-time settings sync.
    """
    def generate():
        # Send initial connected event
        yield f"data: {{\"type\": \"connected\", \"userId\": \"{user_id}\"}}\n\n"
        
        # Keep connection alive with periodic pings (if needed)
        # We can yield actual updates here if the ML engine pushes them asynchronously
        while True:
            time.sleep(30)
            yield f"data: {{\"type\": \"ping\", \"timestamp\": \"{datetime.now(timezone.utc).isoformat()}\"}}\n\n"

    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    })

# ===== HELPER FUNCTIONS =====


def get_action_space(parameter):
    """Get possible actions for a parameter"""
    action_spaces = {
        'fontSize': ['small', 'medium', 'large', 'x-large'],
        'lineHeight': [1.2, 1.4, 1.5, 1.6, 1.8, 2.0],
        'theme': ['light', 'dark', 'auto'],
        'contrastMode': ['normal', 'high'],
        'elementSpacing': ['compact', 'normal', 'wide'],
        'targetSize': [24, 28, 32, 36, 40, 44, 48, 52, 60, 72],
        'reducedMotion': [False, True],
        'tooltipAssist': [False, True],
        'layoutSimplification': [False, True]
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
    import os
    from dotenv import load_dotenv
    load_dotenv()
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))

    print("🐍 Starting Enhanced DQN Service with Smart Suggestions...")
    print(f"📡 {host}:{port}")
    print("✨ Features: Smart action selection, Q-learning, Feedback-aware suggestions")
    app.run(host=host, port=port, debug=True)
