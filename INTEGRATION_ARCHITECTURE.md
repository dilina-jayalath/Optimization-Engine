# Integration Architecture Diagram

## How Trial System Connects to Your Projects

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     YOUR REACT PROJECTS                                 │
│                (NovaCart, Test App, Any React App)                      │
│                                                                         │
│  import { AdaptiveProvider } from '@aura/aura-adaptor';                 │
│                                                                         │
│  <AdaptiveProvider                                                      │
│    mode="trial-based"  ← ONE LINE CHANGE!                              │
│    userId="user123"                                                     │
│    apiEndpoint="http://localhost:5000/api"                              │
│  >                                                                      │
│    <YourApp />                                                          │
│  </AdaptiveProvider>                                                    │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     │ Uses
                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    NPM PACKAGE (@aura/aura-adaptor)                     │
│             Location: c:\Users\TUF\Desktop\research\NPM-Package         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ AdaptiveProvider.tsx                                            │   │
│  │                                                                 │   │
│  │  ✅ EXISTS: Basic provider with profile loading                │   │
│  │  ⚠️ NEEDS: mode prop + trial integration                       │   │
│  │                                                                 │   │
│  │  export function AdaptiveProvider({ mode, ... }) {             │   │
│  │    const { activeTrial, trialSettings, showPrompt } =          │   │
│  │      useTrialManager(userId, apiEndpoint, mode);  ← NEED THIS  │   │
│  │                                                                 │   │
│  │    return (                                                     │   │
│  │      <Context.Provider value={...}>                             │   │
│  │        {children}                                               │   │
│  │        {showPrompt && <DirectionalFeedbackPrompt />}            │   │
│  │      </Context.Provider>                                        │   │
│  │    );                                                           │   │
│  │  }                                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ Uses                                │
│                                    ↓                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ hooks/useTrialManager.ts  ⚠️ NEEDS TO BE CREATED                │   │
│  │                                                                 │   │
│  │  Orchestrates trial lifecycle:                                  │   │
│  │  1. Call POST /api/trials/propose                               │   │
│  │  2. Call POST /api/trials/start                                 │   │
│  │  3. Collect metrics (60s)                                       │   │
│  │  4. Call POST /api/trials/evaluate                              │   │
│  │  5. Show prompt if needed                                       │   │
│  │  6. Call POST /api/trials/feedback                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ Uses                                │
│                                    ↓                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ BehaviorTracker.ts                                              │   │
│  │                                                                 │   │
│  │  ✅ EXISTS: Basic click tracking                                │   │
│  │  ⚠️ NEEDS: Anomaly metrics (misclick, rage, zoom)              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ Uses                                │
│                                    ↓                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ components/DirectionalFeedbackPrompt.tsx  ✅ EXISTS!            │   │
│  │                                                                 │   │
│  │  [👍 Keep it] [⬇️ Too big] [⬆️ Too small] [⚙️ Dismiss]        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     │ HTTP Requests
                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND API SERVER                                   │
│             Location: c:\Users\TUF\Desktop\research\                    │
│                      Optimization-Engine/backend                        │
│                    Running: http://localhost:5000                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ routes/trials.js  ✅ COMPLETE!                                  │   │
│  │                                                                 │   │
│  │  POST /api/trials/propose                                       │   │
│  │  POST /api/trials/start                                         │   │
│  │  POST /api/trials/evaluate                                      │   │
│  │  POST /api/trials/feedback                                      │   │
│  │  GET  /api/trials/preferences/:userId                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ Uses                                │
│                                    ↓                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ config/ladders.js  ✅ COMPLETE!                                 │   │
│  │                                                                 │   │
│  │  Setting ladders, weights, cooldowns                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ Reads/Writes                        │
│                                    ↓                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ mongodb/schemas.js  ✅ COMPLETE!                                │   │
│  │                                                                 │   │
│  │  Trial model, PreferenceState model                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     │ Stores Data
                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       MONGODB DATABASE                                  │
│                                                                         │
│  Collections:                                                           │
│  - trials (trial records with metrics)                                  │
│  - preferencestates (user preference states)                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Example: User Opens Your App

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Your App Renders                                               │
└─────────────────────────────────────────────────────────────────────────┘

    Your React App (NovaCart)
         │
         │ <AdaptiveProvider mode="trial-based" userId="user123">
         ↓
    AdaptiveProvider.tsx
         │
         │ useEffect(() => { ... }, [])
         ↓
    useTrialManager Hook
         │
         │ proposeTrial()
         ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Request Trial Proposal                                         │
└─────────────────────────────────────────────────────────────────────────┘

    useTrialManager.ts
         │
         │ POST http://localhost:5000/api/trials/propose
         │ {
         │   userId: "user123",
         │   mlSuggestedProfile: {
         │     "visual.fontSize": "large"
         │   }
         │ }
         ↓
    Backend: routes/trials.js
         │
         │ 1. Check if user has locked preferences (query MongoDB)
         │ 2. Check cooldowns
         │ 3. Iterate TRIAL_PRIORITIES
         │ 4. Find first setting where ML ≠ current
         ↓
    Response:
         {
           hasTrial: true,
           proposal: {
             settingKey: "visual.fontSize",
             oldValue: "medium",
             newValue: "large"
           }
         }
         ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Start Trial                                                    │
└─────────────────────────────────────────────────────────────────────────┘

    useTrialManager.ts
         │
         │ POST http://localhost:5000/api/trials/start
         │ {
         │   settingKey: "visual.fontSize",
         │   oldValue: "medium",
         │   newValue: "large"
         │ }
         ↓
    Backend: routes/trials.js
         │
         │ 1. Create Trial record (status: "active")
         │ 2. Update PreferenceState (currentValue: "large")
         │ 3. Save to MongoDB
         ↓
    Response:
         {
           trialId: "uuid-123",
           evaluationWindow: 60000
         }
         ↓
    useTrialManager.ts
         │
         │ 1. Update state: trialSettings = { fontSize: "18px" }
         │ 2. Start 60s timer
         │ 3. Start collecting metrics
         ↓
    AdaptiveProvider.tsx
         │
         │ effectiveSettings = { ...profile, fontSize: "18px" }
         ↓
    Your React Components
         │
         │ <AdaptiveText> uses fontSize="18px" ← USER SEES BIGGER TEXT!
         │

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: User Interacts (0:00 - 1:00)                                   │
└─────────────────────────────────────────────────────────────────────────┘

    User clicks buttons, scrolls, interacts
         │
         ↓
    BehaviorTracker.ts
         │
         │ On every click:
         │   - trackClick()
         │   - Check if misclick (no interaction after 500ms)
         │   - Check if rage click (3+ clicks in 1s)
         │   - Measure time-to-click
         │
         │ Metrics accumulated:
         │   clickCount: 10
         │   misclickCount: 4
         │   rageClickCount: 1
         │   avgTimeToClick: 1500ms
         ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Evaluate After 60 Seconds                                      │
└─────────────────────────────────────────────────────────────────────────┘

    useTrialManager.ts
         │
         │ Timer fires after 60s
         │
         │ POST http://localhost:5000/api/trials/evaluate
         │ {
         │   trialId: "uuid-123",
         │   metrics: {
         │     clickCount: 10,
         │     misclickCount: 4,
         │     rageClickCount: 1,
         │     avgTimeToClick: 1500
         │   }
         │ }
         ↓
    Backend: routes/trials.js
         │
         │ calculateAnomalyScore(metrics):
         │   score = (4/10)*0.3 + (1)*0.25 + ... = 0.58
         │
         │ Decision logic:
         │   0.3 < 0.58 < 0.7 → Check if should prompt
         │   
         │ checkPromptCooldowns():
         │   ✓ No prompts in last 10 min
         │   ✓ Not dismissed
         │   ✓ Not max retries
         │   ✓ anomalyScore > 0.5
         │   → SHOULD PROMPT!
         ↓
    Response:
         {
           decision: "prompt",
           anomalyScore: 0.58,
           shouldPrompt: true
         }
         ↓

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Show Feedback Prompt                                           │
└─────────────────────────────────────────────────────────────────────────┘

    useTrialManager.ts
         │
         │ setState({ showPrompt: true })
         ↓
    AdaptiveProvider.tsx
         │
         │ {showPrompt && (
         │   <DirectionalFeedbackPrompt
         │     trialId="uuid-123"
         │     settingName="Font Size"
         │     oldValue="medium"
         │     newValue="large"
         │     onFeedback={handleFeedback}
         │   />
         │ )}
         ↓
    USER SEES:
         ┌─────────────────────────────────────┐
         │ 💡 We adjusted your settings   [×] │
         │ Font Size: medium → large          │
         │                                     │
         │ [ 👍 Keep it ]                     │
         │ [ ⬇️ Too large ]                   │
         │ [ ⬆️ Too small ]                   │
         │ [ ⚙️ Dismiss ]                     │
         └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 7: User Clicks "⬇️ Too large"                                     │
└─────────────────────────────────────────────────────────────────────────┘

    DirectionalFeedbackPrompt.tsx
         │
         │ onFeedback({ type: "dislike", reason: "too_big" })
         ↓
    useTrialManager.ts
         │
         │ POST http://localhost:5000/api/trials/feedback
         │ {
         │   trialId: "uuid-123",
         │   feedbackType: "dislike",
         │   reason: "too_big"
         │ }
         ↓
    Backend: routes/trials.js
         │
         │ Bounded search:
         │   Current: large (index 2)
         │   Direction: too_big → Move DOWN
         │   Next: medium (index 1)
         │
         │ Update PreferenceState:
         │   currentValue: "medium"
         │   trialCount: 1
         │   failedTrials: 1
         │   cooldownUntil: now + 10 minutes
         ↓
    Response:
         {
           locked: false,
           nextSuggestion: {
             settingKey: "visual.fontSize",
             value: "medium"
           }
         }
         ↓
    useTrialManager.ts
         │
         │ 1. Update trialSettings: { fontSize: "16px" }
         │ 2. Hide prompt: setState({ showPrompt: false })
         │ 3. Set 10-minute cooldown
         ↓
    USER SEES:
         - Font size changes back to 16px (medium)
         - Prompt disappears
         - No more prompts for 10 minutes
```

---

## Summary

### ✅ Backend (Complete)
All API endpoints working, tested, ready to use

### ⚠️ NPM Package (Needs Phase 2)
- Need `useTrialManager` hook (~200 lines)
- Need `AdaptiveProvider` updates (~50 lines)
- Need `BehaviorTracker` enhancements (~100 lines)

### 🚀 Your Projects (Ready After Phase 2)
Just change one line:
```tsx
<AdaptiveProvider mode="trial-based" ... />
```

**Total Phase 2 work: ~3-4 hours, then works everywhere!**
