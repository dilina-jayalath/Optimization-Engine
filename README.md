# Adaptive UI Optimization Engine

## 🎯 Three Personalization Systems

This project implements **three complementary personalization approaches**:

### 1. Thompson Sampling System (Weeks 2-4)
- **Type**: Continuous multi-arm bandit optimization
- **Approach**: Explores all settings simultaneously
- **Feedback**: Binary (👍/👎) after 30s delay
- **Use Case**: General personalization & learning

### 2. Trial-Based System (Phase 1 Complete)
- **Type**: Anomaly-driven bounded search with preference locking
- **Approach**: Tests one setting at a time, only when problems detected
- **Feedback**: Directional (too big/small/other)
- **Use Case**: Safe testing of ML suggestions + preference discovery

### 3. Real-Time Settings Sync (NEW - ✅ Complete)
- **Type**: Dashboard-to-website instant synchronization
- **Approach**: Server-Sent Events (SSE) push updates
- **Feedback**: Immediate user reaction (👍/😐/👎)
- **Use Case**: Manual settings changes apply instantly to all client websites

> **Latest Feature**: Real-time sync allows dashboard changes to instantly apply to websites (like NovaCart) with automatic feedback collection.

---

## 🚀 Quick Start

### Trial-Based System

```bash
# 1. Start backend
npm run dev

# 2. Run tests
node test-trial-system.js

# Expected: ✅ All tests passed!
```

### Real-Time Settings Sync

```bash
# 1. Start backend
node backend/api.js

# 2. Start NovaCart (in another terminal)
cd novacart && npm run dev

# 3. Start Dashboard (in another terminal)
cd dashboard && npm run dev

# 4. Change settings in dashboard → Watch NovaCart update instantly!
```

**Documentation**:
- 📘 [Trial System Guide](TRIAL_BASED_SYSTEM.md) - Complete trial-based system
- 🔄 [Settings Sync Guide](REALTIME_SETTINGS_SYNC.md) - Real-time sync documentation
- 📊 [Architecture Diagram](SETTINGS_SYNC_DIAGRAM.md) - Visual flow diagram
- ⚡ [Quick Test](QUICK_TEST_SETTINGS_SYNC.md) - Step-by-step testing
- 🔌 [Integration Guide](INTEGRATION_GUIDE.md) - Use in your project
- 📋 [Implementation Summary](IMPLEMENTATION_SUMMARY_SETTINGS_SYNC.md) - What was built

---

## Original Architecture

Your proprietary optimization engine that combines:
- **ML Predictions** (category-wise + user-wise profiles)
- **Reinforcement Learning** (Q-Learning algorithm)
- **Adaptive Optimization** (user feedback + manual overrides)
- **User Dashboard** (undo/redo, analytics, settings management)
- **Real-Time Sync** (SSE-based instant updates)

---

## Architecture

```
┌─────────────────────────────────────────┐
│   Your Optimization Engine              │
│                                         │
│   ┌─────────────────────────────────┐  │
│   │  ML Pipeline                    │  │
│   │  - category-wise.json           │  │
│   │  - user-wise.json               │  │
│   └──────────┬──────────────────────┘  │
│              ▼                          │
│   ┌─────────────────────────────────┐  │
│   │  RL Engine (Q-Learning)         │  │
│   │  - Choose actions               │  │
│   │  - Calculate rewards            │  │
│   │  - Update Q-tables              │  │
│   └──────────┬──────────────────────┘  │
│              ▼                          │
│   ┌─────────────────────────────────┐  │
│   │  Adaptive Optimizer             │  │
│   │  - Apply settings               │  │
│   │  - Collect feedback             │  │
│   │  - Handle overrides             │  │
│   └─────────────────────────────────┘  │
└─────────────┬───────────────────────────┘
              │
              ▼
    ┌──────────────────────┐
    │  Backend API         │
    │  (MongoDB Storage)   │
    └──────────────────────┘
              │
              ▼
    ┌──────────────────────┐
    │  User Dashboard      │
    │  (Undo/Redo/View)    │
    └──────────────────────┘
```

---

## Quick Start

### 1. Install MongoDB
```bash
# Local: https://www.mongodb.com/try/download/community
# OR Cloud: https://www.mongodb.com/cloud/atlas (Free)
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create `.env`:
```
MONGODB_URI=mongodb://localhost:27017/optimization-engine
PORT=5000
```

### 4. Start Backend
```bash
npm run backend
```

### 5. Run Your Engine
```bash
npm run engine
```

### 6. Open Dashboard
```
http://localhost:5000/dashboard
```

---

## Files

### Core Engine
- `engine/RLEngine.js` - Q-Learning algorithm (YOUR LOGIC)
- `engine/MLIntegration.js` - Load ML predictions
- `engine/AdaptiveOptimizer.js` - Main optimization logic
- `engine/RewardCalculator.js` - Calculate rewards from feedback
- `engine/QTableManager.js` - Manage Q-tables

### Backend
- `backend/api.js` - REST API endpoints
- `backend/mongodb/schemas.js` - MongoDB schemas
- `backend/mongodb/service.js` - Database operations

### Dashboard
- `dashboard/index.html` - User dashboard
- `dashboard/app.js` - Dashboard logic

### Data
- `data/category-wise.json` - ML predictions (category)
- `data/user-wise.json` - ML predictions (user)

---

## Usage

```javascript
const { AdaptiveOptimizer } = require('./engine/AdaptiveOptimizer');

// Initialize
const optimizer = new AdaptiveOptimizer({
  userId: 'user_123',
  apiUrl: 'http://localhost:5000/api'
});

// Load ML predictions
await optimizer.loadMLProfiles(categoryWise, userWise);

// Run RL optimization
const optimizedSettings = await optimizer.optimize();

// Apply to UI (you can use any UI library)
applyToUI(optimizedSettings);

// Collect feedback
await optimizer.submitFeedback('positive');

// Q-table is automatically updated and synced to MongoDB
```

---

## Features

✅ **Q-Learning** - YOUR RL algorithm with exploration/exploitation
✅ **ML Integration** - Merge category-wise + user-wise predictions  
✅ **User Feedback** - Positive/Neutral/Negative feedback
✅ **Manual Overrides** - User can override any setting
✅ **Undo/Redo** - Full history with cross-session support
✅ **Analytics** - Track performance and user behavior
✅ **MongoDB Storage** - Persistent Q-tables and history
✅ **Dashboard** - Visual interface for management

---

## MongoDB Collections

- **users** - User settings and ML profiles
- **qtables** - Q-Learning tables (per parameter)
- **settings_history** - Change history (undo/redo)
- **feedback** - User feedback records
- **optimization_events** - Analytics events

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users/:id` | GET | Get user data |
| `/api/users/:id/optimize` | POST | Run optimization |
| `/api/users/:id/feedback` | POST | Submit feedback |
| `/api/users/:id/undo` | POST | Undo last change |
| `/api/users/:id/redo` | POST | Redo last undo |
| `/api/users/:id/qtables` | GET | Get Q-tables |
| `/api/users/:id/dashboard` | GET | Dashboard data |

---

## Development

```bash
# Run backend in dev mode
npm run dev

# Test RL algorithm
npm run test:rl

# View Q-tables
npm run view:qtables

# Reset user data
npm run reset:user <userId>
```

---

## Deployment

See `DEPLOYMENT.md` for production deployment guide.

---

## License

Proprietary - Your Organization
