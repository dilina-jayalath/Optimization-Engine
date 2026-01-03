# Trial-Based System Flow Diagram

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Trial-Based System                              │
│                                                                         │
│  One-at-a-time • Anomaly-driven • Directional • Bounded • Locking      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: ML Suggests Change                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ML Engine (Group Member's)                                             │
│       │                                                                 │
│       ├─ Tracks interactions: clicks, scrolls, dwell time              │
│       ├─ Learns user profile: visual, motor, cognitive preferences     │
│       └─ Suggests: fontSize=large, targetSize=large, ...               │
│                                                                         │
│                              ↓                                          │
│                                                                         │
│  POST /api/trials/propose                                               │
│       {                                                                 │
│         userId: "guest",                                                │
│         mlSuggestedProfile: {                                           │
│           "visual.fontSize": "large"  ← ML suggestion                  │
│         }                                                               │
│       }                                                                 │
│                                                                         │
│                              ↓                                          │
│                                                                         │
│  Trial System Response                                                  │
│       {                                                                 │
│         hasTrial: true,                                                 │
│         proposal: {                                                     │
│           settingKey: "visual.fontSize",                                │
│           oldValue: "medium" (current),                                 │
│           newValue: "large" (ML's suggestion),                          │
│           attemptNumber: 1                                              │
│         }                                                               │
│       }                                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Start Trial (Silent Application)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  POST /api/trials/start                                                 │
│       {                                                                 │
│         settingKey: "visual.fontSize",                                  │
│         oldValue: "medium",                                             │
│         newValue: "large"                                               │
│       }                                                                 │
│                                                                         │
│                              ↓                                          │
│                                                                         │
│  Creates Trial Record:                                                  │
│       {                                                                 │
│         trialId: "uuid",                                                │
│         status: "active",                                               │
│         startTime: now,                                                 │
│         metrics: {                                                      │
│           clickCount: 0,                                                │
│           misclickCount: 0,                                             │
│           ...                                                           │
│         }                                                               │
│       }                                                                 │
│                                                                         │
│  Updates Preference State:                                              │
│       {                                                                 │
│         settingKey: "visual.fontSize",                                  │
│         currentValue: "large" ← APPLIED SILENTLY                       │
│         trialCount: 1                                                   │
│       }                                                                 │
│                                                                         │
│  Returns:                                                               │
│       {                                                                 │
│         trialId: "uuid",                                                │
│         evaluationWindow: 60000ms ← Monitor for 60 seconds             │
│       }                                                                 │
│                                                                         │
│  📱 USER SEES: fontSize changes to 18px (large)                        │
│               NO PROMPT YET - just monitoring                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Passive Monitoring (60 seconds or 5+ clicks)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  BehaviorTracker (Your System)                                          │
│       │                                                                 │
│       ├─ Tracks: clicks, misclicks, rage clicks                        │
│       ├─ Measures: time-to-click, form errors                          │
│       ├─ Detects: zoom events (pinch, ctrl+scroll)                     │
│       └─ Compares: current vs baseline metrics                         │
│                                                                         │
│  Example Metrics:                                                       │
│       {                                                                 │
│         clickCount: 10,                                                 │
│         misclickCount: 5,        ← HIGH (50% misclick rate!)          │
│         rageClickCount: 2,       ← User frustrated                     │
│         avgTimeToClick: 1500ms,  ← Slower than baseline                │
│         formErrorCount: 1,                                              │
│         zoomEventCount: 0                                               │
│       }                                                                 │
│                                                                         │
│  📱 USER EXPERIENCE: Using app normally, no interruption               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Evaluate Trial (Anomaly Scoring)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  POST /api/trials/evaluate                                              │
│       {                                                                 │
│         trialId: "uuid",                                                │
│         metrics: {...}  ← From BehaviorTracker                         │
│       }                                                                 │
│                                                                         │
│                              ↓                                          │
│                                                                         │
│  Anomaly Scoring Algorithm:                                             │
│                                                                         │
│    anomalyScore =                                                       │
│      (misclickRate × 0.30) +     ← 5/10 = 0.50 × 0.30 = 0.15          │
│      (rageClicks × 0.25) +       ← 2    × 0.25        = 0.50          │
│      (timeToClick × 0.20) +      ← normalized         = 0.00          │
│      (formErrors × 0.15) +       ← 1    × 0.15        = 0.15          │
│      (zoomEvents × 0.10)         ← 0    × 0.10        = 0.00          │
│                                  ─────────────────────────────          │
│                                  Total = 0.65 (HIGH ANOMALY!)          │
│                                                                         │
│  Decision Tree:                                                         │
│                                                                         │
│    if anomalyScore < 0.3:                                               │
│      → Accept silently ✅                                               │
│      → No prompt needed                                                 │
│                                                                         │
│    else if anomalyScore > 0.7:                                          │
│      → Revert silently ❌                                               │
│      → Change was too problematic                                       │
│                                                                         │
│    else: (0.3 - 0.7) ← OUR CASE: 0.65                                  │
│      → Check if should prompt 🤔                                        │
│      → Cooldowns OK? Yes ✅                                             │
│      → Past negative feedback? No                                       │
│      → anomalyScore > 0.5? Yes ✅                                       │
│      → SHOW PROMPT                                                      │
│                                                                         │
│  Returns:                                                               │
│       {                                                                 │
│         decision: "prompt",                                             │
│         anomalyScore: 0.65,                                             │
│         shouldPrompt: true  ← Show DirectionalFeedbackPrompt           │
│       }                                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: Directional Feedback Prompt (Only if shouldPrompt=true)       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📱 USER SEES:                                                          │
│                                                                         │
│      ┌─────────────────────────────────────────┐                       │
│      │ 💡 We adjusted your settings       [×] │                       │
│      │                                         │                       │
│      │ ┌─────────────────────────────────────┐ │                       │
│      │ │ Font Size: medium → large          │ │                       │
│      │ │ How does this feel?                │ │                       │
│      │ └─────────────────────────────────────┘ │                       │
│      │                                         │                       │
│      │ Is this change working for you?         │                       │
│      │                                         │                       │
│      │ [ 👍 Yes, keep it ]                    │                       │
│      │ [ ⬇️ Too large / Too much ]            │                       │
│      │ [ ⬆️ Too small / Not enough ]          │                       │
│      │ [ Not sure / Don't ask again ]         │                       │
│      └─────────────────────────────────────────┘                       │
│                                                                         │
│  Component: DirectionalFeedbackPrompt                                   │
│       - Props: trialId, settingName, oldValue, newValue                │
│       - Position: bottom-right (configurable)                           │
│       - Auto-dismiss: Optional after N seconds                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: Process Feedback (Bounded Search)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SCENARIO A: User clicks "⬇️ Too large"                                │
│  ────────────────────────────────────────                               │
│                                                                         │
│  POST /api/trials/feedback                                              │
│       {                                                                 │
│         trialId: "uuid",                                                │
│         feedbackType: "dislike",                                        │
│         reason: "too_big"                                               │
│       }                                                                 │
│                                                                         │
│                              ↓                                          │
│                                                                         │
│  Bounded Search Logic:                                                  │
│                                                                         │
│    Current ladder: [small, medium, LARGE, xlarge]                      │
│                                 ↑ currently here                        │
│                                                                         │
│    Feedback: "too_big" → Move DOWN                                     │
│                                                                         │
│    Next value: medium (one step down)                                   │
│                                                                         │
│    Update preference state:                                             │
│      - currentValue: "medium"                                           │
│      - trialCount: 2 (increment)                                        │
│      - failedTrials: 1                                                  │
│      - cooldownUntil: now + 10 minutes                                  │
│                                                                         │
│  Returns:                                                               │
│       {                                                                 │
│         locked: false,  ← Not locked yet, can try again                │
│         nextSuggestion: {                                               │
│           settingKey: "visual.fontSize",                                │
│           value: "medium",                                              │
│           attemptNumber: 2                                              │
│         },                                                              │
│         message: "Will try medium next"                                 │
│       }                                                                 │
│                                                                         │
│  📱 USER SEES: fontSize changes back to 16px (medium)                  │
│                No prompt for 10 minutes                                 │
│                                                                         │
│  ────────────────────────────────────────────                           │
│                                                                         │
│  SCENARIO B: User clicks "👍 Yes, keep it"                            │
│  ────────────────────────────────────────                               │
│                                                                         │
│  POST /api/trials/feedback                                              │
│       {                                                                 │
│         feedbackType: "like"                                            │
│       }                                                                 │
│                                                                         │
│                              ↓                                          │
│                                                                         │
│  Preference Locking:                                                    │
│                                                                         │
│    Update preference state:                                             │
│      - preferredValue: "large" ← CONFIRMED                             │
│      - locked: true ← NEVER CHANGE AGAIN                               │
│      - successfulTrials: 1                                              │
│                                                                         │
│  Returns:                                                               │
│       {                                                                 │
│         locked: true,  ← Preference locked forever                     │
│         message: "Preference locked at large"                           │
│       }                                                                 │
│                                                                         │
│  📱 USER SEES: fontSize stays at 18px (large)                          │
│                Will NEVER change again                                  │
│                ML suggestions ignored for this setting                  │
│                                                                         │
│  ────────────────────────────────────────────                           │
│                                                                         │
│  SCENARIO C: User clicks "Not sure / Don't ask again"                  │
│  ────────────────────────────────────────────                           │
│                                                                         │
│  POST /api/trials/feedback                                              │
│       {                                                                 │
│         feedbackType: "dislike",                                        │
│         reason: "dismiss"                                               │
│       }                                                                 │
│                                                                         │
│                              ↓                                          │
│                                                                         │
│  Dismissal Handling:                                                    │
│                                                                         │
│    Update preference state:                                             │
│      - dismissCount: 1                                                  │
│      - cooldownUntil: now + 24 HOURS ← Long cooldown                   │
│                                                                         │
│  📱 USER SEES: No prompts for 24 hours                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ COOLDOWN SYSTEM (Multi-Layer Protection)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layer 1: Global Cooldown                                               │
│       → 10 minutes between ANY prompts (any setting)                    │
│       → Prevents rapid-fire prompts                                     │
│                                                                         │
│  Layer 2: Per-Setting Cooldown                                          │
│       → 24 hours after "dismiss" for that specific setting              │
│       → User said "don't ask again" → respect it                        │
│                                                                         │
│  Layer 3: Session Limit                                                 │
│       → Max 1 prompt per session                                        │
│       → One question, then leave user alone                             │
│                                                                         │
│  Layer 4: Retry Limit                                                   │
│       → Max 2 retries per setting                                       │
│       → If still not found preference after 2 tries → stop             │
│       → Set 24-hour cooldown automatically                              │
│                                                                         │
│  Example Timeline:                                                      │
│                                                                         │
│    Trial 1: medium → large (prompted, user said "too big")             │
│       ↓ 10 minutes                                                      │
│    Trial 2: large → medium (accept silently, no prompt)                │
│       ↓ confirmed                                                       │
│    LOCKED at medium ✅                                                  │
│                                                                         │
│    Total prompts: 1                                                     │
│    Total time: ~10-15 minutes                                           │
│    User interruptions: 1                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ COMPARISON: Thompson Sampling vs Trial-Based                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Thompson Sampling (Old):                                               │
│  ────────────────────────                                               │
│    • Continuous optimization (all settings at once)                     │
│    • Time-based prompts (every 30 seconds)                              │
│    • Binary feedback (👍 like / 👎 dislike)                           │
│    • Explores indefinitely (50-200 episodes)                            │
│    • Settings keep changing                                             │
│    • No cooldowns                                                       │
│    • Typical convergence: Days/weeks                                    │
│                                                                         │
│  Trial-Based (New):                                                     │
│  ──────────────────                                                     │
│    • One setting at a time                                              │
│    • Anomaly-driven prompts (only when problem detected)                │
│    • Directional feedback (too big / too small / other)                 │
│    • Max 2 retries per setting                                          │
│    • Locks preferences after confirmation                               │
│    • Multi-layer cooldowns (10min/24hr/session/retry)                  │
│    • Typical convergence: 1-3 trials (10-30 minutes)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ WHY THIS DOESN'T DUPLICATE GROUP MEMBER'S WORK                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Group Member's ML Engine:                                              │
│  ─────────────────────────                                              │
│    Goal: General personalization                                        │
│    Input: ALL interactions (clicks, scrolls, time, etc.)                │
│    Output: Suggested user profile                                       │
│    Approach: Proactive learning                                         │
│    Scope: Continuous optimization                                       │
│                                                                         │
│            ↓ SUGGESTS PROFILE                                           │
│                                                                         │
│  Your Trial-Based System:                                               │
│  ────────────────────────                                               │
│    Goal: Safe testing & preference discovery                            │
│    Input: PROBLEM patterns (anomalies)                                  │
│    Output: Confirmed user preferences                                   │
│    Approach: Reactive intervention                                      │
│    Scope: Bounded search → lock                                         │
│                                                                         │
│  COMPLEMENTARY, NOT DUPLICATE:                                          │
│  ────────────────────────────                                           │
│    Their system: "User might like fontSize=large"                       │
│         ↓                                                               │
│    Your system: "Let's test it safely and confirm"                      │
│         ↓                                                               │
│    Result: "User confirmed fontSize=large, lock it"                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
