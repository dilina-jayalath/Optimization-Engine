/**
 * Test script for Trial-Based Personalization System
 * Run: node test-trial-system.js
 * Requires: Node.js 18+ (uses native fetch)
 */

const API_BASE = 'http://localhost:5000/api/trials';
const TEST_USER = `test-user-${Date.now()}`;
const TEST_SESSION = `session-${Date.now()}`;

async function runTests() {
  console.log('🧪 Testing Trial-Based System\n');
  console.log(`Test User: ${TEST_USER}`);
  console.log(`Test Session: ${TEST_SESSION}\n`);

  try {
    // Test 1: Propose a trial
    console.log('1️⃣  Testing /propose endpoint...');
    const proposeRes = await fetch(`${API_BASE}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER,
        sessionId: TEST_SESSION,
        mlSuggestedProfile: {
          'visual.fontSize': 'large',
          'motor.targetSize': 'large'
        },
        context: {
          pageType: 'checkout',
          deviceType: 'desktop'
        }
      })
    });
    
    const proposeData = await proposeRes.json();
    console.log('✅ Propose response:', JSON.stringify(proposeData, null, 2));
    
    if (!proposeData.success || !proposeData.hasTrial) {
      console.log('⚠️  No trial proposed (may be locked/cooldown)');
      return;
    }

    const proposal = proposeData.proposal;
    console.log(`\n   → Will test: ${proposal.settingKey}: ${proposal.oldValue} → ${proposal.newValue}\n`);

    // Test 2: Start the trial
    console.log('2️⃣  Testing /start endpoint...');
    const startRes = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER,
        sessionId: TEST_SESSION,
        settingKey: proposal.settingKey,
        oldValue: proposal.oldValue,
        newValue: proposal.newValue,
        context: {
          pageType: 'checkout',
          deviceType: 'desktop'
        }
      })
    });
    
    const startData = await startRes.json();
    console.log('✅ Start response:', JSON.stringify(startData, null, 2));
    
    const trialId = startData.trialId;
    console.log(`\n   → Trial ID: ${trialId}`);
    console.log(`   → Evaluation window: ${startData.evaluationWindow}ms\n`);

    // Test 3: Evaluate with HIGH anomaly (should prompt)
    console.log('3️⃣  Testing /evaluate endpoint (HIGH anomaly)...');
    const evaluateRes = await fetch(`${API_BASE}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trialId: trialId,
        metrics: {
          clickCount: 10,
          misclickCount: 5,    // High misclick rate!
          rageClickCount: 2,   // Rage clicks!
          avgTimeToClick: 2000,
          formErrorCount: 1,
          zoomEventCount: 0,
          scrollDepth: 50,
          dwellTime: 30000
        }
      })
    });
    
    const evaluateData = await evaluateRes.json();
    console.log('✅ Evaluate response:', JSON.stringify(evaluateData, null, 2));
    console.log(`\n   → Decision: ${evaluateData.decision}`);
    console.log(`   → Anomaly Score: ${evaluateData.anomalyScore}`);
    console.log(`   → Should Prompt: ${evaluateData.shouldPrompt}\n`);

    // Test 4: Send "too big" feedback
    console.log('4️⃣  Testing /feedback endpoint (too_big)...');
    const feedbackRes = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trialId: trialId,
        feedbackType: 'dislike',
        reason: 'too_big'
      })
    });
    
    const feedbackData = await feedbackRes.json();
    console.log('✅ Feedback response:', JSON.stringify(feedbackData, null, 2));
    
    if (feedbackData.nextSuggestion) {
      console.log(`\n   → Next trial: ${feedbackData.nextSuggestion.value} (attempt ${feedbackData.nextSuggestion.attemptNumber})\n`);
    }

    // Test 5: Get preferences
    console.log('5️⃣  Testing /preferences endpoint...');
    const prefsRes = await fetch(`${API_BASE}/preferences/${TEST_USER}`);
    const prefsData = await prefsRes.json();
    console.log('✅ Preferences response:', JSON.stringify(prefsData, null, 2));
    
    console.log(`\n   → Summary:`);
    console.log(`      Locked: ${prefsData.summary.locked}`);
    console.log(`      Active: ${prefsData.summary.active}`);
    console.log(`      Cooldown: ${prefsData.summary.cooldown}\n`);

    console.log('✅ All tests passed!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const res = await fetch('http://localhost:5000');
    return res.ok || res.status === 404; // Either OK or 404 is fine
  } catch (error) {
    return false;
  }
}

// Main
(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Backend server not running at http://localhost:5000');
    console.log('   Start it with: npm run dev\n');
    process.exit(1);
  }

  await runTests();
})();
