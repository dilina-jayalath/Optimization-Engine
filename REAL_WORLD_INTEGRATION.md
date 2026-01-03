# 🌍 Real-World Integration Guide: Trial-Based System

## Current State

### ✅ What's Complete (Phase 1)

**Backend APIs** - Running at http://localhost:5000
- POST `/api/trials/propose` - Get trial suggestions
- POST `/api/trials/start` - Start trial
- POST `/api/trials/evaluate` - Calculate anomaly score
- POST `/api/trials/feedback` - Process user feedback
- GET `/api/trials/preferences/:userId` - Get preference states

**Frontend Component** - In NPM Package
- `DirectionalFeedbackPrompt` - Feedback UI with 4 options

### ⚠️ What's Missing (Phase 2 - Needed for Your Projects)

**Integration Hook** - Not yet created
- `useTrialManager` - Orchestrates the full trial lifecycle

**Provider Integration** - Not yet updated
- `AdaptiveProvider` needs `mode="trial-based"` support

**Behavior Tracking** - Not yet enhanced
- Need misclick detection, rage clicks, zoom events

---

## How It Will Work in Your Projects

### Current Setup (What You Have Now)

Your existing projects probably look like this:

```tsx
// Your current React app (NovaCart, test app, etc.)
import { AdaptiveProvider, AdaptiveButton, AdaptiveText } from '@aura/aura-adaptor';

function App() {
  return (
    <AdaptiveProvider
      userId="user123"
      apiEndpoint="http://localhost:5000/api"
      enableBehaviorTracking={true}
    >
      <AdaptiveButton>Click Me</AdaptiveButton>
      <AdaptiveText>Hello World</AdaptiveText>
    </AdaptiveProvider>
  );
}
```

**Current Behavior:**
- Components use `category-wise.json` or user-specific profile
- No trial system
- No feedback prompts
- Static personalization

---

## Future Setup (After Phase 2)

### Step 1: Update NPM Package (Need to Build This)

```tsx
// NPM-Package/src/AdaptiveProvider.tsx (WILL UPDATE)
export function AdaptiveProvider({
  children,
  userId,
  apiEndpoint,
  mode = "standard", // NEW: "standard" | "trial-based"
  enableBehaviorTracking = true,
}: AdaptiveProviderProps) {
  
  // NEW: Trial manager hook
  const {
    activeTrial,
    trialSettings,
    showPrompt,
    handleFeedback,
  } = useTrialManager(userId, apiEndpoint, mode);

  // Apply trial settings OR standard profile
  const effectiveSettings = mode === "trial-based" 
    ? { ...profile, ...trialSettings }  // Override with trial values
    : profile;

  return (
    <AdaptiveContext.Provider value={{ settings: effectiveSettings, ... }}>
      {children}
      
      {/* NEW: Show feedback prompt when needed */}
      {showPrompt && activeTrial && (
        <DirectionalFeedbackPrompt
          trialId={activeTrial.trialId}
          settingName={activeTrial.settingName}
          oldValue={activeTrial.oldValue}
          newValue={activeTrial.newValue}
          onFeedback={handleFeedback}
          position="bottom-right"
        />
      )}
    </AdaptiveContext.Provider>
  );
}
```

### Step 2: Your Projects - Enable Trial Mode

```tsx
// Your React app (ONE LINE CHANGE!)
import { AdaptiveProvider, AdaptiveButton, AdaptiveText } from '@aura/aura-adaptor';

function App() {
  return (
    <AdaptiveProvider
      userId="user123"
      apiEndpoint="http://localhost:5000/api"
      mode="trial-based"  // ← ADD THIS LINE!
      enableBehaviorTracking={true}
    >
      <AdaptiveButton>Click Me</AdaptiveButton>
      <AdaptiveText>Hello World</AdaptiveText>
    </AdaptiveProvider>
  );
}
```

**That's it!** Your app now uses trial-based system.

---

## Real-World User Experience Flow

### Scenario: User Opens Your E-Commerce App

#### **Timeline: 0:00 - User Lands on Checkout Page**

```
User opens checkout page
└─ AdaptiveProvider initializes
   └─ Calls POST /api/trials/propose
      Request: {
        userId: "user123",
        sessionId: "abc-session",
        mlSuggestedProfile: {
          "visual.fontSize": "large",     ← From ML engine
          "motor.targetSize": "large"
        },
        context: {
          pageType: "checkout",
          deviceType: "mobile"
        }
      }
      
      Response: {
        hasTrial: true,
        proposal: {
          settingKey: "visual.fontSize",   ← System picks ONE setting
          oldValue: "medium",              ← Current value
          newValue: "large",               ← ML suggested value
          attemptNumber: 1
        }
      }
```

#### **Timeline: 0:01 - Trial Starts (SILENT)**

```
useTrialManager hook receives proposal
└─ Calls POST /api/trials/start
   Response: {
     trialId: "uuid-123",
     evaluationWindow: 60000  ← Monitor for 60 seconds
   }
   
└─ Applies change SILENTLY
   fontSize: 16px → 18px (medium → large)

USER SEES: 
  Text is now slightly bigger
  NO PROMPT YET - just monitoring
```

#### **Timeline: 0:01 - 1:01 - Passive Monitoring (60 seconds)**

```
BehaviorTracker collects metrics:
  ✓ User clicks "Checkout" button
  ✗ Misclick on "Back" button (too close?)
  ✓ Clicks payment method
  ✗ Misclick on CVV field
  ✗ Rage clicks on submit button (3 clicks rapidly)
  
Metrics collected:
  clickCount: 8
  misclickCount: 3         ← 37.5% misclick rate!
  rageClickCount: 1        ← User frustrated!
  avgTimeToClick: 1400ms
  formErrorCount: 0
  zoomEventCount: 0
```

#### **Timeline: 1:01 - Evaluation**

```
useTrialManager calls POST /api/trials/evaluate
  Request: {
    trialId: "uuid-123",
    metrics: {
      clickCount: 8,
      misclickCount: 3,
      rageClickCount: 1,
      avgTimeToClick: 1400
    }
  }
  
Backend calculates:
  anomalyScore = 
    (3/8 = 0.375) * 0.30 +    ← Misclick rate
    (1) * 0.25 +               ← Rage clicks
    (normalized) * 0.20 +      ← Time
    (0) * 0.15 +               ← Form errors
    (0) * 0.10                 ← Zoom
  = 0.1125 + 0.25 + 0.04 + 0 + 0
  = 0.4025
  
Decision:
  0.3 < 0.4025 < 0.7 → Check if should prompt
  
Cooldowns OK? YES ✓
Past negative feedback? NO
anomalyScore > 0.5? NO (0.4025)
negativeCountInContext≥1? NO

Decision: ACCEPT SILENTLY ✓

Response: {
  decision: "accept",
  shouldPrompt: false  ← No prompt shown!
}
```

**USER SEES: Nothing! Change accepted silently, stays at 18px**

---

### Scenario 2: HIGH Anomaly (User Gets Prompted)

Let's say the fontSize change caused MORE problems:

#### **Timeline: 1:01 - High Anomaly Detected**

```
Metrics collected:
  clickCount: 10
  misclickCount: 6         ← 60% misclick rate! Very high!
  rageClickCount: 2        ← User very frustrated
  avgTimeToClick: 2000ms   ← Much slower
  formErrorCount: 1
  zoomEventCount: 0

Backend calculates:
  anomalyScore = 
    (6/10) * 0.30 +    ← 0.18
    (2) * 0.25 +       ← 0.50
    (high) * 0.20 +    ← 0.10
    (1) * 0.15 +       ← 0.15
    (0) * 0.10         ← 0
  = 0.93  ← VERY HIGH!
  
Decision:
  anomalyScore > 0.7 → REVERT SILENTLY!
  
Response: {
  decision: "revert",
  shouldPrompt: false,
  revertTo: "medium"
}
```

**USER SEES:**
- Font size reverts back to 16px (medium)
- No prompt shown
- System quietly undid the problematic change

---

### Scenario 3: Medium Anomaly (User Gets Prompted)

#### **Timeline: 1:01 - Medium Anomaly + Prompt Conditions Met**

```
Metrics:
  clickCount: 10
  misclickCount: 4         ← 40% misclick rate
  rageClickCount: 1
  avgTimeToClick: 1500ms
  formErrorCount: 1
  zoomEventCount: 0

anomalyScore = 0.58  ← Medium range

Decision:
  0.3 < 0.58 < 0.7 → Check if should prompt
  
Checks:
  ✓ Cooldown OK (no prompts in last 10 min)
  ✓ Not dismissed recently
  ✓ Not max retries
  ✓ anomalyScore > 0.5
  
Response: {
  decision: "prompt",
  shouldPrompt: true  ← SHOW PROMPT!
}
```

#### **Timeline: 1:01 - User Sees Feedback Prompt**

```
USER SEES (bottom-right corner):

┌─────────────────────────────────────┐
│ 💡 We adjusted your settings   [×] │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Font Size: medium → large      │ │
│ │ How does this feel?            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Is this change working for you?     │
│                                     │
│ [ 👍 Yes, keep it ]                │
│ [ ⬇️ Too large / Too much ]        │
│ [ ⬆️ Too small / Not enough ]      │
│ [ Not sure / Don't ask again ]     │
└─────────────────────────────────────┘
```

#### **Timeline: 1:02 - User Clicks "⬇️ Too large"**

```
useTrialManager calls POST /api/trials/feedback
  Request: {
    trialId: "uuid-123",
    feedbackType: "dislike",
    reason: "too_big"
  }
  
Backend bounded search:
  Current ladder: [small, medium, LARGE, xlarge]
                              ↑ currently here
  
  Feedback: "too_big" → Move DOWN ⬇
  
  Next value: medium (one step down)
  
  Response: {
    locked: false,
    nextSuggestion: {
      settingKey: "visual.fontSize",
      value: "medium",
      attemptNumber: 2
    },
    message: "Will try medium next"
  }
  
  Cooldown set: 10 minutes
```

**USER SEES:**
- Font size changes back to 16px (medium) immediately
- Prompt disappears
- No more prompts for 10 minutes

#### **Timeline: 11:02 - After Cooldown, No New Trial**

```
Since user said fontSize=large is "too big",
and medium is the previous value,
system interprets this as:
  "User prefers medium over large"

Preference state:
  currentValue: "medium"
  trialCount: 1
  failedTrials: 1
  cooldownUntil: 10 minutes from now

Next time ML suggests fontSize change:
  System will skip because recently tried
```

---

## What If User Clicks "👍 Yes, keep it"?

```
Timeline: 1:02 - User Clicks "👍 Yes, keep it"

POST /api/trials/feedback
  Request: {
    trialId: "uuid-123",
    feedbackType: "like"
  }
  
Backend locks preference:
  Response: {
    locked: true,
    message: "Preference locked at large"
  }
  
Preference state updated:
  preferredValue: "large"
  locked: true  ← NEVER CHANGE AGAIN!
  successfulTrials: 1

USER SEES:
  - Font stays at 18px (large)
  - Prompt disappears
  - This setting will NEVER change again
  - Even if ML suggests different values, ignored
```

---

## Multiple Settings Over Time

### Day 1, Session 1: 10:00 AM

```
Trial 1: fontSize (medium → large)
  └─ User clicks "👍 Keep it"
  └─ LOCKED at large ✅
```

### Day 1, Session 1: 10:15 AM (15 min later)

```
System checks: Should we propose new trial?
  - fontSize: LOCKED ✅ (skip)
  - targetSize: Not tried yet, ML suggests "large"
  - Last prompt: 15 min ago (> 10 min cooldown ✓)
  - Session prompts: 1 (max 1 per session ✗)
  
Decision: NO TRIAL (already prompted once this session)
```

### Day 1, Session 2: 3:00 PM (New session)

```
Trial 2: targetSize (medium → large)
  └─ Monitoring...
  └─ Low anomaly (0.2)
  └─ ACCEPT SILENTLY ✅
  └─ No prompt shown
```

### Day 2, Session 1: 10:00 AM (Next day)

```
Trial 3: contrast (normal → high)
  └─ Monitoring...
  └─ Medium anomaly (0.55)
  └─ PROMPT SHOWN
  └─ User clicks "⬇️ Too much"
  └─ Try medium instead
  └─ 10 min cooldown
```

---

## Code You Need to Write (Phase 2)

### 1. Create useTrialManager Hook

```tsx
// NPM-Package/src/hooks/useTrialManager.ts

export function useTrialManager(
  userId: string,
  apiEndpoint: string,
  mode: 'standard' | 'trial-based'
) {
  const [activeTrial, setActiveTrial] = useState(null);
  const [trialSettings, setTrialSettings] = useState({});
  const [showPrompt, setShowPrompt] = useState(false);
  const [evaluationTimer, setEvaluationTimer] = useState(null);
  const [metrics, setMetrics] = useState({
    clickCount: 0,
    misclickCount: 0,
    rageClickCount: 0,
    // ...
  });

  useEffect(() => {
    if (mode !== 'trial-based') return;

    // 1. Propose trial on mount
    proposeTrial();
  }, [userId, apiEndpoint, mode]);

  async function proposeTrial() {
    // Call POST /api/trials/propose
    // If hasTrial, call startTrial()
  }

  async function startTrial(proposal) {
    // Call POST /api/trials/start
    // Apply trial settings
    // Start evaluation timer (60s)
    // Start collecting metrics
  }

  async function evaluateTrial() {
    // Call POST /api/trials/evaluate with metrics
    // If shouldPrompt, show feedback prompt
    // If accept, keep changes
    // If revert, undo changes
  }

  async function handleFeedback(feedback) {
    // Call POST /api/trials/feedback
    // If locked, done
    // If nextSuggestion, start new trial
  }

  return {
    activeTrial,
    trialSettings,
    showPrompt,
    handleFeedback,
  };
}
```

### 2. Update AdaptiveProvider

```tsx
// NPM-Package/src/AdaptiveProvider.tsx

export function AdaptiveProvider({
  children,
  userId,
  apiEndpoint,
  mode = "standard", // NEW PROP
  ...
}: AdaptiveProviderProps) {
  
  // Add trial manager
  const {
    activeTrial,
    trialSettings,
    showPrompt,
    handleFeedback,
  } = useTrialManager(userId, apiEndpoint, mode);

  // Merge trial settings with profile
  const effectiveSettings = {
    ...profile,
    ...trialSettings,  // Trial overrides
  };

  return (
    <AdaptiveContext.Provider value={{ settings: effectiveSettings }}>
      {children}
      
      {/* Show prompt when needed */}
      {showPrompt && activeTrial && (
        <DirectionalFeedbackPrompt
          {...activeTrial}
          onFeedback={handleFeedback}
        />
      )}
    </AdaptiveContext.Provider>
  );
}
```

### 3. Enhance BehaviorTracker

```tsx
// NPM-Package/src/BehaviorTracker.ts

export class BehaviorTracker {
  // ... existing code ...

  // NEW: Misclick detection
  trackClick(element: HTMLElement) {
    const clickTime = Date.now();
    
    // Wait 500ms to see if user interacts with clicked element
    setTimeout(() => {
      const hadInteraction = this.checkInteraction(element);
      if (!hadInteraction) {
        this.metrics.misclickCount++;
      }
    }, 500);
  }

  // NEW: Rage click detection
  trackRageClicks(x: number, y: number) {
    const now = Date.now();
    const recentClicks = this.clickHistory.filter(
      click => now - click.time < 1000 && // Within 1 second
               Math.abs(click.x - x) < 50 && // Same area
               Math.abs(click.y - y) < 50
    );
    
    if (recentClicks.length >= 3) {
      this.metrics.rageClickCount++;
    }
  }

  // NEW: Zoom detection
  trackZoom() {
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        this.metrics.zoomEventCount++;
      }
    });
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
```

---

## Summary: What You Need to Do

### ✅ Already Done (Phase 1)
- Backend APIs (all working)
- Database schemas
- DirectionalFeedbackPrompt component
- Documentation

### 🔨 Need to Build (Phase 2)
1. **Create `useTrialManager` hook** (~200 lines)
   - Orchestrate trial lifecycle
   - Call APIs at right times
   - Manage trial state

2. **Update `AdaptiveProvider`** (~50 lines)
   - Add `mode` prop
   - Integrate useTrialManager
   - Render DirectionalFeedbackPrompt

3. **Enhance `BehaviorTracker`** (~100 lines)
   - Add misclick detection
   - Add rage click detection
   - Add zoom detection

4. **Rebuild NPM package**
   ```bash
   cd NPM-Package
   npm run build
   ```

### 🚀 Use in Your Projects
After Phase 2, just add one prop:

```tsx
<AdaptiveProvider
  mode="trial-based"  // ← This line!
  userId="user123"
  apiEndpoint="http://localhost:5000/api"
>
```

**Total work**: ~3-4 hours for Phase 2, then works in ALL your projects!

---

## Want Me to Start Phase 2?

I can create:
1. `useTrialManager` hook
2. Update `AdaptiveProvider`
3. Enhance `BehaviorTracker`
4. Test in NovaCart

Just let me know! 🚀
