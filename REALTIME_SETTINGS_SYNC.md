# Real-Time Settings Sync Flow

## Overview
This document explains how settings changes in the Dashboard automatically apply to the NovaCart website and collect user feedback.

## Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Dashboard  │────────▶│   Backend    │────────▶│   NovaCart   │
│              │  HTTP   │   (SSE)      │   SSE   │   (Website)  │
│ Manual       │  PUT    │              │  Push   │              │
│ Settings     │         │  Broadcast   │         │  Apply &     │
│ Control      │         │              │         │  Show        │
│              │         │              │         │  Feedback    │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                         │
       └────────────────────────┴─────────────────────────┘
                         Feedback Loop
```

## Components

### 1. Backend (Optimization-Engine)

#### **Server-Sent Events (SSE) Route**
**File:** `backend/routes/settings-events.js`

- **Endpoint:** `GET /api/settings-events/:userId`
- Keeps persistent connection with each user's browser
- Broadcasts settings updates in real-time
- Automatically reconnects on disconnect

**Key Functions:**
- `broadcastSettingsUpdate(userId, settings, source)` - Send settings to all connected clients for a user
- `getConnectionCount(userId)` - Get number of active connections
- `broadcastToAll(event)` - Send event to all users (admin broadcasts)

#### **Manual Settings Route (Updated)**
**File:** `backend/routes/manual-settings.js`

- **Endpoint:** `PUT /api/manual-settings/:userId`
- Updates settings in MongoDB
- **NEW:** Broadcasts changes via SSE to all connected clients
- Integrated with feedback system

```javascript
// After updating settings
broadcastSettingsUpdate(userId, {
  enabled: settings.enabled,
  fontSize: settings.fontSize,
  lineHeight: settings.lineHeight,
  // ... other settings
}, 'manual');
```

### 2. NPM Package (@aura/aura-adaptor)

#### **Settings Sync Hook**
**File:** `src/hooks/useSettingsSync.ts`

- Opens SSE connection to backend
- Listens for settings updates
- Auto-reconnects with exponential backoff
- Triggers callback when settings change

**Usage:**
```typescript
const { isConnected, lastUpdate } = useSettingsSync({
  userId: 'user123',
  apiEndpoint: 'http://localhost:5000/api',
  enabled: true,
  onSettingsUpdate: (settings, source) => {
    // Apply settings to UI
  }
});
```

#### **Settings Change Prompt Component**
**File:** `src/components/AdaptiveSettingsChangePrompt.tsx`

Shows when settings change from dashboard:
- Non-blocking notification (top-right by default)
- Quick feedback buttons: 👍 Better / 😐 Same / 👎 Worse
- Optional comment for negative feedback
- Auto-hides after 15 seconds
- Shows what changed (expandable list)

#### **Updated AdaptiveProvider**
**File:** `src/AdaptiveProvider.tsx`

**NEW Features:**
1. Integrates `useSettingsSync` hook
2. Maps dashboard settings to `AuraProfile` format
3. Updates UI tokens automatically
4. Shows feedback prompt on changes
5. Submits feedback to backend

**Flow:**
```typescript
Dashboard changes settings 
  → SSE broadcasts update 
  → useSettingsSync receives it 
  → handleSettingsUpdate maps to profile 
  → setProfile + setTokens 
  → UI re-renders with new styles 
  → AdaptiveSettingsChangePrompt appears 
  → User provides feedback 
  → Feedback sent to backend
```

### 3. NovaCart Website (Consumer)

**File:** `novacart/src/App.jsx`

Already configured! The existing `AdaptiveProvider` setup now automatically:
- Connects to SSE endpoint
- Receives real-time settings updates
- Applies changes to UI
- Shows feedback prompts

**Existing code (no changes needed):**
```jsx
<AdaptiveProvider 
  mode="trial-based"
  simulateExtensionInstalled={true} 
  userId={auraUserId}
  apiEndpoint="http://localhost:5000/api"  // ✅ SSE uses this
  enableBehaviorTracking={true}
  debugMode={true}
>
  <AppInner />
</AdaptiveProvider>
```

## Data Flow

### 1. Dashboard User Changes Settings

```javascript
// dashboard/src/components/ManualSettingsControl.jsx
await updateManualSettings(userId, {
  enabled: true,
  fontSize: 'x-large',
  lineHeight: 1.6,
  contrast: 'high',
  spacing: 'wide',
  targetSize: 28,
  theme: 'dark',
  reducedMotion: true
});
```

### 2. Backend Broadcasts Update

```javascript
// backend/routes/manual-settings.js
router.put('/:userId', async (req, res) => {
  // ... update MongoDB
  
  // Broadcast to all connected clients
  broadcastSettingsUpdate(userId, settings, 'manual');
  
  res.json({ success: true, settings });
});
```

### 3. NPM Package Receives & Applies

```typescript
// NPM-Package/src/AdaptiveProvider.tsx
const handleSettingsUpdate = (settings, source) => {
  const updatedProfile: AuraProfile = {
    font_size: settings.fontSize,
    line_height: settings.lineHeight,
    contrast_mode: settings.contrast,
    // ... map all settings
  };
  
  setProfile(updatedProfile);
  setTokens(deriveTokensFromProfile(updatedProfile));
  setShowSettingsPrompt(true); // Show feedback prompt
};
```

### 4. User Provides Feedback

```typescript
// User clicks "👍 Better"
const handleSettingsFeedback = async (sentiment, comment) => {
  await fetch(`${apiEndpoint}/users/${userId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({
      parameter: 'settings_sync',
      feedback: {
        type: sentiment,  // 'positive' | 'negative' | 'neutral'
        rating: sentiment === 'positive' ? 5 : 1,
        comment,
      },
      context: { source: 'settings_sync' }
    })
  });
};
```

## Settings Mapping

### Dashboard → AuraProfile

| Dashboard Field | AuraProfile Field | Type |
|----------------|-------------------|------|
| `fontSize` | `font_size` | string |
| `lineHeight` | `line_height` | number |
| `contrast` | `contrast_mode` | string |
| `spacing` | `element_spacing` | string |
| `targetSize` | `target_size` | number |
| `theme` | `theme` | 'light' \| 'dark' |
| `reducedMotion` | `reduced_motion` | boolean |
| `primaryColor` | `primary_color` | string (hex) |
| `secondaryColor` | `secondary_color` | string (hex) |
| `accentColor` | `accent_color` | string (hex) |

## Testing the Flow

### Setup

1. **Start Backend:**
```bash
cd Optimization-Engine
npm run dev  # or node backend/api.js
```

2. **Start NovaCart:**
```bash
cd novacart
npm run dev
```

3. **Start Dashboard:**
```bash
cd Optimization-Engine/dashboard
npm run dev
```

### Test Steps

1. **Open NovaCart** (http://localhost:5173)
   - Login or use as guest
   - Note current UI appearance

2. **Open Dashboard** (http://localhost:5174)
   - Open "Manual Settings Control"
   - Select a user

3. **Change Settings:**
   - Increase font size to "x-large"
   - Change theme to "dark"
   - Increase target size to 32
   - Click save

4. **Observe NovaCart:**
   - Settings apply **instantly** (no page reload)
   - Feedback prompt appears in top-right
   - UI reflects new font size, theme, etc.

5. **Provide Feedback:**
   - Click "👍 Better" if you like it
   - Click "👎 Worse" to provide comment
   - Feedback sent to backend for ML training

### Debugging

**Check SSE Connection:**
```javascript
// In browser console (NovaCart)
console.log('[AURA SSE] Connection status')
```

**Check Backend Logs:**
```
[SSE] Client connected for user u_001 (total: 1)
[Manual Settings] Updating settings for userId=u_001
[SSE] Broadcasted settings update to 1 client(s)
```

**Check Network Tab:**
- Look for `settings-events/u_001` connection (EventStream)
- Should stay open (pending)
- Messages appear as events come in

## Benefits

1. **Zero Latency** - Changes apply instantly without polling
2. **Efficient** - Server pushes only when needed (vs constant polling)
3. **Scalable** - SSE is lightweight, handles many connections
4. **Feedback Loop** - Users immediately see and rate changes
5. **ML Training** - Real-time feedback improves AI model
6. **Multi-Tab Support** - All tabs for same user update together

## Configuration

### Enable/Disable Settings Sync

```tsx
// In novacart/src/App.jsx
<AdaptiveProvider 
  apiEndpoint="http://localhost:5000/api"  // Set to enable
  // or
  apiEndpoint=""  // Empty to disable settings sync
>
```

### Adjust Feedback Prompt

```tsx
// In NPM-Package/src/AdaptiveProvider.tsx
React.createElement(AdaptiveSettingsChangePrompt, {
  position: "top-right",     // Change position
  autoHideDelay: 15000,      // 15 seconds (0 = never auto-hide)
})
```

### Reconnection Settings

```typescript
// In NPM-Package/src/hooks/useSettingsSync.ts
const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
// Starts at 1s, doubles each time, max 30s
```

## Error Handling

- **SSE Connection Fails:** Auto-reconnects with exponential backoff
- **Settings Update Fails:** Error logged, doesn't crash app
- **Feedback Submit Fails:** Logged, user can continue using app
- **Network Offline:** Reconnects when back online

## Security Considerations

- SSE endpoint validates userId
- Settings changes require authentication
- Feedback includes userId validation
- CORS configured for known origins
- No sensitive data in SSE messages

## Future Enhancements

- [ ] Add authentication token to SSE connection
- [ ] Encrypt settings in transit (HTTPS/WSS)
- [ ] Rate limit settings updates per user
- [ ] Add undo/redo for settings changes
- [ ] Support multiple device sync (desktop + mobile)
- [ ] Add settings version conflict resolution
- [ ] Implement settings preview before applying

## API Reference

### Backend Endpoints

#### GET /api/settings-events/:userId
Opens SSE connection for real-time updates

**Response:** (stream)
```
data: {"type":"connected","userId":"u_001"}

data: {"type":"settings_update","userId":"u_001","source":"manual","settings":{...}}
```

#### PUT /api/manual-settings/:userId
Update user settings (broadcasts via SSE)

**Request:**
```json
{
  "fontSize": "x-large",
  "theme": "dark",
  "contrast": "high"
}
```

**Response:**
```json
{
  "success": true,
  "settings": { ... }
}
```

### NPM Package Hooks

#### useSettingsSync(options)

**Options:**
- `userId` - User identifier
- `apiEndpoint` - Backend URL
- `enabled` - Enable/disable sync
- `onSettingsUpdate` - Callback when settings change
- `onConnect` - Callback when connected
- `onError` - Callback on error

**Returns:**
- `isConnected` - Connection status
- `lastUpdate` - Last update timestamp
- `reconnect()` - Manual reconnect
- `disconnect()` - Close connection

## Troubleshooting

**Problem:** Settings don't update in real-time

**Solutions:**
1. Check SSE connection in Network tab
2. Verify `apiEndpoint` is set correctly
3. Check backend is running and accessible
4. Look for CORS errors in console

**Problem:** Feedback prompt doesn't appear

**Solutions:**
1. Check `showSettingsPrompt` state in React DevTools
2. Verify `onSettingsUpdate` is called (console logs)
3. Check z-index conflicts with other UI elements

**Problem:** SSE keeps disconnecting

**Solutions:**
1. Check network stability
2. Increase reconnection timeout
3. Check server load/memory
4. Verify no proxy/firewall blocking SSE

---

**Created:** January 2026  
**Last Updated:** January 2026  
**Version:** 1.0.0
