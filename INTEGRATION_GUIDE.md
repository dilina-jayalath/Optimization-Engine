# Integration Guide: Adding Real-Time Settings Sync to Your Project

## Overview

This guide shows how to add real-time settings synchronization to any React application using the AURA NPM package.

## Prerequisites

- React 17+ application
- AURA NPM package installed
- Backend with SSE endpoint (or use the Optimization-Engine backend)

## Installation

```bash
npm install @aura/aura-adaptor
# or
yarn add @aura/aura-adaptor
```

## Basic Integration (3 Steps)

### Step 1: Wrap Your App with AdaptiveProvider

```jsx
// src/App.jsx
import { AdaptiveProvider, useRealtimeUIUpdates } from '@aura/aura-adaptor';

function AppContent() {
  // This hook applies CSS variables automatically
  useRealtimeUIUpdates();
  
  return (
    <div>
      <h1>My App</h1>
      {/* Your app content */}
    </div>
  );
}

function App() {
  return (
    <AdaptiveProvider
      userId="user_123"
      apiEndpoint="http://localhost:5000/api"
      enableBehaviorTracking={true}
      debugMode={true}
    >
      <AppContent />
    </AdaptiveProvider>
  );
}

export default App;
```

**That's it!** Settings will now sync automatically when changed from the dashboard.

### Step 2: (Optional) Use Adaptive Components

Replace standard HTML elements with adaptive versions:

```jsx
import { 
  AdaptiveButton, 
  AdaptiveText, 
  AdaptiveCard 
} from '@aura/aura-adaptor';

function MyComponent() {
  return (
    <AdaptiveCard>
      <AdaptiveText variant="h1">Welcome</AdaptiveText>
      <AdaptiveText variant="body">
        This text adapts to user preferences automatically.
      </AdaptiveText>
      <AdaptiveButton onClick={() => alert('Clicked!')}>
        Click Me
      </AdaptiveButton>
    </AdaptiveCard>
  );
}
```

### Step 3: (Optional) Use CSS Variables in Your Styles

The adaptive tokens are available as CSS variables:

```css
/* src/styles.css */

.my-element {
  /* Typography */
  font-size: var(--aura-font-size-base);
  line-height: var(--aura-line-height);
  
  /* Colors */
  color: var(--aura-color-text);
  background: var(--aura-color-background);
  border: 1px solid var(--aura-color-border);
  
  /* Spacing */
  padding: var(--aura-spacing-padding);
  gap: var(--aura-spacing-gap);
  
  /* Interactive elements */
  min-width: var(--aura-target-size);
  min-height: var(--aura-target-size);
}

/* Theme-specific styles */
.aura-theme-dark .my-element {
  /* Dark theme overrides */
}

/* Reduced motion support */
.aura-reduced-motion .my-element {
  transition: none !important;
  animation: none !important;
}
```

## Advanced Integration

### Custom Settings Handling

```jsx
import { useAdaptive } from '@aura/aura-adaptor';

function CustomComponent() {
  const { profile, tokens, loading } = useAdaptive();
  
  if (loading) {
    return <div>Loading preferences...</div>;
  }
  
  return (
    <div style={{
      fontSize: tokens.typography.baseSize,
      color: tokens.colors.text,
      backgroundColor: tokens.colors.background,
    }}>
      {/* Your content */}
      
      <pre>
        Current Settings:
        - Font Size: {profile.font_size}
        - Theme: {profile.theme}
        - Contrast: {profile.contrast_mode}
      </pre>
    </div>
  );
}
```

### Manual Settings Sync Control

```jsx
import { useSettingsSync } from '@aura/aura-adaptor';

function SettingsDebugger() {
  const { isConnected, lastUpdate, reconnect } = useSettingsSync({
    userId: 'user_123',
    apiEndpoint: 'http://localhost:5000/api',
    enabled: true,
    onSettingsUpdate: (settings, source) => {
      console.log('Settings updated:', settings);
      console.log('Source:', source);
    },
    onConnect: () => console.log('Connected!'),
    onError: (error) => console.error('Error:', error),
  });
  
  return (
    <div>
      <p>Connection: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <p>Last Update: {lastUpdate?.toLocaleTimeString()}</p>
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}
```

### Custom Feedback Prompt Position

```jsx
import { AdaptiveProvider } from '@aura/aura-adaptor';

function App() {
  return (
    <AdaptiveProvider
      userId="user_123"
      apiEndpoint="http://localhost:5000/api"
      // Feedback prompt will appear top-right (default)
      // Customize by editing AdaptiveSettingsChangePrompt props in provider
    >
      {/* Your app */}
    </AdaptiveProvider>
  );
}
```

## Backend Setup

### Option 1: Use Existing Optimization-Engine Backend

Just point your app to the backend:

```jsx
<AdaptiveProvider apiEndpoint="http://your-backend:5000/api">
```

### Option 2: Add SSE to Your Own Backend

**Express.js Example:**

```javascript
// server.js
const express = require('express');
const app = express();

// Store active SSE connections
const connections = new Map();

// SSE endpoint
app.get('/api/settings-events/:userId', (req, res) => {
  const { userId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId).add(res);
  
  res.write('data: {"type":"connected"}\n\n');
  
  req.on('close', () => {
    connections.get(userId)?.delete(res);
  });
});

// Settings update endpoint
app.put('/api/settings/:userId', (req, res) => {
  const { userId } = req.params;
  const settings = req.body;
  
  // Save to database...
  
  // Broadcast to connected clients
  const userConnections = connections.get(userId);
  if (userConnections) {
    const data = `data: ${JSON.stringify({
      type: 'settings_update',
      userId,
      settings,
      source: 'manual',
    })}\n\n`;
    
    userConnections.forEach(clientRes => {
      clientRes.write(data);
    });
  }
  
  res.json({ success: true });
});

app.listen(5000);
```

## Environment Configuration

```env
# .env
REACT_APP_API_ENDPOINT=http://localhost:5000/api
REACT_APP_USER_ID=user_123
```

```jsx
// src/App.jsx
const apiEndpoint = process.env.REACT_APP_API_ENDPOINT;
const userId = process.env.REACT_APP_USER_ID;

<AdaptiveProvider 
  apiEndpoint={apiEndpoint} 
  userId={userId}
>
```

## TypeScript Support

```typescript
// src/App.tsx
import { 
  AdaptiveProvider, 
  useAdaptive,
  AuraProfile,
  AuraTokens 
} from '@aura/aura-adaptor';

function TypedComponent() {
  const { profile, tokens } = useAdaptive();
  
  const fontSizeValue: string = profile?.font_size || 'medium';
  const textColor: string = tokens.colors.text;
  
  return <div style={{ fontSize: fontSizeValue, color: textColor }}>
    Fully typed!
  </div>;
}
```

## Testing

### Unit Tests

```jsx
// Component.test.jsx
import { render } from '@testing-library/react';
import { AdaptiveProvider } from '@aura/aura-adaptor';

test('renders with adaptive provider', () => {
  const { getByText } = render(
    <AdaptiveProvider 
      userId="test_user"
      apiEndpoint=""  // Disable SSE in tests
      simulateExtensionInstalled={false}
    >
      <MyComponent />
    </AdaptiveProvider>
  );
  
  expect(getByText('Hello')).toBeInTheDocument();
});
```

### E2E Tests

```javascript
// cypress/e2e/settings-sync.cy.js
describe('Settings Sync', () => {
  it('updates UI when settings change', () => {
    cy.visit('http://localhost:5173');
    
    // Trigger settings change via API
    cy.request('PUT', 'http://localhost:5000/api/settings/user_123', {
      fontSize: 'x-large',
      theme: 'dark',
    });
    
    // Wait for SSE to propagate
    cy.wait(1000);
    
    // Verify feedback prompt appears
    cy.contains('Settings Updated').should('be.visible');
    
    // Verify styles applied
    cy.get('body').should('have.class', 'aura-theme-dark');
  });
});
```

## Production Deployment

### Security Checklist

- [ ] Use HTTPS for SSE connections
- [ ] Add authentication to SSE endpoint
- [ ] Validate userId on server
- [ ] Rate limit settings updates
- [ ] Sanitize settings values
- [ ] Configure CORS properly

### Performance Optimization

```javascript
// Debounce settings updates
const debouncedUpdate = debounce((settings) => {
  applySettings(settings);
}, 300);
```

### Monitoring

```javascript
// Add error tracking
window.addEventListener('error', (event) => {
  if (event.message.includes('SSE')) {
    // Log to monitoring service
    console.error('SSE Error:', event);
  }
});
```

## Common Use Cases

### 1. E-commerce Site (like NovaCart)

```jsx
import { AdaptiveProvider, AdaptiveButton, AdaptiveCard } from '@aura/aura-adaptor';

function ProductCard({ product }) {
  return (
    <AdaptiveCard>
      <h3>{product.name}</h3>
      <p>{product.price}</p>
      <AdaptiveButton>Add to Cart</AdaptiveButton>
    </AdaptiveCard>
  );
}

function App() {
  return (
    <AdaptiveProvider userId={currentUser.id} apiEndpoint="/api">
      <ProductList />
    </AdaptiveProvider>
  );
}
```

### 2. Dashboard Application

```jsx
function Dashboard() {
  const { tokens } = useAdaptive();
  
  return (
    <div style={{
      fontSize: tokens.typography.baseSize,
      backgroundColor: tokens.colors.background,
      padding: tokens.spacing.pagePadding,
    }}>
      <nav>Navigation adapts to user preferences</nav>
      <main>Content scales dynamically</main>
    </div>
  );
}
```

### 3. Accessibility-First App

```jsx
function AccessibleApp() {
  const { profile } = useAdaptive();
  
  return (
    <div
      role="main"
      aria-label="Application"
      data-reduced-motion={profile?.reduced_motion}
      data-high-contrast={profile?.contrast_mode === 'high'}
    >
      {/* Screen readers and keyboard navigation work perfectly */}
    </div>
  );
}
```

## Troubleshooting

### Settings Don't Update

**Check:**
1. Is `apiEndpoint` set correctly?
2. Is backend SSE endpoint working? (Check Network tab)
3. Are CORS headers correct?

### Feedback Prompt Not Showing

**Check:**
1. Is `AdaptiveProvider` wrapping your app?
2. Check z-index conflicts
3. Verify settings actually changed

### Performance Issues

**Solutions:**
1. Debounce rapid updates
2. Memoize expensive calculations
3. Use React.memo for components
4. Check for unnecessary re-renders

## FAQ

**Q: Do I need the full Optimization-Engine backend?**  
A: No, you just need an SSE endpoint. See "Backend Setup" above.

**Q: Can I use this with Next.js?**  
A: Yes! Wrap `_app.js` with `AdaptiveProvider`. SSE works in browser only.

**Q: Does this work on mobile?**  
A: Yes, SSE is supported on all modern mobile browsers.

**Q: How do I disable settings sync temporarily?**  
A: Set `apiEndpoint=""` or remove it from props.

**Q: Can multiple users share the same browser?**  
A: Yes, change `userId` prop when users switch accounts.

**Q: How much data does SSE use?**  
A: Very little! Initial connection ~2KB, updates ~500 bytes each.

## Resources

- [Full Documentation](REALTIME_SETTINGS_SYNC.md)
- [Architecture Diagram](SETTINGS_SYNC_DIAGRAM.md)
- [Quick Test Guide](QUICK_TEST_SETTINGS_SYNC.md)
- [API Reference](NPM-Package/README.md)

## Examples

See the `novacart` folder for a complete working example.

## Support

For issues or questions:
1. Check browser console for errors
2. Check backend logs
3. Review documentation
4. Open an issue on GitHub

---

**Happy Coding! 🚀**
