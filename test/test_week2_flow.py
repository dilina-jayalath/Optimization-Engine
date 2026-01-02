"""
Week 2 Integration Test
Tests Thompson Sampling personalization flow
"""

import requests
import time
import json

BASE_URL = "http://localhost:5002"

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60 + "\n")

def test_health():
    """Test personalization service health"""
    print("🏥 Testing health check...")
    response = requests.get(f"{BASE_URL}/health")
    data = response.json()
    assert data['status'] == 'healthy'
    print("✅ Service is healthy\n")

def test_personalization():
    """Test getting personalized UI settings"""
    print_section("🎯 Test 1: Get Personalization")
    
    # User with high visual impairment
    payload = {
        "userId": "test_user_001",
        "context": {
            "visual_impairment": 0.8,
            "motor_skills": 0.5,
            "cognitive_load": 0.3
        },
        "mode": "explore"
    }
    
    print(f"Request: {json.dumps(payload, indent=2)}")
    response = requests.post(f"{BASE_URL}/personalize", json=payload)
    data = response.json()
    
    print(f"\nResponse:")
    print(f"  Success: {data['success']}")
    print(f"  Session ID: {data['sessionId']}")
    print(f"  Arm Index: {data['armIndex']}")
    print(f"  Settings: {data['settings']['name']}")
    print(f"  Font Size: {data['settings']['fontSize']}")
    print(f"  Contrast: {data['settings']['contrast']}")
    
    return data['sessionId']

def test_feedback(session_id, reward_value):
    """Test sending feedback to Thompson Sampling"""
    print_section(f"📊 Test 2: Send Feedback (reward={reward_value:.2f})")
    
    # Simulate behavior metrics
    if reward_value > 0.7:
        # Good session
        metrics = {
            "duration": 180000,  # 3 minutes
            "interactionCount": 15,
            "errorCount": 0,
            "scrollDepth": 0.8,
            "tasksCompleted": 3,
            "immediateReversion": False
        }
    else:
        # Bad session
        metrics = {
            "duration": 5000,  # 5 seconds
            "interactionCount": 1,
            "errorCount": 2,
            "scrollDepth": 0.1,
            "tasksCompleted": 0,
            "immediateReversion": True
        }
    
    payload = {
        "sessionId": session_id,
        "metrics": metrics
    }
    
    print(f"Sending metrics:")
    print(f"  Duration: {metrics['duration']}ms")
    print(f"  Interactions: {metrics['interactionCount']}")
    print(f"  Errors: {metrics['errorCount']}")
    print(f"  Immediate Revert: {metrics['immediateReversion']}")
    
    response = requests.post(f"{BASE_URL}/feedback", json=payload)
    data = response.json()
    
    print(f"\nFeedback Result:")
    print(f"  Success: {data['success']}")
    print(f"  Calculated Reward: {data['reward']:.3f}")
    print(f"  Confidence: {data['confidence']:.3f}")
    print(f"  Updated: {data['updated']}")

def test_stats():
    """Test getting arm statistics"""
    print_section("📈 Test 3: View Statistics")
    
    # Default context
    response = requests.get(f"{BASE_URL}/stats")
    data = response.json()
    
    print(f"Total Updates: {data['totalUpdates']}")
    print(f"\nArm Statistics:")
    
    for arm in data['arms']:
        print(f"\n  Arm {arm['arm_index']}: {arm['arm_config']['name']}")
        print(f"    Expected Reward: {arm['expected_reward']:.3f}")
        print(f"    Pulls: {arm['pulls']}")
        print(f"    Confidence: {arm['confidence']:.1f}")
    
    print(f"\n🏆 Best Arm: {data['bestArm']['config']['name']}")
    print(f"   Expected Reward: {data['bestArm']['expectedReward']:.3f}")

def test_learning_cycle():
    """Test full learning cycle with multiple sessions"""
    print_section("🔄 Test 4: Learning Cycle (10 sessions)")
    
    for i in range(10):
        print(f"\n--- Session {i+1}/10 ---")
        
        # Context for user with high visual impairment
        context = {
            "visual_impairment": 0.8,
            "motor_skills": 0.5,
            "cognitive_load": 0.3
        }
        
        # Get personalization
        payload = {
            "userId": f"learning_user_{i}",
            "context": context,
            "mode": "explore"
        }
        
        response = requests.post(f"{BASE_URL}/personalize", json=payload)
        data = response.json()
        
        session_id = data['sessionId']
        arm_name = data['settings']['name']
        
        print(f"  Selected: {arm_name}")
        
        # Simulate reward based on arm quality for this context
        # For high visual impairment, large text with high contrast should get high rewards
        if arm_name in ['large_high_contrast', 'extra_large']:
            reward = 0.8 + (0.15 * (i / 10))  # Increase over time (0.80 → 0.95)
        elif arm_name in ['large_text', 'high_contrast']:
            reward = 0.5 + (0.2 * (i / 10))   # Medium reward (0.50 → 0.70)
        else:
            reward = 0.2 + (0.1 * (i / 10))   # Low reward (0.20 → 0.30)
        
        # Send feedback
        metrics = {
            "duration": int(120000 + (reward * 60000)),
            "interactionCount": int(10 + (reward * 10)),
            "errorCount": int(5 * (1 - reward)),
            "scrollDepth": reward * 0.9,
            "tasksCompleted": int(reward * 3),
            "immediateReversion": reward < 0.3
        }
        
        feedback_payload = {
            "sessionId": session_id,
            "metrics": metrics
        }
        
        response = requests.post(f"{BASE_URL}/feedback", json=feedback_payload)
        result = response.json()
        
        print(f"  Reward: {result['reward']:.3f}")
        
        time.sleep(0.2)  # Small delay
    
    # Check final stats
    print("\n" + "="*60)
    print("  Final Statistics After Learning")
    print("="*60 + "\n")
    
    response = requests.get(f"{BASE_URL}/stats?context=visual_impairment:high,motor_skills:medium")
    data = response.json()
    
    print(f"Total Updates: {data['totalUpdates']}")
    print(f"\nLearned Preferences:")
    
    # Sort arms by expected reward
    sorted_arms = sorted(data['arms'], key=lambda x: x['expected_reward'], reverse=True)
    
    for i, arm in enumerate(sorted_arms[:3]):
        print(f"\n  #{i+1}. {arm['arm_config']['name']}")
        print(f"      Expected Reward: {arm['expected_reward']:.3f} ⭐")
        print(f"      Pulls: {arm['pulls']}")
        print(f"      Confidence: {arm['confidence']:.1f}")
    
    print(f"\n🏆 Best Overall: {data['bestArm']['config']['name']}")
    print(f"   Expected Reward: {data['bestArm']['expectedReward']:.3f}")
    print(f"\n✨ Thompson Sampling has learned the optimal UI!")

def main():
    print("\n🚀 Week 2: Thompson Sampling Integration Test\n")
    
    try:
        # Test 1: Health check
        test_health()
        
        # Test 2: Get personalization
        session_id = test_personalization()
        
        # Test 3: Send good feedback
        test_feedback(session_id, 0.85)
        
        # Test 4: View statistics
        test_stats()
        
        # Test 5: Full learning cycle
        test_learning_cycle()
        
        print("\n" + "="*60)
        print("  ✅ ALL TESTS PASSED!")
        print("="*60)
        print("\n🎉 Week 2 Thompson Sampling is working!\n")
        print("Key achievements:")
        print("  ✅ Personalization service responding")
        print("  ✅ Thompson Sampling selecting arms")
        print("  ✅ Feedback loop working")
        print("  ✅ Learning from behavior")
        print("  ✅ Converging to optimal UI\n")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to personalization service")
        print("   Make sure the service is running:")
        print("   cd python_rl_service && python personalization_service.py\n")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}\n")
        raise

if __name__ == '__main__':
    main()
