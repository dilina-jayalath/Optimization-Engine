"""
Personalization Service
Integrates Thompson Sampling with Implicit Reward System

Provides REST API for:
1. Getting personalized UI settings for a user
2. Updating Thompson Sampling based on behavior feedback
3. Managing bandit state
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from thompson_sampling import ThompsonSamplingBandit, create_ui_bandit
from implicit_reward import ImplicitRewardCalculator
import logging
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)

# Initialize services
bandit = create_ui_bandit()
reward_calculator = ImplicitRewardCalculator()

# Try to load saved state
STATE_FILE = 'bandit_state.json'
if os.path.exists(STATE_FILE):
    try:
        bandit.load_state(STATE_FILE)
        logging.info(f"Loaded bandit state from {STATE_FILE}")
    except Exception as e:
        logging.warning(f"Could not load bandit state: {e}")

# In-memory storage for sessions (replace with Redis in production)
session_data = {}

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'personalization-service',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/personalize', methods=['POST'])
def get_personalization():
    """
    Get personalized UI settings for a user
    
    POST /personalize
    {
        "userId": "user_001",
        "context": {
            "visual_impairment": 0.8,
            "motor_skills": 0.5,
            "cognitive_load": 0.3
        },
        "mode": "explore" | "exploit"  // Optional, default: explore
    }
    
    Returns:
    {
        "success": true,
        "userId": "user_001",
        "armIndex": 3,
        "settings": {
            "fontSize": "18px",
            "contrast": "high",
            ...
        },
        "mode": "explore",
        "sessionId": "session_123"
    }
    """
    try:
        data = request.get_json()
        
        user_id = data.get('userId')
        context = data.get('context', {})
        mode = data.get('mode', 'explore')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Missing userId'
            }), 400
        
        if mode == 'exploit':
            # Use best known arm (exploitation)
            arm_idx, arm_config, expected_reward = bandit.get_best_arm(context)
            logging.info(f"[Exploit] Selected best arm for {user_id}: {arm_config['name']} (expected: {expected_reward:.3f})")
        else:
            # Thompson Sampling (exploration + exploitation)
            arm_idx, arm_config = bandit.select_arm(context)
            logging.info(f"[Explore] Selected arm for {user_id}: {arm_config['name']}")
        
        # Create session to track this interaction
        session_id = f"session_{user_id}_{int(datetime.now().timestamp())}"
        session_data[session_id] = {
            'userId': user_id,
            'context': context,
            'armIndex': arm_idx,
            'armConfig': arm_config,
            'timestamp': datetime.now().isoformat(),
        }
        
        return jsonify({
            'success': True,
            'userId': user_id,
            'sessionId': session_id,
            'armIndex': arm_idx,
            'settings': arm_config,
            'mode': mode,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error in personalization: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/feedback', methods=['POST'])
def process_feedback():
    """
    Process behavior feedback and update Thompson Sampling
    
    POST /feedback
    {
        "sessionId": "session_...",
        "userId": "user_001",
        "metrics": {
            "duration": 180000,
            "interactionCount": 12,
            "errorCount": 0,
            "scrollDepth": 0.75,
            "tasksCompleted": 2,
            "immediateReversion": false
        }
    }
    
    Returns:
    {
        "success": true,
        "sessionId": "session_...",
        "reward": 0.75,
        "confidence": 0.85,
        "updated": true
    }
    """
    try:
        data = request.get_json()
        
        session_id = data.get('sessionId')
        metrics = data.get('metrics', {})
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Missing sessionId'
            }), 400
        
        # Get session info
        session = session_data.get(session_id)
        if not session:
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404
        
        # Calculate reward from behavior
        reward_result = reward_calculator.calculate_session_reward(
            duration=metrics.get('duration', 0),
            interaction_count=metrics.get('interactionCount', 0),
            error_count=metrics.get('errorCount', 0),
            scroll_depth=metrics.get('scrollDepth', 0),
            tasks_completed=metrics.get('tasksCompleted', 0),
            immediate_reversion=metrics.get('immediateReversion', False)
        )
        
        reward = reward_result['reward']
        confidence = reward_result['confidence']
        
        # Update Thompson Sampling
        bandit.update(
            arm_index=session['armIndex'],
            reward=reward,
            context=session['context']
        )
        
        # Save state periodically
        if len(bandit.history) % 10 == 0:
            bandit.save_state(STATE_FILE)
            logging.info(f"Saved bandit state ({len(bandit.history)} updates)")
        
        logging.info(f"[Feedback] Session {session_id}: reward={reward:.3f}, confidence={confidence:.3f}")
        
        return jsonify({
            'success': True,
            'sessionId': session_id,
            'reward': reward,
            'confidence': confidence,
            'breakdown': reward_result['breakdown'],
            'updated': True,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error processing feedback: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/feedback-explicit', methods=['POST'])
def process_explicit_feedback():
    """
    Process explicit user feedback and update Thompson Sampling

    POST /feedback-explicit
    {
        "sessionId": "session_...",
        "userId": "user_001",
        "reward": 0.0 to 1.0,
        "feedback": { "type": "positive" | "neutral" | "negative", "rating": 1..5 }
    }
    """
    try:
        data = request.get_json()

        session_id = data.get('sessionId')
        reward = data.get('reward')

        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Missing sessionId'
            }), 400

        if reward is None:
            return jsonify({
                'success': False,
                'error': 'Missing reward'
            }), 400

        # Ensure reward is within [0, 1]
        reward = max(0.0, min(1.0, float(reward)))

        session = session_data.get(session_id)
        if not session:
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404

        bandit.update(
            arm_index=session['armIndex'],
            reward=reward,
            context=session['context']
        )

        if len(bandit.history) % 10 == 0:
            bandit.save_state(STATE_FILE)
            logging.info(f"Saved bandit state ({len(bandit.history)} updates)")

        logging.info(f"[Explicit Feedback] Session {session_id}: reward={reward:.3f}")

        return jsonify({
            'success': True,
            'sessionId': session_id,
            'reward': reward,
            'updated': True,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logging.error(f"Error processing explicit feedback: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """
    Get overall statistics
    
    GET /stats?context=visual_impairment:high,motor_skills:medium
    
    Returns arm statistics for given context
    """
    try:
        # Parse context from query params
        context_str = request.args.get('context')
        context = {}
        
        if context_str:
            for part in context_str.split(','):
                if ':' in part:
                    key, value = part.split(':')
                    # Convert to numeric if possible
                    if value == 'low':
                        context[key] = 0.2
                    elif value == 'medium':
                        context[key] = 0.5
                    elif value == 'high':
                        context[key] = 0.8
                    else:
                        context[key] = value
        
        # Get arm statistics
        arm_stats = bandit.get_arm_statistics(context)
        
        # Get best arm
        best_arm, best_config, best_reward = bandit.get_best_arm(context)
        
        return jsonify({
            'success': True,
            'totalUpdates': len(bandit.history),
            'context': context,
            'arms': arm_stats,
            'bestArm': {
                'index': best_arm,
                'config': best_config,
                'expectedReward': best_reward
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error fetching stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/reset', methods=['POST'])
def reset_bandit():
    """Reset bandit to initial state (for testing)"""
    global bandit
    
    try:
        bandit = create_ui_bandit()
        
        # Remove saved state
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
        
        logging.info("Bandit reset to initial state")
        
        return jsonify({
            'success': True,
            'message': 'Bandit reset successfully'
        })
        
    except Exception as e:
        logging.error(f"Error resetting bandit: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Personalization Service (Thompson Sampling)")
    print("="*60)
    print("Endpoints:")
    print("  POST   /personalize   - Get personalized UI settings")
    print("  POST   /feedback      - Update with behavior feedback")
    print("  POST   /feedback-explicit - Update with explicit feedback")
    print("  GET    /stats         - Get arm statistics")
    print("  GET    /health        - Health check")
    print("  POST   /reset         - Reset bandit state (dev)")
    print("="*60)
    print("Server starting on http://localhost:5002")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5002, debug=True)
