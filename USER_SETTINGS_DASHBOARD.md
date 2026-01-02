# User Settings Dashboard

## Overview

A comprehensive dashboard where users can manually control all UI settings or let AI personalize automatically.

---

## Access Dashboard

Open: **http://localhost:5000/dashboard/settings.html**

---

## Features

### 🤖 Two Modes

**AI Mode (Default)**
- Thompson Sampling learns and optimizes automatically
- System picks best settings based on behavior
- No manual control needed

**Manual Mode**
- Complete control over all settings
- Real-time preview
- Auto-saves every 500ms
- Overrides AI personalization

---

## Settings Available

### Typography
- **Font Size**: 12px - 24px (default: 16px)
- **Line Height**: 1.2 - 2.0 (default: 1.5)

### Colors & Theme
- **Theme**: Light or Dark
- **Contrast**: Normal or High
- **Primary Color**: Color picker
- **Secondary Color**: Color picker
- **Accent Color**: Color picker

### Layout
- **Element Spacing**: Compact (6px), Normal (8px), Wide (12px)
- **Button Size**: 40px - 56px (default: 44px)

### Accessibility
- **Reduced Motion**: Toggle animations on/off

---

## How It Works

### Architecture

```
User Dashboard (settings.html)
   ↓ (PUT /api/manual-settings/:userId)
Backend API
   ↓ (Saves to MongoDB)
ManualSettings Collection
   ↓
Personalization Endpoint Checks:
   1. Manual settings first (if enabled)
   2. Session cache (if exists)
   3. Thompson Sampling (fallback)
   ↓
NPM Package receives settings
   ↓
Website applies CSS
```

### Priority Order

```javascript
// In personalization.js
router.get('/', async (req, res) => {
  // PRIORITY 1: Manual settings
  const manual = await ManualSettings.findOne({ userId });
  if (manual && manual.enabled) {
    return res.json({ ...manual, source: 'manual' });
  }

  // PRIORITY 2: Session cache
  if (cached && !forceNew) {
    return res.json({ ...cached, source: 'cached' });
  }

  // PRIORITY 3: Thompson Sampling
  const ts = await axios.post(TS_SERVICE, { userId, context });
  return res.json({ ...ts.data, source: 'thompson-sampling' });
});
```

---

## API Endpoints

### Get Manual Settings
```http
GET /api/manual-settings/:userId

Response:
{
  "success": true,
  "userId": "guest",
  "hasManualSettings": true,
  "settings": {
    "enabled": true,
    "fontSize": "18px",
    "lineHeight": 1.6,
    "contrast": "high",
    "spacing": "wide",
    "targetSize": "48px",
    "theme": "light",
    "reducedMotion": false,
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d",
    "accentColor": "#28a745",
    "lastModified": "2026-01-03T02:00:00.000Z"
  }
}
```

### Update Manual Settings
```http
PUT /api/manual-settings/:userId
Content-Type: application/json

{
  "enabled": true,
  "fontSize": "18px",
  "lineHeight": 1.6,
  "contrast": "high",
  "spacing": "wide",
  "targetSize": "48px",
  "theme": "dark",
  "reducedMotion": true,
  "primaryColor": "#667eea",
  "secondaryColor": "#764ba2",
  "accentColor": "#48bb78"
}

Response:
{
  "success": true,
  "userId": "guest",
  "settings": { ... }
}
```

### Disable Manual Mode (Return to AI)
```http
DELETE /api/manual-settings/:userId

Response:
{
  "success": true,
  "userId": "guest",
  "message": "Manual settings disabled, returning to AI personalization"
}
```

### Reset to Defaults
```http
POST /api/manual-settings/:userId/reset

Response:
{
  "success": true,
  "userId": "guest",
  "message": "Settings reset to defaults",
  "settings": { ... }
}
```

---

## Usage Flow

### Scenario 1: User Enables Manual Mode

1. Open http://localhost:5000/dashboard/settings.html
2. Click "✋ Manual Mode"
3. Adjust font size slider to 18px
4. Change theme to "Dark"
5. Settings auto-save after 500ms
6. Backend stores in MongoDB with `enabled: true`
7. User opens NovaCart (http://localhost:5173)
8. NPM package calls `/api/personalization?userId=guest`
9. Backend returns manual settings (source: 'manual')
10. Website applies 18px font and dark theme ✅

### Scenario 2: User Returns to AI Mode

1. Dashboard shows manual settings
2. Click "🤖 AI Mode"
3. Frontend calls `DELETE /api/manual-settings/guest`
4. Backend sets `enabled: false`
5. Next personalization request uses Thompson Sampling
6. AI learns from behavior again ✅

---

## Testing

### 1. Start Services

```bash
# Backend
cd C:\Users\TUF\Desktop\research\Optimization-Engine
npm run dev

# Thompson Sampling (optional, for AI mode)
cd python_rl_service
python personalization_service.py
```

### 2. Test Manual Mode

```bash
# Open dashboard
http://localhost:5000/dashboard/settings.html

# Switch to Manual Mode
# Adjust font size to 20px
# Change theme to Dark
# Wait 1 second (auto-save)
```

### 3. Verify in NovaCart

```bash
# Open NovaCart
http://localhost:5173

# Expected: 20px font, dark theme
# Check DevTools console for:
# "source": "manual"
```

### 4. Test API Directly

```bash
# Get current settings
curl http://localhost:5000/api/manual-settings/guest

# Update settings
curl -X PUT http://localhost:5000/api/manual-settings/guest \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"fontSize":"20px","theme":"dark"}'

# Return to AI mode
curl -X DELETE http://localhost:5000/api/manual-settings/guest
```

---

## Database Schema

```javascript
// ManualSettings Collection
{
  userId: String,          // User identifier
  enabled: Boolean,        // If true, overrides AI
  
  // Typography
  fontSize: String,        // e.g. "18px"
  lineHeight: Number,      // e.g. 1.6
  
  // Theme
  theme: String,          // "light" or "dark"
  contrast: String,       // "normal" or "high"
  
  // Layout
  spacing: String,        // "compact", "normal", "wide"
  targetSize: String,     // e.g. "48px"
  
  // Colors
  primaryColor: String,   // Hex color
  secondaryColor: String, // Hex color
  accentColor: String,    // Hex color
  
  // Accessibility
  reducedMotion: Boolean,
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

---

## Integration with NPM Package

The NPM package automatically receives manual settings:

```javascript
// In AdaptiveProvider
useEffect(() => {
  const fetchPersonalization = async () => {
    const response = await fetch(
      `${apiEndpoint}/personalization?userId=${userId}`
    );
    const data = await response.json();
    
    // Check source
    if (data.source === 'manual') {
      console.log('[AURA] Using manual settings from dashboard');
    } else if (data.source === 'thompson-sampling') {
      console.log('[AURA] Using AI personalization');
    }
    
    // Apply settings (same for both)
    applySettings(data.settings);
  };
}, [userId]);
```

No code changes needed in NPM package - it works automatically!

---

## Dashboard UI Features

### Real-Time Preview
Shows exactly how changes will look:
- Font size
- Line height
- Colors
- Button size
- Theme (light/dark)

### Auto-Save
- Saves 500ms after last change
- Shows "Last saved: [time]" indicator
- Visual notification on success

### Status Bar
- Shows current mode (AI or Manual)
- Connection status to backend
- Last saved timestamp

### Smooth UX
- Sliders with live value display
- Color pickers for easy selection
- Toggle switches for boolean settings
- Responsive design (mobile-friendly)

---

## Troubleshooting

### Settings Not Applying

**Check:**
1. Backend running: http://localhost:5000/api/health
2. Manual settings enabled: `curl http://localhost:5000/api/manual-settings/guest`
3. NovaCart using correct API: `apiEndpoint="http://localhost:5000/api"`
4. Browser console for errors

### Dashboard Not Loading

**Check:**
1. Navigate to: http://localhost:5000/dashboard/settings.html
2. Check browser console for CORS errors
3. Verify backend logs show dashboard route

### Changes Not Saving

**Check:**
1. MongoDB connected (backend logs)
2. Network tab shows PUT request succeeded
3. Response has `"success": true`

---

## Advanced Features

### Add More Settings

Edit `backend/mongodb/schemas.js`:
```javascript
const manualSettingsSchema = new mongoose.Schema({
  // ... existing fields
  customSetting: { type: String, default: 'value' }
});
```

Edit `dashboard/settings.html`:
```html
<div class="setting-group">
  <label class="setting-label">Custom Setting</label>
  <input type="text" id="customSetting" value="value">
</div>
```

Update save function:
```javascript
const settings = {
  // ... existing settings
  customSetting: document.getElementById('customSetting').value
};
```

### Per-Domain Settings

Modify API to support domain-specific overrides:
```javascript
GET /api/manual-settings/:userId?domain=example.com
```

### Export/Import Settings

Add endpoints:
```javascript
GET /api/manual-settings/:userId/export  // Returns JSON
POST /api/manual-settings/:userId/import // Accepts JSON
```

---

## Summary

**What It Does:**
- ✅ Dashboard for manual UI control
- ✅ Real-time preview of changes
- ✅ Auto-save with visual feedback
- ✅ Overrides AI personalization when enabled
- ✅ Works seamlessly with NPM package
- ✅ Easy switch between AI and manual modes

**Ready to use!**

1. Open http://localhost:5000/dashboard/settings.html
2. Switch to Manual Mode
3. Adjust settings (auto-saves)
4. Open your website with NPM package
5. Settings apply automatically! 🎉

---

## Files Created

- `backend/routes/manual-settings.js` - API endpoints
- `backend/mongodb/schemas.js` - ManualSettings schema added
- `dashboard/settings.html` - User dashboard
- `backend/api.js` - Route mounted
- `backend/routes/personalization.js` - Manual override logic
