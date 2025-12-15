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
    """Choose action"""
    try:
        data = request.json
        user_id = data.get('userId')
        parameter = data.get('parameter')
        
        # Simple random action selection
        actions = {
            'fontSize': ['small', 'medium', 'large', 'x-large'],
            'theme': ['light', 'dark'],
            'lineHeight': [1.4, 1.6, 1.8]
        }
        
        import random
        action_list = actions.get(parameter, ['medium'])
        action = random.choice(action_list)
        
        return jsonify({
            'success': True,
            'action': action,
            'actionIndex': 0,
            'qValue': 0.5,
            'epsilon': 0.2
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/rl/feedback', methods=['POST'])
def feedback():
    """Submit feedback"""
    try:
        data = request.json
        user_id = data.get('userId')
        parameter = data.get('parameter')
        reward = data.get('reward', 0)
        
        key = f"{user_id}:{parameter}"
        if key not in agents_data:
            agents_data[key] = {'steps': 0, 'epsilon': 1.0}
        
        agents_data[key]['steps'] += 1
        
        return jsonify({
            'success': True,
            'loss': 0.01,
            'stats': agents_data[key]
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

if __name__ == '__main__':
    print("🐍 Starting Simple DQN Service...")
    print("📡 http://localhost:8000")
    app.run(host='0.0.0.0', port=8000, debug=True)
