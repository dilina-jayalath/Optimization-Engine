# Testing Settings Sync

## Current Setup ✅

1. **Python RL Service**: Running on http://localhost:8000
2. **Backend Server**: Running on http://localhost:5000  
3. **NovaCart**: Running on http://localhost:5174
4. **NPM Package**: Built successfully with MLFeedbackPrompt

## Fixed Issues ✅

1. ✅ Added `apiEndpoint="http://localhost:5000/api"` to AdaptiveProvider in App.jsx
2. ✅ Backend configured with MongoDB connection
3. ✅ Python RL service running and ready

## How to Test Settings Sync

### Method 1: Dashboard Manual Settings (Quick Test)

1. Open Dashboard: http://localhost:5173 (if running)
2. Login as admin
3. Change a setting (theme, font size, etc.)
4. Open NovaCart: http://localhost:5174
5. Should see settings applied in real-time

### Method 2: ML Simulation (Complete Flow Test)

1. Open NovaCart: http://localhost:5174
2. Login as `admin@novacart.com` (password: admin123)
3. **Look for ML Simulation Panel** on home page
4. Click **"Apply USER-WISE ML Settings"** button
   - Should apply: Dark theme, X-Large font, 28px targets
   - ML Confidence: 0.83
5. **MLFeedbackPrompt should appear** with three buttons:
   - 👍 Better - Keep It!
   - 😐 Same
   - 👎 Worse
6. Click a feedback button
7. Check console for RL model training logs

### Method 3: Direct API Test

```powershell
# Test SSE connection
curl http://localhost:5000/api/settings-events/stream/admin

# Trigger ML simulation
Invoke-RestMethod -Uri "http://localhost:5000/api/ml-simulation/apply-user-wise" -Method POST -ContentType "application/json" -Body '{"userId":"admin"}'

# Check RL feedback
Invoke-RestMethod -Uri "http://localhost:5000/api/rl-feedback/submit" -Method POST -ContentType "application/json" -Body '{
  "userId": "admin",
  "settingKey": "theme",
  "oldValue": "light",
  "newValue": "dark",
  "feedback": "positive",
  "source": "ml",
  "mlConfidence": 0.83
}'
```

## Expected Console Logs

### NovaCart Browser Console

```
[AURA] 🔗 Connecting to settings SSE: http://localhost:5000/api/settings-events/stream/admin
[AURA] ✅ Connected to settings stream
[AURA] 📥 Received settings update from ml with confidence 0.83
[AURA] 🎯 Sending feedback to RL model: positive
[AURA] ✅ RL model trained successfully
   Reward: 1
   Q-value: 0.55
```

### Backend Terminal

```
SSE client connected: admin
Broadcasting settings update to admin from ml (confidence: 0.83)
RL Feedback submitted: positive
Reward sent to Python RL: 1.0
```

### Python RL Terminal

```
127.0.0.1 - - [03/Jan/2026] POST /rl/feedback HTTP/1.1 200
Q-value updated for admin/theme/dark: 0.50 -> 0.55
```

## Troubleshooting

### If settings don't sync:

1. **Check browser console** for connection errors
2. **Verify backend is running**: `curl http://localhost:5000/api/settings-events/health`
3. **Check userId matches**: admin@novacart.com → auraUserId should be "admin"
4. **Verify AdaptiveProvider has apiEndpoint prop** in App.jsx

### If MLFeedbackPrompt doesn't appear:

1. **Ensure source is 'ml'** (not 'manual' or 'trial')
2. **Check AdaptiveProvider imports** MLFeedbackPrompt
3. **Verify NPM package is latest build**: check timestamp on dist/index.js
4. **Reinstall package in NovaCart**: `cd novacart && npm install ../NPM-Package`

### If RL model doesn't learn:

1. **Check Python service logs** for Q-value updates
2. **Verify reward mapping**: positive=1.0, neutral=0.0, negative=-1.0
3. **Check backend RL feedback route**: Should POST to http://localhost:8000/rl/feedback
4. **Inspect Q-table**: `curl http://localhost:8000/q-table`

## Success Criteria ✓

- [ ] NovaCart connects to SSE stream on page load
- [ ] ML simulation button triggers settings broadcast
- [ ] Settings apply immediately in NovaCart UI (theme/font changes visible)
- [ ] MLFeedbackPrompt appears after ML settings applied
- [ ] Clicking feedback button sends data to RL model
- [ ] Python RL service logs show Q-value update
- [ ] Multiple feedbacks show Q-value progression (0.5 → 0.55 → 0.60)
