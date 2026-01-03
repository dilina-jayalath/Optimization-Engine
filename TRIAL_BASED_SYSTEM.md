# Trial-Based Personalization System

## Overview

A **non-intrusive, user-respectful** personalization system that:
- Tests changes in **trial mode** (one at a time)
- Only asks for feedback when **problems detected**
- Uses **directional feedback** (too big/too small) for fast convergence
- **Locks preferences** once found (no more changes)
- Implements **smart cooldowns** to prevent spam

---

## 🎯 How This is Different

### vs Thompson Sampling (Previous System)

| Thompson Sampling | Trial-Based System |
|------------------|-------------------|
| Continuous optimization | **One trial at a time** |
| Asks after 30s delay | **Only asks if anomaly detected** |
| Binary feedback (👍/👎) | **Directional** (too big/small/other) |
| Explores indefinitely | **Max 2 retries, then locks** |
| Can change repeatedly | **Preference locking** |
| No cooldowns | **Multi-layer cooldowns** |

### vs Your Group Member's ML

| Group Member | Your System |
|-------------|-------------|
| Tracks all interactions | **Tracks problem patterns** |
| Learns preferences proactively | **Fixes issues reactively** |
| General behavior → personalization | **Anomaly detection → intervention** |
| Continuous learning | **Bounded search** |

---

## Core Concepts

### 1. Setting Ladders

Every tunable setting has discrete ordered values:

```javascript
// Font Size Ladder
['small', 'medium', 'large', 'xlarge']
  ↓        ↓        ↓        ↓
 14px     16px     18px     20px

// Target Size Ladder  
['small', 'medium', 'large', 'xlarge']
  ↓        ↓        ↓        ↓
 40px     44px     48px     52px
```

### 2. Trial Record

When a change is applied:

```javascript
{
  trialId: "uuid",
  userId: "guest",
  settingKey: "visual.fontSize",
  oldValue: "medium",  // 16px
  newValue: "large",   // 18px
  status: "active",
  startTime: timestamp,
  metrics: {
    clickCount: 0,
    misclickCount: 0,
    rageClickCount: 0,
    avgTimeToClick: 0
  }
}
```

### 3. Preference State

Per user + setting:

```javascript
{
  userId: "guest",
  settingKey: "visual.fontSize",
  currentValue: "large",
  currentIndex: 2,
  preferredValue: null,  // Set when user confirms
  locked: false,         // True = don't change anymore
  trialCount: 1,
  cooldownUntil: null,
  dismissCount: 0
}
```

### 4. Anomaly Scoring

Detects if trial is causing problems:

```javascript
anomalyScore = 
  misclickRate * 0.30 +
  rageClicks * 0.25 +
  timeToClick * 0.20 +
  formErrors * 0.15 +
  zoomEvents * 0.10

// Decision tree:
// < 0.3 = Accept silently ✅
// 0.3-0.7 = Check if should prompt 🤔
// > 0.7 = Revert silently ❌
```

---

## Full System Flow

### Step 1: ML Suggests Change

```javascript
// ML engine suggests: fontSize = large
POST /api/trials/propose
{
  userId: "guest",
  mlSuggestedProfile: {
    "visual.fontSize": "large",
    "motor.targetSize": "large"
  }
}

Response:
{
  hasTrial: true,
  proposal: {
    settingKey: "visual.fontSize",
    oldValue: "medium",
    newValue: "large",
    attemptNumber: 1
  }
}
```

### Step 2: Start Trial

```javascript
POST /api/trials/start
{
  userId: "guest",
  sessionId: "abc123",
  settingKey: "visual.fontSize",
  oldValue: "medium",
  newValue: "large"
}

Response:
{
  trialId: "trial-uuid",
  evaluationWindow: 60000,  // 60 seconds
  minClicks: 5
}
```

**NPM Package** applies the change silently.

### Step 3: Collect Metrics (Passive)

During 60-second evaluation window:
- Track clicks, misclicks, rage clicks
- Measure time-to-click
- Count form errors, zoom events
- Compare to baseline

**No prompts yet** - just monitoring.

### Step 4: Evaluate Trial

```javascript
POST /api/trials/evaluate
{
  trialId: "trial-uuid",
  metrics: {
    clickCount: 8,
    misclickCount: 3,  // High!
    rageClickCount: 1,
    avgTimeToClick: 1500,
    formErrorCount: 0,
    zoomEventCount: 0
  }
}

Response:
{
  decision: "prompt",      // Could be: accept, revert, prompt
  anomalyScore: 0.45,
  shouldPrompt: true
}
```

### Step 5: Show Directional Feedback (Only if Prompted)

```tsx
<DirectionalFeedbackPrompt
  trialId="trial-uuid"
  settingName="Font Size"
  oldValue="medium"
  newValue="large"
  onFeedback={handleFeedback}
/>
```

User sees:
```
┌─────────────────────────────────────┐
│ 💡 We adjusted your settings        │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ Font Size: medium → large       │ │
│ │ How does this feel?             │ │
│ └─────────────────────────────────┘ │
│                                      │
│ Is this change working for you?      │
│                                      │
│ [👍 Yes, keep it]                   │
│ [⬇️ Too large / Too much]           │
│ [⬆️ Too small / Not enough]         │
│ [Not sure / Don't ask again]        │
└─────────────────────────────────────┘
```

### Step 6: Process Feedback

**User clicks "⬇️ Too large":**

```javascript
POST /api/trials/feedback
{
  trialId: "trial-uuid",
  feedbackType: "dislike",
  reason: "too_big"
}

Response:
{
  locked: false,
  nextSuggestion: {
    settingKey: "visual.fontSize",
    value: "medium",  // One step down
    attemptNumber: 2
  },
  message: "Will try medium next"
}
```

System immediately:
1. Reverts to "medium"
2. Sets cooldown: 10 minutes
3. Prepares next trial if user revisits

**User clicks "👍 Yes, keep it":**

```javascript
Response:
{
  locked: true,
  message: "Preference locked at large"
}
```

System:
1. Locks fontSize at "large" **forever**
2. ML suggestions ignored for this setting
3. No more trials for fontSize

---

## Cooldown System

Prevents annoying the user:

```javascript
const COOLDOWNS = {
  minPromptInterval: 10 * 60 * 1000,      // 10 min between ANY prompts
  perSettingCooldown: 24 * 60 * 60 * 1000, // 24 hours after dismiss
  maxPromptsPerSession: 1,                  // Only 1 prompt per session
  maxRetriesPerSetting: 2,                  // Max 2 retries to find preference
};
```

**Example:**
```
Trial 1: medium → large (PROMPTED, user said "too big")
  ↓ 10 minutes cooldown
Trial 2: large → medium (Accept silently, no prompt)
  ↓ Confirmed
LOCKED at medium ✅

Total prompts: 1
Total time: 10 minutes + evaluation windows
```

---

## API Reference

### POST /api/trials/propose
Get next trial proposal based on ML and user state.

**Request:**
```json
{
  "userId": "guest",
  "sessionId": "abc123",
  "mlSuggestedProfile": {
    "visual.fontSize": "large",
    "motor.targetSize": "large"
  },
  "context": {
    "pageType": "checkout",
    "deviceType": "mobile"
  }
}
```

**Response:**
```json
{
  "success": true,
  "hasTrial": true,
  "proposal": {
    "settingKey": "visual.fontSize",
    "oldValue": "medium",
    "newValue": "large",
    "ladder": ["small", "medium", "large", "xlarge"],
    "attemptNumber": 1
  }
}
```

### POST /api/trials/start
Start a new trial.

**Request:**
```json
{
  "userId": "guest",
  "sessionId": "abc123",
  "settingKey": "visual.fontSize",
  "oldValue": "medium",
  "newValue": "large",
  "context": { "pageType": "checkout" }
}
```

**Response:**
```json
{
  "success": true,
  "trialId": "uuid",
  "evaluationWindow": 60000,
  "minClicks": 5
}
```

### POST /api/trials/evaluate
Evaluate trial with passive metrics.

**Request:**
```json
{
  "trialId": "uuid",
  "metrics": {
    "clickCount": 8,
    "misclickCount": 2,
    "rageClickCount": 0,
    "avgTimeToClick": 1200,
    "formErrorCount": 1,
    "zoomEventCount": 0
  }
}
```

**Response:**
```json
{
  "success": true,
  "decision": "prompt",
  "anomalyScore": 0.45,
  "shouldPrompt": true,
  "revertTo": null
}
```

### POST /api/trials/feedback
Record explicit feedback from user.

**Request:**
```json
{
  "trialId": "uuid",
  "feedbackType": "dislike",
  "reason": "too_big"
}
```

**Response:**
```json
{
  "success": true,
  "locked": false,
  "nextSuggestion": {
    "settingKey": "visual.fontSize",
    "value": "medium",
    "attemptNumber": 2
  },
  "message": "Will try medium next"
}
```

### GET /api/trials/preferences/:userId
Get all preference states for a user.

**Response:**
```json
{
  "success": true,
  "preferences": [
    {
      "settingKey": "visual.fontSize",
      "currentValue": "large",
      "locked": true,
      "preferredValue": "large",
      "trialCount": 2,
      "successfulTrials": 1,
      "failedTrials": 1
    }
  ],
  "recentTrials": [...],
  "summary": {
    "locked": 1,
    "active": 2,
    "cooldown": 0
  }
}
```

---

## NPM Package Integration

### Using DirectionalFeedbackPrompt

```tsx
import { DirectionalFeedbackPrompt } from '@aura/aura-adaptor';

function App() {
  const [activeTrial, setActiveTrial] = useState(null);

  const handleFeedback = async (feedback) => {
    await fetch(`${API}/trials/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trialId: activeTrial.trialId,
        feedbackType: feedback.type,
        reason: feedback.reason
      })
    });

    setActiveTrial(null); // Hide prompt
  };

  return (
    <>
      {activeTrial && (
        <DirectionalFeedbackPrompt
          trialId={activeTrial.trialId}
          settingName={activeTrial.settingName}
          oldValue={activeTrial.oldValue}
          newValue={activeTrial.newValue}
          onFeedback={handleFeedback}
          position="bottom-right"
        />
      )}
      
      {/* Your app */}
    </>
  );
}
```

---

## Testing

### 1. Start Services

```bash
# Backend
cd C:\Users\TUF\Desktop\research\Optimization-Engine
npm run dev

# Thompson Sampling (still used for suggestions)
cd python_rl_service
python personalization_service.py
```

### 2. Test Trial Flow

```bash
# Propose a trial
curl -X POST http://localhost:5000/api/trials/propose \
  -H "Content-Type: application/json" \
  -d '{"userId":"guest","mlSuggestedProfile":{"visual.fontSize":"large"}}'

# Start trial
curl -X POST http://localhost:5000/api/trials/start \
  -H "Content-Type: application/json" \
  -d '{"userId":"guest","sessionId":"test","settingKey":"visual.fontSize","oldValue":"medium","newValue":"large"}'

# Evaluate (with high anomaly)
curl -X POST http://localhost:5000/api/trials/evaluate \
  -H "Content-Type: application/json" \
  -d '{"trialId":"<trialId>","metrics":{"clickCount":10,"misclickCount":5,"rageClickCount":2}}'

# Send feedback
curl -X POST http://localhost:5000/api/trials/feedback \
  -H "Content-Type: application/json" \
  -d '{"trialId":"<trialId>","feedbackType":"dislike","reason":"too_big"}'
```

### 3. Check Preferences

```bash
curl http://localhost:5000/api/trials/preferences/guest
```

---

## Key Differences Summary

### Doesn't Duplicate ML Engine
- **ML engine** suggests values
- **Your system** tests them safely and finds user's preference
- **Complementary**, not duplicate

### Doesn't Ask Rapidly
- Only prompts if anomaly detected
- 10-minute cooldown between prompts
- Max 1 prompt per session
- Max 2 retries per setting
- 24-hour cooldown after dismiss

### Finds Preferred Value Fast
- Directional feedback (too big/small) guides search
- Bounded search (max 2 retries)
- Locks preference once found
- Typical convergence: 1-3 trials vs 10+ with binary feedback

---

## Production Checklist

✅ Setting ladders configured  
✅ MongoDB schemas created (Trial, PreferenceState)  
✅ Backend APIs implemented (/api/trials/*)  
✅ Anomaly scoring algorithm  
✅ Smart cooldown system  
✅ DirectionalFeedbackPrompt component  
✅ Preference locking  
✅ Bounded search algorithm  

**Ready to integrate and test!** 🚀

---

## Files Created

- `backend/config/ladders.js` - Setting definitions and helpers
- `backend/mongodb/schemas.js` - Trial and PreferenceState schemas
- `backend/routes/trials.js` - Trial management API
- `NPM-Package/src/components/DirectionalFeedbackPrompt.tsx` - Feedback UI
- `backend/api.js` - Mounted trials route

**Next Step**: Integrate into NovaCart and test the full flow!
