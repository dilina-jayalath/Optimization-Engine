import requests
import json
import time
import random
import sys

# Configuration
BASE_URL = "http://localhost:8000"

# ANSI Colors for terminal output
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"

def print_header(text):
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN} {text}{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

def generate_interaction(profile="normal"):
    """
    Generate a mock interaction batch.
    profile: 'normal' (primary user), 'chaotic' (temp user/bot)
    """
    if profile == "normal":
        # Simulate a focused, regular user
        return {
            "user_id": "primary_user_01",
            "batch_id": f"batch_{random.randint(1000, 9999)}",
            "captured_at": "2024-05-20T10:00:00Z",
            "page_context": {"domain": "localhost", "route": "/dashboard", "app_type": "web"},
            "events_agg": {
                "click_count": 20,              # Reasonable clicks
                "misclick_rate": 0.02,          # Low error rate (Focused)
                "avg_click_interval_ms": 400,   # Steady rhythm
                "avg_dwell_ms": 1500,           # Reads content
                "rage_clicks": 0,               # Calm
                "zoom_events": 0,
                "scroll_speed_px_s": 250        # Normal reading speed
            }
        }
    elif profile == "chaotic":
        # Simulate a temp user / bot / erratic behavior
        return {
            "user_id": "temp_user_99",
            "batch_id": f"batch_{random.randint(1000, 9999)}",
            "captured_at": "2024-05-20T10:00:00Z",
            "page_context": {"domain": "localhost", "route": "/dashboard", "app_type": "web"},
            "events_agg": {
                "click_count": 8,
                "misclick_rate": 0.6,           # High error rate (Clumsy/Bot)
                "avg_click_interval_ms": 100,   # Too fast (Inhumanly fast clicks)
                "avg_dwell_ms": 300,            # skimming (Not reading)
                "rage_clicks": 5,               # Frustrated clicking (Rage)
                "zoom_events": 2,
                "scroll_speed_px_s": 800        # Fast scrolling
            }
        }

def analyze_result(result):
    outcome = result.get('outcome', 'unknown')
    score = result.get('anomaly_score', 0.0)
    reason = result.get('reason', 'N/A')
    
    if outcome == 'keep':
        color = GREEN
        icon = "✅"
    else:
        color = RED
        icon = "🚫"
        
    print(f"\n{icon} Result: {color}{outcome.upper()}{RESET}")
    print(f"   Anomaly Score: {color}{score:.2f}{RESET} (Thresholds: Quarantine=0.55, Reject=0.75)")
    print(f"   Reason: {reason}")
    print(f"   Heuristics: {json.dumps(result.get('heuristic_components', {}), indent=2)}")

def run_demo():
    print_header("TEMP USER DETECTION DEMO")
    print("This script simulates user interactions to demonstrate the detection engine.")
    print(f"Target Server: {BASE_URL}")

    # 1. Train/Init
    print(f"\n[{YELLOW}STEP 1{RESET}] Checking Server & Initializing Model...")
    try:
        # We trigger a 'train' to ensure the in-memory model (if any) is ready or just to check connectivity
        resp = requests.post(f"{BASE_URL}/rl/temp-user/train")
        if resp.status_code == 200:
            print(f"[{GREEN}OK{RESET}] Server is running. Model initialized.")
        else:
            print(f"[{RED}FAIL{RESET}] Server returned {resp.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print(f"[{RED}ERROR{RESET}] Could not connect to {BASE_URL}")
        print(f"{YELLOW}HINT{RESET}: Make sure the python_rl_service is running!")
        print(f"      Run: `python python_rl_service/app.py` in a separate terminal.")
        return

    time.sleep(1)

    # 2. Normal User Scenario
    print_header("SCENARIO 1: PRIMARY USER BEHAVIOR")
    print("Simulating a user who is comfortable, reads content, and clicks accurately.")
    
    normal_batch = generate_interaction("normal")
    print(f"\n📊 INPUT METRICS:")
    print(f"   - Misclick Rate: {normal_batch['events_agg']['misclick_rate']*100}%")
    print(f"   - Avg Dwell Time: {normal_batch['events_agg']['avg_dwell_ms']}ms")
    print(f"   - Rage Clicks: {normal_batch['events_agg']['rage_clicks']}")
    
    try:
        response = requests.post(f"{BASE_URL}/rl/temp-user/score", json=normal_batch)
        if response.status_code == 200:
            analyze_result(response.json()['result'])
        else:
            print(f"[{RED}Error{RESET}] {response.text}")
    except Exception as e:
        print(f"[{RED}Exception{RESET}] {e}")

    input(f"\n{YELLOW}Press Enter to run Scenario 2...{RESET}")

    # 3. Temp/Chaotic User Scenario
    print_header("SCENARIO 2: TEMP/CHAOTIC USER BEHAVIOR")
    print("Simulating a user (or bot) that is erratic, clicks too fast, and shows frustration.")
    
    chaotic_batch = generate_interaction("chaotic")
    
    print(f"\n📊 INPUT METRICS:")
    print(f"   - Misclick Rate: {chaotic_batch['events_agg']['misclick_rate']*100}% (High!)")
    print(f"   - Avg Dwell Time: {chaotic_batch['events_agg']['avg_dwell_ms']}ms (Too fast!)")
    print(f"   - Rage Clicks: {chaotic_batch['events_agg']['rage_clicks']} (Frustrated!)")
    
    try:
        response = requests.post(f"{BASE_URL}/rl/temp-user/score", json=chaotic_batch)
        if response.status_code == 200:
            analyze_result(response.json()['result'])
        else:
            print(f"[{RED}Error{RESET}] {response.text}")
    except Exception as e:
        print(f"[{RED}Exception{RESET}] {e}")

    print_header("DEMO COMPLETE")

if __name__ == "__main__":
    run_demo()
