# 🚀 Quick Start Guide

Your Adaptive UI Optimization Engine (ML + RL + User Feedback)

---

## Step 1: Install MongoDB

**Option A: Local** 
Download from https://www.mongodb.com/try/download/community

**Option B: Cloud (Free)**
Sign up at https://www.mongodb.com/cloud/atlas

---

## Step 2: Setup

```powershell
# Install dependencies
npm install

# Create environment file
copy .env.example .env

# Edit .env and set your MongoDB URI
```

---

## Step 3: Start Backend

```powershell
npm run backend
```

Expected output:
```
✅ Connected to MongoDB
🚀 API server running on http://localhost:5000
```

---

## Step 4: Run Your Optimizer

```powershell
# In another terminal
npm run engine
```

This will:
1. Load ML profiles (category-wise + user-wise)
2. Run RL Q-Learning optimization
3. Apply optimized settings
4. Collect feedback
5. Update Q-tables
6. Sync to MongoDB

---

## Step 5: View Dashboard

Open: `http://localhost:5000/dashboard`

Features:
- Current settings
- Undo/Redo buttons
- Change history
- Q-Learning statistics
- User analytics

---

## File Structure

```
adaptive-ui-optimizer/
├── engine/
│   ├── RLEngine.js           # YOUR Q-Learning algorithm
│   ├── MLIntegration.js      # Load ML profiles
│   ├── RewardCalculator.js   # Calculate rewards
│   └── AdaptiveOptimizer.js  # Main optimizer
│
├── backend/
│   ├── api.js                # REST API
│   └── mongodb/
│       ├── schemas.js        # MongoDB schemas
│       └── service.js        # DB operations
│
├── dashboard/
│   └── index.html            # User dashboard
│
├── data/
│   ├── category-wise.json    # ML predictions (category)
│   └── user-wise.json        # ML predictions (user)
│
└── examples/
    └── run-optimizer.js      # Demo script
```

---

## Usage in Your App

```javascript
const { AdaptiveOptimizer } = require('./engine/AdaptiveOptimizer');

// Initialize
const optimizer = new AdaptiveOptimizer({
  userId: 'user_123',
  apiUrl: 'http://localhost:5000/api'
});

// Load ML profiles from your ML pipeline
await optimizer.loadMLProfiles(
  'data/category-wise.json',
  'data/user-wise.json'
);

// Run RL optimization
const settings = await optimizer.optimize();
// { fontSize: 'x-large', theme: 'dark', ... }

// Apply to your UI (however you want)
document.body.style.fontSize = settings.fontSize;

// Collect user feedback
await optimizer.submitFeedback('positive');

// Q-table automatically updated and synced to MongoDB
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users/:id` | GET | Get user data |
| `/api/users/:id/settings` | POST | Update settings |
| `/api/users/:id/feedback` | POST | Submit feedback |
| `/api/users/:id/undo` | POST | Undo last change |
| `/api/users/:id/redo` | POST | Redo |
| `/api/users/:id/qtables` | GET | Get Q-tables |
| `/api/users/:id/dashboard` | GET | Dashboard data |

---

## What's Included

✅ **YOUR RL Engine** - Q-Learning with epsilon-greedy exploration  
✅ **YOUR ML Integration** - Merge category + user profiles  
✅ **YOUR Reward Calculator** - Smart reward calculation  
✅ **YOUR Adaptive Optimizer** - Main optimization logic  
✅ **MongoDB Backend** - Store Q-tables, history, feedback  
✅ **User Dashboard** - Undo/redo, view settings, analytics  

---

## Next Steps

1. ✅ Run `npm run backend`
2. ✅ Run `npm run engine` 
3. ✅ Check dashboard: `http://localhost:5000/dashboard`
4. ⏭️ Integrate into your app
5. ⏭️ Customize ML profiles
6. ⏭️ Deploy to production

---

Need help? Check README.md for full documentation.
