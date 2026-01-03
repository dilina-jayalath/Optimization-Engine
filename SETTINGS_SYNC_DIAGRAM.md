# Settings Sync Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME SETTINGS SYNC FLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: User Changes Settings in Dashboard
┌─────────────────────────┐
│   Dashboard (Vite)      │
│  localhost:5174         │
├─────────────────────────┤
│ ManualSettingsControl   │
│  - Font Size: x-large   │
│  - Theme: dark          │
│  - Contrast: high       │
│  - Target Size: 28      │
│         [Save]          │
└───────────┬─────────────┘
            │ PUT /api/manual-settings/:userId
            ▼

STEP 2: Backend Updates & Broadcasts
┌─────────────────────────┐
│   Backend (Express)     │
│   localhost:5000        │
├─────────────────────────┤
│ 1. Save to MongoDB      │
│ 2. Update User model    │
│ 3. broadcastSettings    │
│    Update()             │
└──────────┬──────────────┘
           │
           ▼ SSE Push (Server-Sent Events)
     ┌─────────────┐
     │  EventStream │
     │  settings-   │
     │  events/u001 │
     └─────┬────────┘
           │
           │ Real-time push to all connected clients
           ▼

STEP 3: NovaCart Receives & Applies Settings
┌─────────────────────────────────────────────────────┐
│            NovaCart Website (Vite)                  │
│            localhost:5173                           │
├─────────────────────────────────────────────────────┤
│  AdaptiveProvider                                   │
│    └─ useSettingsSync()                            │
│         └─ EventSource connection open             │
│                                                     │
│  Message received: settings_update                  │
│    └─ handleSettingsUpdate()                       │
│         ├─ Map to AuraProfile                      │
│         ├─ setProfile(updated)                     │
│         ├─ setTokens(derived)                      │
│         └─ setShowSettingsPrompt(true)            │
│                                                     │
│  UI automatically re-renders with:                  │
│    - Font size increased ✓                         │
│    - Dark theme applied ✓                          │
│    - Higher contrast ✓                             │
│    - Larger touch targets ✓                        │
└─────────────────────────────────────────────────────┘
           │
           │ Feedback prompt appears
           ▼
┌─────────────────────────────────────────────┐
│  AdaptiveSettingsChangePrompt               │
│  (Top-right corner)                         │
├─────────────────────────────────────────────┤
│  🎨 Settings Updated                        │
│  Changed by Dashboard                       │
│                                             │
│  Show changes (4)                           │
│                                             │
│  How do these changes feel?                 │
│  [👍 Better] [😐 Same] [👎 Worse]          │
└───────────────┬─────────────────────────────┘
                │
                │ User clicks feedback
                ▼

STEP 4: Feedback Sent to Backend
┌─────────────────────────┐
│   Feedback API          │
│   POST /api/users/      │
│   :userId/feedback      │
├─────────────────────────┤
│ {                       │
│   parameter: 'settings_│
│              sync',     │
│   feedback: {           │
│     type: 'positive',   │
│     rating: 5,          │
│     comment: ''         │
│   },                    │
│   context: {            │
│     source: 'settings_  │
│             sync'       │
│   }                     │
│ }                       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  ML Training Pipeline   │
│  (Future enhancement)   │
├─────────────────────────┤
│  - Learn from feedback  │
│  - Improve predictions  │
│  - Personalize better   │
└─────────────────────────┘


KEY TECHNOLOGIES:
═══════════════════

Backend:
  - Express.js for API
  - Server-Sent Events (SSE) for real-time push
  - MongoDB for persistence
  - In-memory connection map

NPM Package:
  - EventSource API (native SSE client)
  - React hooks (useSettingsSync)
  - Auto-reconnection logic
  - State management (useState, useCallback)

NovaCart:
  - AdaptiveProvider wraps entire app
  - CSS variables for dynamic theming
  - useRealtimeUIUpdates hook applies tokens


CONNECTION LIFECYCLE:
═══════════════════

1. NovaCart loads → AdaptiveProvider mounts
2. useSettingsSync creates EventSource
3. Backend accepts SSE connection
4. Connection stored in Map: userId → Set<Response>
5. Dashboard changes settings
6. Backend broadcasts to all connections in Set
7. NovaCart receives message via EventSource.onmessage
8. Settings applied + feedback prompt shown
9. User provides feedback → sent to backend
10. Feedback stored + used for ML training


ERROR HANDLING:
═══════════════

Network Error:
  SSE connection drops → EventSource.onerror
  → Exponential backoff (1s, 2s, 4s, 8s, max 30s)
  → Auto-reconnect

Settings Apply Error:
  → Log error to console
  → Don't crash app
  → Keep previous settings

Feedback Submit Error:
  → Log error
  → Allow user to continue
  → No retry (feedback is optional)


MONITORING:
═══════════

Browser Console:
  [AURA SSE] Connection opened
  [AURA SSE] Received event: settings_update
  [AURA] Received settings update from dashboard

Backend Console:
  [SSE] Client connected for user u_001 (total: 1)
  [Manual Settings] Updating settings for userId=u_001
  [SSE] Broadcasted settings update to 1 client(s)

Network Tab:
  GET /api/settings-events/u_001 [pending]
  Type: eventsource
  Status: 200 (streaming)


BENEFITS:
═════════

✅ Instant Updates - No polling, no refresh needed
✅ Efficient - Push only when changes occur
✅ Multi-Tab - All tabs update simultaneously
✅ Feedback Loop - Immediate user validation
✅ ML Ready - Feedback trains AI model
✅ Scalable - Lightweight SSE connections
✅ Resilient - Auto-reconnects on failure


COMPARISON TO ALTERNATIVES:
═══════════════════════════

WebSockets:
  ❌ Overkill for one-way push
  ❌ More complex to implement
  ❌ Requires socket.io or similar
  ✅ SSE simpler and sufficient

Polling:
  ❌ Wastes resources (constant requests)
  ❌ Higher latency (poll interval)
  ❌ Scales poorly
  ✅ SSE more efficient

Long Polling:
  ❌ Still makes repeated connections
  ❌ Timeout issues
  ✅ SSE built for this use case

SSE (Server-Sent Events):
  ✅ Native browser API
  ✅ One-way push (perfect fit)
  ✅ Auto-reconnects
  ✅ Simple to implement
  ✅ Efficient for updates


SCALABILITY:
════════════

Per User:
  - 1 SSE connection per tab/browser
  - ~2KB memory per connection
  - Multiple tabs = multiple connections

Per Server:
  - Can handle 1000+ concurrent SSE connections
  - Memory scales linearly
  - CPU usage minimal (push only on change)

Optimization:
  - Connection pooling per userId
  - Expire idle connections (timeout)
  - Use Redis for multi-server sync (future)
```
