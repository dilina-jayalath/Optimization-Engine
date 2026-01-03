# ✅ Test Settings Sync - Step by Step

## 🎯 What We Just Fixed
Added **enhanced console logging** to track the complete settings sync flow from dashboard → NovaCart.

---

## 📋 Prerequisites

### 1. Backend Running
```bash
cd c:\Users\TUF\Desktop\research\Optimization-Engine
node backend/api.js
```
**Expected**: `Server running on http://localhost:5000`

### 2. NovaCart Running
```bash
cd c:\Users\TUF\Desktop\research\novacart
npm run dev
```
**Expected**: `Local: http://localhost:5173/`

### 3. Dashboard Running
```bash
cd c:\Users\TUF\Desktop\research\dashboard
npm run dev
```
**Expected**: Running on a port (usually 5174)

---

## 🧪 Test Procedure

### Step 1: Login to NovaCart
1. Open browser: `http://localhost:5173/`
2. Click **Login**
3. Use credentials: `admin@novacart.com` / `password123`
4. **Verify**: You're logged in as "Admin User" (auraUserId: `u_001`)

### Step 2: Open Browser Console
1. Press **F12** to open DevTools
2. Go to **Console** tab
3. Clear console (🚫 icon)
4. **Look for**: `[AURA] 🔌 Connected to settings sync`

**Expected logs:**
```
[AURA] 🔌 Connected to settings sync
[AURA] 👤 Monitoring user: u_001
[AURA] 🌐 SSE endpoint: http://localhost:5000/api
```

### Step 3: Open Dashboard
1. Open new tab: Dashboard URL (e.g., `http://localhost:5174/`)
2. Navigate to **Manual Settings** page
3. Make sure you're editing settings for user: **u_001**

### Step 4: Change Settings
In the dashboard, change any setting:
- **Theme**: Switch from `light` to `dark` (or vice versa)
- **Font Size**: Change from `medium` to `large`
- **Primary Color**: Pick a new color (e.g., `#ff0000` for red)
- **Contrast**: Switch between `normal` and `high`

Click **Save Settings**

### Step 5: Watch NovaCart Console
Switch back to NovaCart tab (localhost:5173) and watch the console logs:

**Expected log sequence:**
```
[AURA] 📥 Received settings update from dashboard: {theme: 'dark', fontSize: 'large', ...} source: manual

[AURA] 📋 Current profile: {theme: 'light', font_size: 'medium', ...}

[AURA] 🎨 Applying updated profile: {theme: 'dark', font_size: 'large', ...}

[AURA] ✅ Tokens updated: {colors: {...}, typography: {...}, ...}

[AURA] 🎯 UI should now reflect: theme=dark, fontSize=large, colors=#ff0000

[AURA] 💬 Feedback prompt shown

[AURA] 🎨 UI tokens applied in realtime: {...}
[AURA] 📐 CSS Variables set:
  --aura-font-size-base: 18px
  --aura-color-primary: #ff0000
  --aura-color-background: #1a1a1a
  --aura-color-text: #ffffff
  Theme class: aura-theme-dark
```

### Step 6: Verify Visual Changes
**NovaCart page should instantly show:**
- ✅ Theme changed (dark/light background)
- ✅ Text size changed
- ✅ Primary color changed (buttons, links)
- ✅ Feedback prompt appears asking "How do these changes feel?"

---

## 🔍 Debugging If It Doesn't Work

### Issue 1: No SSE Connection Log
**Symptom**: Console doesn't show `[AURA] 🔌 Connected to settings sync`

**Check:**
```bash
# In backend terminal, look for:
[SSE] Client connected for user u_001 (total: 1)
```

**Fix**: 
- Verify backend is running
- Verify userId in NovaCart matches (should be `u_001` for admin)
- Check Network tab in DevTools for SSE connection to `/api/settings-events/u_001`

### Issue 2: Connection But No Messages
**Symptom**: Shows connected but no logs when changing settings

**Check:**
```bash
# In backend terminal after clicking Save, look for:
[SSE] Broadcasting settings update to user: u_001, source: manual
[SSE] Sent to 1 client(s)
```

**Fix**:
- Verify dashboard is saving to user `u_001`
- Check backend logs for broadcast message
- Verify manual-settings route is calling `broadcastSettingsUpdate()`

### Issue 3: Messages Received But No Visual Change
**Symptom**: Logs show everything but UI doesn't update

**Check console for:**
```
[AURA] 🎨 UI tokens applied in realtime
[AURA] 📐 CSS Variables set:
```

**Inspect DOM:**
1. Open Elements tab in DevTools
2. Click on `<html>` element
3. Look for:
   - `style="--aura-font-size-base: 18px; ..."`
   - `class="... aura-theme-dark ..."`

**Fix**:
- If CSS variables are set but UI doesn't change → NovaCart components might not be using them
- Check if components use `useAdaptive()` hook and `tokens` in their styles

### Issue 4: Wrong User ID
**Symptom**: Backend shows different userId than expected

**Check**:
1. NovaCart console: Look for `[AURA] 👤 Monitoring user: <userId>`
2. Backend logs: Look for `[SSE] Client connected for user <userId>`
3. Dashboard: Verify you're editing settings for the correct user

**Fix**:
- In NovaCart, make sure admin user has `auraUserId: "u_001"` in mockData.js
- Check authSlice.js to verify auraUserId is being stored

---

## 📊 Success Criteria

✅ **Connection**: Console shows SSE connected with correct userId  
✅ **Message Flow**: Backend broadcasts → NovaCart receives → Logs show update  
✅ **Token Update**: Console shows tokens updated with new values  
✅ **CSS Applied**: Console shows CSS variables set on document root  
✅ **Visual Change**: NovaCart UI actually changes (theme, colors, font size)  
✅ **Feedback Prompt**: Prompt appears asking for user feedback  

---

## 🎬 Video Proof Checklist

When recording demo:
1. Show backend terminal with SSE connection log
2. Show NovaCart page with console open
3. Show dashboard with settings form
4. Change a setting (theme or color)
5. Click Save
6. Watch backend terminal show broadcast
7. Watch NovaCart console show logs
8. Show NovaCart UI change instantly
9. Show feedback prompt appear

---

## 🐛 Still Not Working?

### Check Network Tab
1. Open DevTools → Network tab
2. Filter by "settings-events"
3. Look for:
   - **Status**: `200` (pending is OK for SSE)
   - **Type**: `eventsource`
   - **Messages**: Click on connection → EventStream tab → See messages

### Check Backend Route Registration
In `backend/api.js`, verify:
```javascript
const settingsEventsRouter = require('./routes/settings-events');
app.use('/api/settings-events', settingsEventsRouter);
```

### Check Manual Settings Route
In `backend/routes/manual-settings.js`, verify after save:
```javascript
const { broadcastSettingsUpdate } = require('./settings-events');
broadcastSettingsUpdate(userId, updatedSettings, 'manual');
```

### Check Package Version
```bash
cd c:\Users\TUF\Desktop\research\novacart
npm list @aura/aura-adaptor
# Should show: @aura/aura-adaptor@1.0.0 -> ../NPM-Package
```

If outdated:
```bash
cd c:\Users\TUF\Desktop\research\NPM-Package
npm run build

cd c:\Users\TUF\Desktop\research\novacart
npm install ../NPM-Package
```

---

## 📝 What to Report Back

Please share:
1. **Console logs** from NovaCart (screenshot or copy-paste)
2. **Backend terminal logs** showing SSE connection and broadcast
3. **Dashboard settings** you changed
4. **Visual result** - did UI change?
5. **Any error messages**

This will help me diagnose exactly where the flow is breaking!
