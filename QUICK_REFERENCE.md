# 🎯 Quick Reference: Trial-Based System

## 🚀 Start Services

```bash
# Backend (http://localhost:5000)
cd C:\Users\TUF\Desktop\research\Optimization-Engine
npm run dev

# ML Service (optional - for suggestions)
cd python_rl_service
python personalization_service.py
```

## 🧪 Test Everything

```bash
# Run full test suite
node test-trial-system.js

# Expected: ✅ All tests passed!
```

## 📡 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/trials/propose` | Get next trial based on ML + user state |
| POST | `/api/trials/start` | Start trial (apply change silently) |
| POST | `/api/trials/evaluate` | Calculate anomaly score & decide |
| POST | `/api/trials/feedback` | Record user feedback (bounded search) |
| GET | `/api/trials/preferences/:userId` | Get all preference states |

## 🎨 Component Usage

```tsx
import { DirectionalFeedbackPrompt } from '@aura/aura-adaptor';

<DirectionalFeedbackPrompt
  trialId="uuid"
  settingName="Font Size"
  oldValue="medium"
  newValue="large"
  onFeedback={handleFeedback}
  position="bottom-right"
/>
```

## 🔢 Key Numbers

- **Evaluation Window**: 60 seconds or 5+ clicks
- **Global Cooldown**: 10 minutes between any prompts
- **Dismiss Cooldown**: 24 hours after "don't ask again"
- **Session Limit**: Max 1 prompt per session
- **Retry Limit**: Max 2 retries per setting
- **Anomaly Thresholds**: <0.3 accept, >0.7 revert, 0.3-0.7 prompt

## 📊 Anomaly Weights

```javascript
{
  misclickRate: 0.30,   // Highest priority
  rageClicks: 0.25,
  timeToClick: 0.20,
  formErrors: 0.15,
  zoomEvents: 0.10
}
```

## 🎚️ Setting Ladders

```javascript
fontSize:    [small, medium, large, xlarge] → [14px, 16px, 18px, 20px]
lineHeight:  [small, medium, large, xlarge] → [1.3, 1.5, 1.7, 1.9]
targetSize:  [small, medium, large, xlarge] → [40px, 44px, 48px, 52px]
contrast:    [normal, medium, high, maximum] → [default, 1.3, 1.5, 2.0]
spacing:     [compact, normal, comfortable, spacious] → [0.8, 1.0, 1.2, 1.5]
theme:       [light, dark, auto]
```

## 🔄 Trial Lifecycle

```
1. ML suggests change
   ↓
2. POST /propose → Get proposal
   ↓
3. POST /start → Apply silently
   ↓
4. Collect metrics (60s)
   ↓
5. POST /evaluate → Calculate anomaly
   ↓
6. Show prompt (if shouldPrompt=true)
   ↓
7. POST /feedback → Process response
   ↓
8. Lock or try again (bounded search)
```

## 🎯 Feedback Options

| Button | feedbackType | reason | Action |
|--------|--------------|--------|--------|
| 👍 Yes, keep it | `like` | - | Lock at current value |
| ⬇️ Too large | `dislike` | `too_big` | Move down ladder |
| ⬆️ Too small | `dislike` | `too_small` | Move up ladder |
| ⚙️ Dismiss | `dislike` | `dismiss` | 24hr cooldown |

## 📁 File Locations

### Backend
- Config: `backend/config/ladders.js`
- Schemas: `backend/mongodb/schemas.js`
- Routes: `backend/routes/trials.js`
- API: `backend/api.js`

### Frontend (NPM Package)
- Component: `NPM-Package/src/components/DirectionalFeedbackPrompt.tsx`
- Index: `NPM-Package/src/index.tsx`

### Documentation
- Complete Guide: `TRIAL_BASED_SYSTEM.md`
- Implementation: `IMPLEMENTATION_SUMMARY.md`
- Flow Diagram: `SYSTEM_FLOW_DIAGRAM.md`
- Checklist: `CHECKLIST.md`

## 🐛 Debugging

```bash
# Check server running
curl http://localhost:5000/api/health

# Test propose endpoint (PowerShell)
$body = @{userId='test';mlSuggestedProfile=@{'visual.fontSize'='large'}} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:5000/api/trials/propose' -Method POST -Body $body -ContentType 'application/json'

# Check MongoDB connection
# Should see: ✅ Connected to MongoDB in server logs

# View recent trials
curl http://localhost:5000/api/trials/preferences/guest
```

## 📊 Database Models

### Trial
- Core: `trialId`, `userId`, `sessionId`, `settingKey`, `oldValue`, `newValue`
- Context: `pageType`, `deviceType`, `timeOfDay`
- Metrics: 8 behavior metrics
- Decision: `anomalyScore`, `decision`, `shouldPrompt`
- Feedback: `given`, `type`, `reason`, `timestamp`

### PreferenceState
- State: `currentValue`, `currentIndex`, `preferredValue`, `locked`
- History: `trialCount`, `successfulTrials`, `failedTrials`
- Cooldowns: `cooldownUntil`, `lastPromptAt`, `lastTrialAt`
- Engagement: `dismissCount`, `feedbackCount`

## ⚡ Quick Commands

```bash
# Start backend
npm run dev

# Run tests
node test-trial-system.js

# Build NPM package
cd NPM-Package
npm run build

# Check backend syntax
node -e "require('./backend/routes/trials'); console.log('OK')"
```

## 🎓 Key Concepts

**Bounded Search**: Max 2 retries to find preference in ladder, then lock.

**Anomaly Detection**: Only prompt if behavior metrics suggest problem.

**Preference Locking**: Once user confirms, setting never changes again.

**Multi-Layer Cooldowns**: 4 layers prevent spam (global, per-setting, session, retry).

**Directional Feedback**: User tells us which direction to search (up/down ladder).

## 🔗 Related Systems

- **ML Engine** (Group Member): Suggests profiles
- **Your System**: Tests suggestions safely + finds preferences
- **Relationship**: Complementary, not duplicate

---

**Phase 1 Status**: ✅ 100% Complete  
**Next**: Phase 2 - Integration (useTrialManager hook)

**Last Updated**: January 3, 2026  
**Version**: 1.0.0
