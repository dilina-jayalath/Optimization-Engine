"""
Test script for DQN integration

Run: python test_dqn.py
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"
USER_ID = "u_001"
PARAMETER = "fontSize"

def test_health():
    """Test DQN service health"""
    print("\n1. Testing DQN Health...")
    response = requests.get(f"{BASE_URL}/rl/health")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_initialize():
    """Initialize DQN agent"""
    print("\n2. Initializing DQN Agent...")
    response = requests.post(
        f"{BASE_URL}/rl/initialize",
        json={
            "userId": USER_ID,
            "parameter": PARAMETER
        }
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_choose_action():
    """Get action recommendation"""
    print("\n3. Getting Action Recommendation...")
    response = requests.post(
        f"{BASE_URL}/rl/choose-action",
        json={
            "userId": USER_ID,
            "parameter": PARAMETER,
            "state": {
                "fontSize": "medium",
                "theme": "dark",
                "lineHeight": 1.5,
                "deviceType": "mobile",
                "timeOfDay": "evening"
            },
            "explore": True
        }
    )
    print(f"Status: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2))
    return result.get('action')

def test_feedback(action):
    """Submit feedback and train"""
    print(f"\n4. Submitting Feedback for action '{action}'...")
    response = requests.post(
        f"{BASE_URL}/rl/feedback",
        json={
            "userId": USER_ID,
            "parameter": PARAMETER,
            "state": {
                "fontSize": "medium",
                "theme": "dark",
                "lineHeight": 1.5,
                "deviceType": "mobile"
            },
            "action": action,
            "reward": 1.0,  # Positive feedback
            "nextState": {
                "fontSize": action,
                "theme": "dark",
                "lineHeight": 1.5,
                "deviceType": "mobile"
            },
            "done": False
        }
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_stats():
    """Get training statistics"""
    print("\n5. Getting Training Statistics...")
    response = requests.get(
        f"{BASE_URL}/rl/stats",
        params={
            "userId": USER_ID,
            "parameter": PARAMETER
        }
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_save_model():
    """Save trained model"""
    print("\n6. Saving Model...")
    response = requests.post(
        f"{BASE_URL}/rl/save",
        json={
            "userId": USER_ID,
            "parameter": PARAMETER
        }
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_batch_train():
    """Batch training with multiple experiences"""
    print("\n7. Batch Training...")
    experiences = [
        {
            "state": {"fontSize": "small", "theme": "light", "deviceType": "desktop"},
            "action": "medium",
            "reward": 0.5,
            "nextState": {"fontSize": "medium", "theme": "light", "deviceType": "desktop"}
        },
        {
            "state": {"fontSize": "medium", "theme": "dark", "deviceType": "mobile"},
            "action": "large",
            "reward": 1.0,
            "nextState": {"fontSize": "large", "theme": "dark", "deviceType": "mobile"}
        },
        {
            "state": {"fontSize": "large", "theme": "dark", "deviceType": "mobile"},
            "action": "x-large",
            "reward": -0.5,
            "nextState": {"fontSize": "x-large", "theme": "dark", "deviceType": "mobile"}
        }
    ]
    
    response = requests.post(
        f"{BASE_URL}/rl/batch-train",
        json={
            "userId": USER_ID,
            "parameter": PARAMETER,
            "experiences": experiences,
            "epochs": 5
        }
    )
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def run_learning_loop(iterations=10):
    """Run multiple learning iterations"""
    print(f"\n8. Running {iterations} Learning Iterations...")
    
    for i in range(iterations):
        print(f"\nIteration {i+1}/{iterations}")
        
        # Get action
        action = test_choose_action()
        
        # Simulate feedback
        reward = 1.0 if i % 3 != 0 else -0.5  # Mostly positive
        
        requests.post(
            f"{BASE_URL}/rl/feedback",
            json={
                "userId": USER_ID,
                "parameter": PARAMETER,
                "state": {"fontSize": "medium", "deviceType": "desktop"},
                "action": action,
                "reward": reward,
                "nextState": {"fontSize": action, "deviceType": "desktop"}
            }
        )
        
        time.sleep(0.1)
    
    # Show final stats
    test_stats()

if __name__ == "__main__":
    print("=" * 60)
    print("DQN Integration Test")
    print("=" * 60)
    
    try:
        test_health()
        test_initialize()
        action = test_choose_action()
        test_feedback(action)
        test_stats()
        test_batch_train()
        run_learning_loop(10)
        test_save_model()
        
        print("\n" + "=" * 60)
        print("✅ All tests completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure Python DQN service is running:")
        print("  cd python_rl_service")
        print("  python app.py")
