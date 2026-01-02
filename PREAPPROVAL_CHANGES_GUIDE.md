# Pre-Approval Changes System

## Overview

This system asks users to **approve or reject UI changes BEFORE applying them**. Users see a preview, make a decision, and the system learns immediately from their choice.

---

## How It Works

### Flow

```
1. Thompson Sampling suggests personalization
   ↓
2. AdaptiveChangeConfirmation shows preview
   "🎨 We suggest: Larger text (18px), High contrast"
   ↓
3. User decides:
   → YES: Apply changes + Learn positive (reward = 1.0)
   → NO:  Keep baseline + Learn negative (reward = 0.0)
```

### Key Differences from After-Feedback

| Feature | After-Feedback (Old) | Pre-Approval (New) |
|---------|---------------------|-------------------|
| **When shown** | 30s after changes applied | Before applying changes |
| **User choice** | Already experiencing changes | Preview only |
| **Learning timing** | After usage | Immediate |
| **Changes applied** | Always | Only if approved |
| **UX impact** | Disruptive if bad | User controls |

---

## Installation

### 1. Add Component to NPM Package

Already created: `NPM-Package/src/components/AdaptiveChangeConfirmation.tsx`

### 2. Export in index.tsx

```typescript
export { AdaptiveChangeConfirmation } from "./components/AdaptiveChangeConfirmation";
```

✅ **Done above**

### 3. Rebuild NPM Package

```bash
cd C:\Users\TUF\Desktop\research\NPM-Package
npm run build
```

### 4. Reinstall in Client (NovaCart)

```bash
cd C:\Users\TUF\Desktop\research\novacart
npm install ../NPM-Package
```

---

## Usage in NovaCart

### Add to App.jsx

```jsx
import { 
  AdaptiveProvider, 
  AdaptiveChangeConfirmation, 
  useRealtimeUIUpdates 
} from '@aura/aura-adaptor';

function AuraShell({ children }) {
  useRealtimeUIUpdates();

  return (
    <>
      {/* Shows before changes are applied */}
      <AdaptiveChangeConfirmation 
        variant="banner"  // or "modal"
        position="top"    // or "bottom" (for banner)
      />
      
      {children}
    </>
  );
}

function App() {
  return (
    <AdaptiveProvider
      apiEndpoint="http://localhost:5000/api"
      enableBehaviorTracking={true}
      debugMode={true}
    >
      <AuraShell>
        <Router>
          {/* Your routes */}
        </Router>
      </AuraShell>
    </AdaptiveProvider>
  );
}
```

---

## Component API

### AdaptiveChangeConfirmation

```typescript
interface AdaptiveChangeConfirmationProps {
  /** Display style */
  variant?: 'modal' | 'banner';
  
  /** Position (for banner variant) */
  position?: 'top' | 'bottom';
}
```

#### Variants

**Modal (default)**
- Full-screen overlay
- Blocks interaction
- More prominent
- Good for important changes

**Banner**
- Top or bottom bar
- Less intrusive
- User can still navigate
- Good for subtle changes

---

## User Experience

### Modal Example

```
┌─────────────────────────────────────┐
│                                     │
│   🎨 Personalized UI Available      │
│                                     │
│   We have personalized UI settings  │
│   based on your preferences:        │
│                                     │
│   • Larger text (18px)              │
│   • High contrast mode              │
│   • Wider spacing                   │
│                                     │
│   Would you like to try these?      │
│                                     │
│  [✓ Yes, Apply Changes]  [✗ No]    │
└─────────────────────────────────────┘
```

### Banner Example (Top)

```
┌──────────────────────────────────────────────┐
│ 🎨 Personalized UI Available: Larger text,  │
│    High contrast    [✓ Apply]  [✗ Dismiss]  │
└──────────────────────────────────────────────┘
```

---

## Backend Learning

### Approval Flow

When user clicks **"Yes, Apply"**:

```javascript
// 1. Send positive feedback
await submitFeedback({
  type: 'explicit',
  value: 1.0,
  comment: 'User approved changes before application'
});

// 2. Mark as approved
localStorage.setItem(`aura_changes_confirmed_${sessionId}`, 'approved');

// 3. Apply changes (hide confirmation)
```

**Backend receives:**
```json
POST /api/feedback/explicit
{
  "userId": "guest",
  "sessionId": "abc123",
  "answer": "yes",
  "value": 1.0,
  "comment": "User approved changes before application"
}
```

**Thompson Sampling updates:**
- Reward = 1.0 (strong positive signal)
- Increases α (successes) for this arm
- More likely to suggest this arm in future

### Rejection Flow

When user clicks **"No, Keep Current"**:

```javascript
// 1. Send negative feedback
await submitFeedback({
  type: 'explicit',
  value: 0.0,
  comment: 'User rejected changes before application'
});

// 2. Mark as rejected
localStorage.setItem(`aura_changes_confirmed_${sessionId}`, 'rejected');

// 3. Reload to baseline
await reload();
```

**Backend receives:**
```json
POST /api/feedback/explicit
{
  "userId": "guest",
  "sessionId": "abc123",
  "answer": "no",
  "value": 0.0,
  "comment": "User rejected changes before application"
}
```

**Thompson Sampling updates:**
- Reward = 0.0 (strong negative signal)
- Increases β (failures) for this arm
- Less likely to suggest this arm in future

---

## Configuration

### Show Only for Significant Changes

Modify component to check change magnitude:

```typescript
useEffect(() => {
  if (source === 'baseline' || source === 'fallback') {
    return; // Don't show for baseline
  }

  // Only show if changes are significant
  const isSignificant = tokens?.typography?.baseSize > 16 || 
                        tokens?.colorMode === 'high-contrast';
  
  if (isSignificant) {
    setVisible(true);
  }
}, [source, tokens]);
```

### Auto-Approve After Timer

Add optional auto-apply after 10 seconds:

```typescript
useEffect(() => {
  if (!visible) return;

  const timer = setTimeout(() => {
    console.log('[AURA] Auto-approving after 10s...');
    handleApprove();
  }, 10000);

  return () => clearTimeout(timer);
}, [visible]);
```

### Show Once Per Session

Already implemented via localStorage:

```typescript
const storageKey = `aura_changes_confirmed_${sessionId}`;
if (localStorage.getItem(storageKey)) {
  return; // Already decided
}
```

---

## Testing

### 1. Build & Install

```bash
# Build NPM package
cd C:\Users\TUF\Desktop\research\NPM-Package
npm run build

# Install in NovaCart
cd C:\Users\TUF\Desktop\research\novacart
npm install ../NPM-Package
```

### 2. Start Services

```bash
# Terminal 1: Backend
cd C:\Users\TUF\Desktop\research\Optimization-Engine
npm run dev

# Terminal 2: Thompson Sampling
cd C:\Users\TUF\Desktop\research\Optimization-Engine\python_rl_service
python personalization_service.py

# Terminal 3: NovaCart
cd C:\Users\TUF\Desktop\research\novacart
npm run dev
```

### 3. Test Approval Flow

1. Open http://localhost:5173
2. **Expected:** Confirmation modal/banner appears
3. Click **"✓ Yes, Apply Changes"**
4. **Expected:**
   - Changes applied (larger text, etc.)
   - Backend logs: `"Received explicit feedback: yes"`
   - Console: `"[AURA] User approved changes, applying..."`

### 4. Test Rejection Flow

1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Confirmation appears again
4. Click **"✗ No, Keep Current"**
5. **Expected:**
   - UI stays baseline
   - Backend logs: `"Received explicit feedback: no"`
   - Console: `"[AURA] User rejected changes, keeping baseline"`

### 5. Verify Learning

```bash
# Check Thompson Sampling state
curl http://localhost:5002/stats
```

**Expected after approval:**
```json
{
  "large_text": {
    "alpha": 2.0,  // Increased
    "beta": 1.0,
    "expected_value": 0.67,
    "samples": 1
  }
}
```

**Expected after rejection:**
```json
{
  "large_text": {
    "alpha": 1.0,
    "beta": 2.0,  // Increased
    "expected_value": 0.33,
    "samples": 1
  }
}
```

---

## Comparison: Before & After

### Before (No Confirmation)

```
User lands on page
  ↓
Thompson Sampling decides: "large_text"
  ↓
UI changes immediately (18px font)
  ↓
User sees changes (may like or dislike)
  ↓
After 30s: Feedback prompt appears
  ↓
User gives feedback (too late if bad UX)
```

**Problem:** Changes already applied, disruptive if user dislikes them

### After (With Confirmation)

```
User lands on page
  ↓
Thompson Sampling suggests: "large_text"
  ↓
Confirmation shows: "We suggest larger text"
  ↓
User previews and decides
  ↓
If YES: Apply + Learn positive
If NO: Skip + Learn negative
  ↓
User controls experience
```

**Benefit:** User has control, learning happens immediately

---

## Advanced: Show Preview

### Display Before/After Preview

```typescript
const [preview, setPreview] = useState<'before' | 'after'>('before');

// Toggle button
<button onClick={() => setPreview(preview === 'before' ? 'after' : 'before')}>
  {preview === 'before' ? '👁️ Preview Changes' : '🔙 Back to Current'}
</button>

// Apply preview styles temporarily
{preview === 'after' && (
  <style>
    {`
      :root {
        --aura-font-size-base: 18px !important;
        --aura-color-background: #1a1a1a !important;
      }
    `}
  </style>
)}
```

---

## Integration with Existing Features

### Works With

✅ **Session Caching (30-min TTL)**
- Confirmation only shows once per session
- After approval, changes cached for 30 minutes

✅ **Revert Button**
- User can still revert after approving
- Clears cache, shows new confirmation

✅ **After-Feedback Prompt**
- Can use both together
- Confirmation = pre-approval
- Feedback prompt = post-usage validation

✅ **Realtime Updates**
- useRealtimeUIUpdates applies CSS after approval
- Changes visible immediately

---

## Best Practices

### 1. Use Modal for First-Time Users

```jsx
<AdaptiveChangeConfirmation 
  variant="modal"  // More prominent
/>
```

### 2. Use Banner for Return Users

```jsx
const isFirstVisit = !localStorage.getItem('aura_seen_before');

<AdaptiveChangeConfirmation 
  variant={isFirstVisit ? 'modal' : 'banner'}
/>
```

### 3. Show Change Summary

Current changes object:
```javascript
{
  fontSize: 'Larger text (18px)',
  contrast: 'High contrast mode',
  spacing: 'Wider spacing'
}
```

Add more detail in production:
```javascript
{
  fontSize: {
    label: 'Text Size',
    from: '16px',
    to: '18px',
    reason: 'Based on your reading patterns'
  }
}
```

### 4. Track Approval Rate

Add analytics:
```javascript
const approvalRate = approvals / (approvals + rejections);
console.log(`Approval rate: ${approvalRate * 100}%`);
```

---

## Troubleshooting

### Confirmation Not Showing

**Check:**
1. Source is not baseline: `console.log(source)` should be `'user'` or `'category'`
2. localStorage not set: `localStorage.getItem('aura_changes_confirmed_*')`
3. Component imported: `import { AdaptiveChangeConfirmation } from '@aura/aura-adaptor'`

### Changes Not Applying After Approval

**Check:**
1. useRealtimeUIUpdates is called in parent
2. Backend logs show feedback received
3. Thompson Sampling service running (port 5002)

### Learning Not Working

**Check:**
1. Feedback endpoint returns success: `curl http://localhost:5000/api/feedback/explicit`
2. Thompson Sampling updates: `curl http://localhost:5002/stats`
3. Reward value correct: 1.0 for approval, 0.0 for rejection

---

## Next Steps

1. **Build NPM Package**: `npm run build` in NPM-Package directory
2. **Install in NovaCart**: `npm install ../NPM-Package` in novacart directory
3. **Add Component**: Import and use AdaptiveChangeConfirmation in App.jsx
4. **Test Flow**: Approve and reject changes, verify learning
5. **Monitor**: Check backend logs and Thompson Sampling stats

---

## Summary

**What It Does:**
- Shows UI change preview BEFORE applying
- User approves or rejects
- System learns immediately from decision
- Only applies changes if approved

**Why It's Better:**
- User has control
- No surprise changes
- Faster learning (immediate feedback)
- Better UX

**Ready to test!** 🚀
