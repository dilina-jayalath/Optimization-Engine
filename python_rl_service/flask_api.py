"""
Flask API for Implicit Reward Calculation
Exposes the ImplicitRewardCalculator via REST endpoints
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from implicit_reward import ImplicitRewardCalculator
import logging
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allow requests from your frontend

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)

# Initialize reward calculator
calculator = ImplicitRewardCalculator()

# In-memory storage for demo (replace with MongoDB in production)
session_data = {}
user_sessions = {}

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'implicit-reward-calculator',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/calculate_reward', methods=['POST'])
def calculate_reward():
    """
    Calculate reward from session behavior data
    
    Expected JSON body:
    {
        "sessionId": "session_123",
        "userId": "user_001",
        "duration": 180000,
        "interactionCount": 15,
        "errorCount": 0,
        "scrollDepth": 0.85,
        "tasksCompleted": 2,
        "immediateReversion": false
    }
    
    Returns:
    {
        "success": true,
        "sessionId": "session_123",
        "reward": 0.75,
        "confidence": 0.85,
        "breakdown": { ... }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        session_id = data.get('sessionId')
        user_id = data.get('userId')
        
        if not session_id or not user_id:
            return jsonify({
                'success': False,
                'error': 'Missing sessionId or userId'
            }), 400
        
        # Calculate reward
        result = calculator.calculate_session_reward(
            duration=data.get('duration', 0),
            interaction_count=data.get('interactionCount', 0),
            error_count=data.get('errorCount', 0),
            scroll_depth=data.get('scrollDepth', 0),
            tasks_completed=data.get('tasksCompleted', 0),
            immediate_reversion=data.get('immediateReversion', False)
        )
        
        # Store session data
        session_data[session_id] = {
            'userId': user_id,
            'data': data,
            'result': result,
            'timestamp': datetime.now().isoformat()
        }
        
        # Track user sessions
        if user_id not in user_sessions:
            user_sessions[user_id] = []
        user_sessions[user_id].append(session_id)
        
        logging.info(f"Calculated reward for session {session_id}: {result['reward']:.3f}")
        
        return jsonify({
            'success': True,
            'sessionId': session_id,
            'userId': user_id,
            'reward': result['reward'],
            'confidence': result['confidence'],
            'breakdown': result['breakdown'],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error calculating reward: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/user/<user_id>/aggregate_reward', methods=['GET'])
def get_user_aggregate_reward(user_id):
    """
    Get aggregated reward across multiple sessions for a user
    
    Returns:
    {
        "success": true,
        "userId": "user_001",
        "sessionCount": 5,
        "averageReward": 0.75,
        "patterns": { ... }
    }
    """
    try:
        if user_id not in user_sessions:
            return jsonify({
                'success': False,
                'error': 'No sessions found for user'
            }), 404
        
        # Get all session data for user
        sessions = []
        for session_id in user_sessions[user_id]:
            if session_id in session_data:
                session = session_data[session_id]
                sessions.append({
                    'duration': session['data'].get('duration', 0),
                    'interaction_count': session['data'].get('interactionCount', 0),
                    'error_count': session['data'].get('errorCount', 0),
                    'scroll_depth': session['data'].get('scrollDepth', 0),
                    'tasks_completed': session['data'].get('tasksCompleted', 0),
                    'immediate_reversion': session['data'].get('immediateReversion', False),
                    'reward': session['result']['reward']
                })
        
        # Calculate aggregate
        result = calculator.aggregate_sessions(sessions)
        
        logging.info(f"Aggregated {len(sessions)} sessions for user {user_id}: {result['average_reward']:.3f}")
        
        return jsonify({
            'success': True,
            'userId': user_id,
            'sessionCount': len(sessions),
            'averageReward': result['average_reward'],
            'patterns': result['patterns'],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error aggregating rewards: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/session/<session_id>/details', methods=['GET'])
def get_session_details(session_id):
    """Get details for a specific session"""
    try:
        if session_id not in session_data:
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404
        
        return jsonify({
            'success': True,
            'sessionId': session_id,
            'data': session_data[session_id]
        })
        
    except Exception as e:
        logging.error(f"Error fetching session: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    try:
        return jsonify({
            'success': True,
            'totalSessions': len(session_data),
            'totalUsers': len(user_sessions),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error fetching stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/patterns', methods=['GET'])
def get_patterns():
    """Detect simple patterns across sessions (Week 3)"""
    try:
        sessions = list(session_data.values())
        total = len(sessions)

        if total == 0:
            return jsonify({
                'success': True,
                'totalSessions': 0,
                'revertRate': 0,
                'averageReward': None,
                'highRiskSessions': [],
                'timestamp': datetime.now().isoformat()
            })

        revert_count = sum(1 for s in sessions if s['data'].get('immediateReversion'))
        avg_reward = sum(s['result']['reward'] for s in sessions) / total

        # Return 3 most recent high-risk sessions (reward < 0.3 or immediate revert)
        high_risk = [
            {
                'sessionId': sid,
                'userId': s['userId'],
                'reward': s['result']['reward'],
                'immediateReversion': s['data'].get('immediateReversion', False),
                'timestamp': s['timestamp'],
            }
            for sid, s in session_data.items()
            if s['result']['reward'] < 0.3 or s['data'].get('immediateReversion')
        ]
        high_risk = sorted(high_risk, key=lambda x: x['timestamp'], reverse=True)[:3]

        return jsonify({
            'success': True,
            'totalSessions': total,
            'revertRate': revert_count / total,
            'averageReward': avg_reward,
            'highRiskSessions': high_risk,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logging.error(f"Error fetching patterns: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/clear', methods=['POST'])
def clear_data():
    """Clear all data (for development only)"""
    global session_data, user_sessions
    session_data = {}
    user_sessions = {}
    
    logging.info("Cleared all data")
    
    return jsonify({
        'success': True,
        'message': 'All data cleared'
    })

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Implicit Reward Calculator API")
    print("="*60)
    print("Endpoints:")
    print("  POST   /calculate_reward           - Calculate reward from session data")
    print("  GET    /user/<id>/aggregate_reward - Get user's aggregate reward")
    print("  GET    /session/<id>/details       - Get session details")
    print("  GET    /health                     - Health check")
    print("  GET    /stats                      - Overall statistics")
    print("  POST   /clear                      - Clear all data (dev)")
    print("="*60)
    print("Server starting on http://localhost:5001")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5001, debug=True)
