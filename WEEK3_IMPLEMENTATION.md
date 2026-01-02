# Week 3: Profiles, Revert Analytics, Multi-Session Insights

## Status: IMPLEMENTED ✅

### New Capabilities
- **Accessibility Profiles**: Store per-user context (visual, motor, cognitive) for personalization.
- **Automatic Revert Handling**: Explicit revert sends strong negative feedback to Thompson Sampling.
- **Revert Analytics**: Revert rate and last-revert timestamps per user.
- **Pattern Detection**: Python service surfaces high-risk sessions and global revert rate.

---

## What Changed
- **Profile API** (`backend/routes/profiles.js`)
  - `GET /api/profiles/:userId` — fetch or create profile
  - `PUT /api/profiles/:userId` — update accessibility context
  - `POST /api/profiles/:userId/revert` — increment revert count
- **Personalization** (`backend/routes/personalization.js`)
  - Uses profile context for Thompson Sampling
  - Revert endpoint records revert + sends negative feedback to TS
- **Behavior Analytics** (`backend/routes/behavior.js`)
  - Explicit `reward`/`confidence` fields on logs
  - `GET /api/behavior/:userId/revert-stats` — revert rate, avg reward
- **Implicit Reward Service** (`python_rl_service/flask_api.py`)
  - `GET /patterns` — total sessions, revert rate, top high-risk sessions
- **Integration Test** (`test/test_week3_flow.js`)
  - Profile setup → personalization → revert signal → analytics → patterns

---

## How to Run

### Start Services (3 terminals)
```bash
# Terminal 1: Express
cd C:\Users\TUF\Desktop\research\Optimization-Engine
npm run dev

# Terminal 2: Implicit Reward (port 5001)
cd C:\Users\TUF\Desktop\research\Optimization-Engine\python_rl_service
python flask_api.py

# Terminal 3: Personalization (port 5002)
cd C:\Users\TUF\Desktop\research\Optimization-Engine\python_rl_service
python personalization_service.py
```

### Run Week 3 Test
```bash
cd C:\Users\TUF\Desktop\research\Optimization-Engine
node test\test_week3_flow.js
```

Expected: profile saved, personalization served, revert recorded, revert stats increase, patterns endpoint reachable.

---

## Endpoints Reference

**Profiles**
- `GET /api/profiles/:userId`
- `PUT /api/profiles/:userId`
- `POST /api/profiles/:userId/revert`

**Personalization**
- `GET /api/personalization?userId=...&mode=explore|exploit`
- `POST /api/personalization/revert`

**Behavior Analytics**
- `GET /api/behavior/:userId/revert-stats?windowDays=30`

**Implicit Reward Service (Python)**
- `GET http://localhost:5001/patterns`

---

## Notes
- Profiles feed Week 2 Thompson Sampling with real context.
- Revert signals now penalize the selected arm automatically.
- Use `windowDays` in revert-stats to inspect recent regressions.
- Patterns endpoint highlights sessions with low rewards or immediate reverts.
