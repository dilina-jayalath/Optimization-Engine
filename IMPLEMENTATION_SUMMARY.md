# Trial-Based System - Implementation Complete ✅

## What We Built

A **complete replacement** for the Thompson Sampling system that:
- Avoids duplicating your group member's ML personalization engine
- Tests changes safely in "trial mode" (one at a time)
- Only prompts when anomalies detected (not time-based)
- Uses directional feedback (too big/small) for fast convergence
- Locks preferences after confirmation (no more changes)
- Implements smart cooldowns (10 min global, 24hr dismiss, max 1/session, max 2 retries)

## Files Created

### Backend

**[backend/config/ladders.js](backend/config/ladders.js)** (180 lines)
- Setting ladder definitions (fontSize, lineHeight, targetSize, contrast, spacing, theme)
- Discrete values: small/medium/large/xlarge with numeric mappings
- Trial priorities array
- Anomaly weights configuration
- Cooldown configuration
- Helper functions: getLadder, getMappedValue, getNextValue, isAtBoundary

**[backend/mongodb/schemas.js](backend/mongodb/schemas.js)** (UPDATED)
- Added `trialSchema` (17 fields): Tracks trial lifecycle, metrics, anomaly score, feedback
- Added `preferenceStateSchema` (15 fields): Per-user setting state, locks, cooldowns
- Indexes: userId+settingKey compound, userId+createdAt, sessionId, status

**[backend/routes/trials.js](backend/routes/trials.js)** (450+ lines)
- **POST /api/trials/propose**: Get next trial based on ML + user state
- **POST /api/trials/start**: Create trial record, update preference state
- **POST /api/trials/evaluate**: Calculate anomaly score, decide accept/revert/prompt
- **POST /api/trials/feedback**: Record directional feedback, bounded search
- **GET /api/trials/preferences/:userId**: Get all preference states + recent trials
- `calculateAnomalyScore()`: Weighted sum of behavior deltas
- `checkPromptCooldowns()`: Multi-layer cooldown validation

**[backend/api.js](backend/api.js)** (UPDATED)
- Mounted trialsRouter at `/api/trials`

### Frontend (NPM Package)

**[NPM-Package/src/components/DirectionalFeedbackPrompt.tsx](NPM-Package/src/components/DirectionalFeedbackPrompt.tsx)** (250 lines)
- Smart feedback prompt component
- 4 options: Keep it / Too big / Too small / Dismiss
- Shows change details: "fontSize: medium → large"
- Props: trialId, settingName, oldValue, newValue, onFeedback, autoDismiss, position
- Visual: White card, positioned fixed, shadow

**[NPM-Package/src/index.tsx](NPM-Package/src/index.tsx)** (UPDATED)
- Exported DirectionalFeedbackPrompt

**NPM Package Built**: ✅ dist/index.js, dist/index.esm.js

### Documentation

**[TRIAL_BASED_SYSTEM.md](TRIAL_BASED_SYSTEM.md)**
- Complete guide with examples
- API documentation
- Flow diagrams
- Comparison tables
- Testing instructions

**[test-trial-system.js](test-trial-system.js)**
- End-to-end test script
- Tests all 5 API endpoints
- Example usage

## How to Test

### 1. Install Dependencies

```bash
cd C:\Users\TUF\Desktop\research\Optimization-Engine
npm install uuid  # ✅ Already installed
```

### 2. Start Backend

```bash
npm run dev
```

### 3. Run Test Script

```bash
# In another terminal
node test-trial-system.js
```

Expected output:
```
🧪 Testing Trial-Based System

1️⃣  Testing /propose endpoint...
✅ Propose response: { hasTrial: true, proposal: {...} }

2️⃣  Testing /start endpoint...
✅ Start response: { trialId: "...", evaluationWindow: 60000 }

3️⃣  Testing /evaluate endpoint (HIGH anomaly)...
✅ Evaluate response: { decision: "prompt", anomalyScore: 0.65, shouldPrompt: true }

4️⃣  Testing /feedback endpoint (too_big)...
✅ Feedback response: { locked: false, nextSuggestion: {...} }

5️⃣  Testing /preferences endpoint...
✅ Preferences response: { preferences: [...], summary: {...} }

✅ All tests passed!
```

### 4. Test with cURL

```bash
# Propose a trial
curl -X POST http://localhost:5000/api/trials/propose \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"guest\",\"mlSuggestedProfile\":{\"visual.fontSize\":\"large\"}}"

# Start trial
curl -X POST http://localhost:5000/api/trials/start \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"guest\",\"sessionId\":\"abc\",\"settingKey\":\"visual.fontSize\",\"oldValue\":\"medium\",\"newValue\":\"large\"}"

# Evaluate (with high anomaly)
curl -X POST http://localhost:5000/api/trials/evaluate \
  -H "Content-Type: application/json" \
  -d "{\"trialId\":\"<trialId>\",\"metrics\":{\"clickCount\":10,\"misclickCount\":5,\"rageClickCount\":2}}"

# Send feedback
curl -X POST http://localhost:5000/api/trials/feedback \
  -H "Content-Type: application/json" \
  -d "{\"trialId\":\"<trialId>\",\"feedbackType\":\"dislike\",\"reason\":\"too_big\"}"

# Get preferences
curl http://localhost:5000/api/trials/preferences/guest
```

## Next Steps (Phase 2)

### 1. Create useTrialManager Hook

In `NPM-Package/src/hooks/useTrialManager.ts`:

```typescript
export function useTrialManager(userId: string, apiEndpoint: string) {
  const [activeTrial, setActiveTrial] = useState(null);
  
  // Orchestrates full trial lifecycle:
  // 1. Call /propose to get ML suggestions
  // 2. Call /start when applying change
  // 3. Collect metrics during evaluation window
  // 4. Call /evaluate with metrics
  // 5. Show DirectionalFeedbackPrompt if shouldPrompt=true
  // 6. Call /feedback with user response
  // 7. Apply next suggestion if bounded search continues
  
  return {
    activeTrial,
    startTrial,
    evaluateTrial,
    submitFeedback
  };
}
```

### 2. Integrate with AdaptiveProvider

Add mode prop:

```typescript
<AdaptiveProvider
  mode="trial-based"  // or "thompson-sampling"
  apiEndpoint="http://localhost:5000/api"
>
```

### 3. Update BehaviorTracker

Add anomaly metrics:
- Misclick detection (click → no interaction within 500ms)
- Rage click detection (3+ clicks in same area within 1s)
- Zoom events (ctrl+scroll, pinch)

### 4. Test in NovaCart

Full integration test with real UI components.

## Key Differences vs Thompson Sampling

| Feature | Thompson Sampling | Trial-Based |
|---------|------------------|-------------|
| **Learning approach** | Continuous exploration | One-at-a-time trials |
| **Prompt trigger** | Time-based (30s) | Anomaly-driven |
| **Feedback type** | Binary (👍/👎) | Directional (⬆️/⬇️/other) |
| **Exploration limit** | Infinite | Max 2 retries |
| **Stability** | Settings keep changing | Locks after confirmation |
| **Cooldowns** | None | Multi-layer (10min/24hr/session/retry) |
| **Convergence** | 50-200 episodes | 1-3 trials typical |

## Why This Doesn't Duplicate ML Engine

Your group member's system:
- Tracks ALL interactions → learns general preferences
- Proactive personalization
- Continuous learning

Your new system:
- Tracks PROBLEM patterns → detects when something is wrong
- Reactive intervention (only when issues detected)
- Bounded search (tests → finds preference → locks)

**Complementary, not duplicate!** 🎯

## Status

✅ Phase 1 Complete (Core Infrastructure)
- Backend APIs (5 endpoints)
- Database schemas
- Anomaly scoring
- Cooldown management
- Bounded search logic
- Directional feedback component
- Documentation

⏳ Phase 2 Pending (Integration)
- useTrialManager hook
- AdaptiveProvider mode support
- BehaviorTracker metrics

⏳ Phase 3 Pending (Demo)
- NovaCart integration
- End-to-end testing

## Questions?

See [TRIAL_BASED_SYSTEM.md](TRIAL_BASED_SYSTEM.md) for:
- Complete flow diagrams
- API reference
- Integration examples
- Testing guide

---

**Ready to start Phase 2!** 🚀
