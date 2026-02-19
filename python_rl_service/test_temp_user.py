import requests
import json
import time
import random

BASE_URL = "http://localhost:8000"
USER_ID = "test_user_001"

def generate_interaction(profile="normal"):
    """
    Generate a mock interaction batch.
    profile: 'normal', 'risky', 'chaotic'
    """
    
    # Base values (normal)
    click_count = 20
    misclick_rate = 0.05
    avg_click_interval_ms = 400
    avg_dwell_ms = 1500
    rage_clicks = 0
    zoom_events = 0
    scroll_speed_px_s = 250
    
    if profile == "risky":
        click_count = 10
        misclick_rate = 0.2
        avg_click_interval_ms = 200
        avg_dwell_ms = 800
        rage_clicks = 2
        scroll_speed_px_s = 400
    elif profile == "chaotic":
        click_count = 5
        misclick_rate = 0.6
        avg_click_interval_ms = 100
        avg_dwell_ms = 300
        rage_clicks = 8
        zoom_events = 2
        scroll_speed_px_s = 800

    return {
        "user_id": USER_ID,
        "batch_id": f"batch_{random.randint(1000, 9999)}",
        "captured_at": "2024-05-20T10:00:00Z",
        "page_context": {
            "domain": "localhost",
            "route": "/dashboard",
            "app_type": "web"
        },
        "events_agg": {
            "click_count": click_count,
            "misclick_rate": misclick_rate,
            "avg_click_interval_ms": avg_click_interval_ms,
            "avg_dwell_ms": avg_dwell_ms,
            "rage_clicks": rage_clicks,
            "zoom_events": zoom_events,
            "scroll_speed_px_s": scroll_speed_px_s
        }
    }

def test_train():
    print("\n1. Training Model...")
    response = requests.post(f"{BASE_URL}/rl/temp-user/train")
    print(f"Status: {response.status_code}")
    print(response.text)

def test_score_normal():
    print("\n2. Scoring Normal Batch...")
    batch = generate_interaction("normal")
    response = requests.post(f"{BASE_URL}/rl/temp-user/score", json=batch)
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_score_chaotic():
    print("\n3. Scoring Chaotic Batch (Should detect anomaly)...")
    batch = generate_interaction("chaotic")
    response = requests.post(f"{BASE_URL}/rl/temp-user/score", json=batch)
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    print("🧪 Testing Temp User Detection...")
    try:
        test_train()
        test_score_normal()
        test_score_chaotic()
    except Exception as e:
        print(f"❌ Error: {e}")
