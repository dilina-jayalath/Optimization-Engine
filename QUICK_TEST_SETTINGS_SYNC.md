# Quick Start: Testing Real-Time Settings Sync

## Prerequisites
- Backend server running (Optimization-Engine)
- NovaCart website running
- Dashboard running
- All on localhost with CORS enabled

## Step-by-Step Test

### 1. Start All Services

```bash
# Terminal 1: Backend
cd Optimization-Engine
npm install  # if not already done
node backend/api.js
# Should see: Server running on port 5000

# Terminal 2: NovaCart
cd novacart
npm install  # if not already done
npm run dev
# Should see: Local: http://localhost:5173

# Terminal 3: Dashboard
cd Optimization-Engine/dashboard
npm install  # if not already done
npm run dev
# Should see: Local: http://localhost:5174
```

### 2. Open NovaCart in Browser

1. Navigate to http://localhost:5173
2. Login or continue as guest
3. **Open Browser DevTools (F12)**
4. Go to Console tab
5. Look for: `[AURA SSE] Connecting to: http://localhost:5000/api/settings-events/...`
6. Should see: `[AURA SSE] Connection opened`

### 3. Verify SSE Connection

In Network tab:
- Filter by "settings-events"
- Should see request to `/api/settings-events/[userId]`
- Type: `eventsource`
- Status: `200` (pending - this is normal!)
- Connection stays open

### 4. Open Dashboard

1. Navigate to http://localhost:5174
2. Click on "Manual Settings Control" or similar
3. Select the same userId that NovaCart is using

### 5. Change Settings

In Dashboard:
1. Change **Font Size** to `x-large`
2. Change **Theme** to `dark`
3. Change **Line Height** to `1.8`
4. Change **Contrast** to `high`
5. Click **Save**

### 6. Watch NovaCart Update! 🎉

**Within 1 second**, you should see:

#### In NovaCart Browser:
- **Background turns dark** (if was light)
- **Text becomes larger**
- **Line spacing increases**
- **Colors change for high contrast**

#### In NovaCart Console:
```
[AURA SSE] Received event: {type: "settings_update", ...}
[AURA] Received settings update from dashboard: {...} source: manual
[AURA] UI tokens applied in realtime: {...}
```

#### In NovaCart UI:
- **Feedback prompt appears** in top-right corner:
  ```
  🎨 Settings Updated
  Changed by Dashboard
  
  How do these changes feel?
  [👍 Better] [😐 Same] [👎 Worse]
  ```

### 7. Provide Feedback

Click one of the buttons:
- **👍 Better** - Submits positive feedback, closes prompt
- **😐 Same** - Submits neutral feedback, closes prompt
- **👎 Worse** - Opens comment box for details

If you click **👎 Worse**:
1. Text area appears
2. Type feedback like "Font too big, hurts readability"
3. Click **Submit**
4. Feedback sent to backend

### 8. Verify Feedback Submission

#### In NovaCart Console:
```
[AURA] Submitting settings feedback: {parameter: "settings_sync", ...}
[AURA] Settings feedback submitted successfully
```

#### In Backend Console:
```
[Feedback] Received feedback from user u_001: {type: "positive", ...}
```

## Expected Results

✅ Settings change in Dashboard → NovaCart updates **instantly**  
✅ No page reload needed  
✅ Feedback prompt appears automatically  
✅ Feedback submission works  
✅ Multiple tabs update together (open NovaCart in 2 tabs)  
✅ Connection auto-reconnects if interrupted  

## Troubleshooting

### Problem: No SSE connection in Network tab

**Check:**
1. Is backend running? (Check terminal)
2. Is apiEndpoint correct in NovaCart App.jsx?
   ```jsx
   apiEndpoint="http://localhost:5000/api"
   ```
3. Check CORS errors in console
4. Verify backend has settings-events route registered

**Solution:**
```javascript
// In backend/api.js, ensure this line exists:
app.use('/api/settings-events', settingsEventsRouter);
```

### Problem: Settings don't update in NovaCart

**Check:**
1. Is SSE connected? (Look for "Connection opened" in console)
2. Is broadcast being called? (Check backend console)
3. Is handleSettingsUpdate being called? (Check NovaCart console)

**Solution:**
```javascript
// In manual-settings.js, after updating settings:
broadcastSettingsUpdate(userId, settings, 'manual');
```

### Problem: Feedback prompt doesn't appear

**Check:**
1. Is `showSettingsPrompt` state being set? (React DevTools)
2. Check for z-index conflicts
3. Verify component is rendering

**Debug:**
```javascript
// In browser console:
console.log(document.querySelector('[style*="10000"]')); // Should find prompt
```

### Problem: SSE keeps disconnecting

**Check:**
1. Network stability
2. Server memory/CPU
3. Firewall/proxy settings

**Solution:**
- Check reconnection logs in console
- Should auto-reconnect with exponential backoff
- Max delay is 30 seconds

## Advanced Testing

### Test Multi-Tab Sync

1. Open NovaCart in **2 browser tabs** side-by-side
2. Change settings in Dashboard
3. **Both tabs** should update simultaneously
4. Only 1 feedback prompt appears (first tab)

### Test Reconnection

1. Stop backend server (Ctrl+C)
2. Watch console: `[AURA SSE] Connection error`
3. Watch: `[AURA SSE] Reconnecting in Xms`
4. Restart backend
5. Watch: `[AURA SSE] Connection opened`
6. Settings sync should work again

### Test Different Users

1. Open NovaCart as `user_a`
2. Open another browser (or incognito) as `user_b`
3. Change settings for `user_a` in Dashboard
4. Only `user_a` tab updates (not `user_b`)

### Test Settings Mapping

Verify each setting maps correctly:

| Dashboard Setting | NovaCart Effect |
|------------------|-----------------|
| Font Size → x-large | All text larger |
| Theme → dark | Background black, text white |
| Contrast → high | Stronger borders, bold text |
| Line Height → 1.8 | More space between lines |
| Target Size → 32 | Buttons and links larger |
| Spacing → wide | More padding everywhere |

### Test Feedback Persistence

1. Submit feedback in NovaCart
2. Check MongoDB for feedback record:
   ```javascript
   // In MongoDB Compass or shell
   db.feedbacks.find({ userId: "u_001" }).sort({ createdAt: -1 }).limit(1)
   ```
3. Should see your feedback with:
   - `parameter: "settings_sync"`
   - `feedback.type: "positive"` (or your selection)
   - `context.source: "settings_sync"`

## Performance Testing

### Measure Latency

1. Open browser DevTools Performance tab
2. Start recording
3. Change settings in Dashboard
4. Stop recording when prompt appears

**Expected:**
- Dashboard → Backend: < 50ms
- Backend → NovaCart SSE: < 10ms
- NovaCart render update: < 100ms
- **Total: < 200ms** (feels instant)

### Monitor Memory

```javascript
// In NovaCart console
console.memory.usedJSHeapSize / 1024 / 1024 + ' MB'
// Should not increase significantly over time
```

### Check Network Efficiency

- SSE connection: ~2KB initial, then only events
- Settings update event: ~500 bytes
- Compare to polling: Would be 1KB every 5 seconds = wasteful

## What to Look For

### ✅ Good Signs
- Console logs show clear flow
- UI updates smoothly
- No JavaScript errors
- Feedback submits successfully
- SSE reconnects after interruption

### ❌ Bad Signs
- `CORS error` in console → Fix backend CORS config
- `Connection timeout` → Check firewall/network
- `404 Not Found` → Backend route not registered
- Settings don't apply → Check mapping logic
- Feedback fails silently → Check API endpoint

## Next Steps

Once basic flow works:

1. **Customize feedback prompt**
   - Change position, colors, text
   - Edit `AdaptiveSettingsChangePrompt.tsx`

2. **Add more settings**
   - Extend dashboard controls
   - Map in `handleSettingsUpdate`
   - Add to AuraProfile type

3. **Integrate with ML**
   - Use feedback to train model
   - Auto-suggest settings based on behavior
   - Implement trial-based testing

4. **Deploy to production**
   - Use HTTPS for SSE
   - Add authentication
   - Configure CORS properly
   - Use environment variables

## Success Criteria

✅ Settings sync works end-to-end  
✅ Feedback collection is intuitive  
✅ No errors in console  
✅ Performance is imperceptible (< 200ms)  
✅ Multi-tab sync works  
✅ Auto-reconnection works  
✅ Feedback reaches backend  

---

**Need Help?**
- Check browser console for errors
- Check backend console for logs
- Review [REALTIME_SETTINGS_SYNC.md](REALTIME_SETTINGS_SYNC.md) for details
- Check [SETTINGS_SYNC_DIAGRAM.md](SETTINGS_SYNC_DIAGRAM.md) for architecture
