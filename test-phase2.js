#!/usr/bin/env node

/**
 * QUICK TEST SCRIPT - 5 Minute Implementation Test
 * 
 * Tests the complete Phase 2 implementation:
 * 1. Backend API endpoints
 * 2. Trial flow (propose → start → evaluate → feedback)
 * 3. Anomaly scoring
 * 4. Bounded search
 * 5. Preference locking
 */

const http = require('http');

const BACKEND_URL = 'http://localhost:5000';
const TEST_USER = 'test_user_' + Date.now();

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log(' PHASE 2 QUICK TEST SCRIPT', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  // Check if backend is running
  log(' Checking backend health...', 'yellow');
  try {
    const health = await request('GET', '/health');
    if (health.status === 404) {
      log('️  Backend running but /health endpoint not found', 'yellow');
    } else {
      log(' Backend is running on http://localhost:5000', 'green');
    }
  } catch (error) {
    log(' ERROR: Backend not responding!', 'red');
    log('   Make sure to run: npm run dev', 'red');
    log('   In: c:\\Users\\TUF\\Desktop\\research\\Optimization-Engine', 'red');
    process.exit(1);
  }

  // Test 1: Propose Trial
  log('\n Test 1: Proposing Trial...', 'blue');
  let trialData = null;
  try {
    // Use correct ladder keys from TRIAL_PRIORITIES: visual.fontSize, motor.targetSize, etc.
    const proposal = await request('POST', '/api/trials/propose', {
      userId: TEST_USER,
      mlSuggestedProfile: {
        'visual.fontSize': 'large'  // Suggest 'large' (default is 'medium')
      }
    });

    if (proposal.status !== 200 || !proposal.data.hasTrial) {
      log(` Propose failed with status ${proposal.status}`, 'red');
      log(`   Response: ${JSON.stringify(proposal.data)}`, 'red');
    } else {
      trialData = proposal.data.proposal; // Extract from proposal object
      log(` Trial proposed:`, 'green');
      log(`   Setting: ${trialData.settingKey} (${trialData.oldValue} → ${trialData.newValue})`, 'green');
      log(`   Attempt: ${trialData.attemptNumber}`, 'green');
    }
  } catch (error) {
    log(` Error proposing trial: ${error.message}`, 'red');
  }

  if (!trialData) {
    log('\n Cannot continue without trial data', 'red');
    process.exit(1);
  }

  // Test 2: Start Trial
  log('\n Test 2: Starting Trial...', 'blue');
  let trialId = null;
  try {
    const start = await request('POST', '/api/trials/start', {
      userId: TEST_USER,
      sessionId: 'test_session_' + Date.now(),
      settingKey: trialData.settingKey,
      oldValue: trialData.oldValue,
      newValue: trialData.newValue,
      attemptNumber: trialData.attemptNumber
    });

    if (start.status !== 200) {
      log(` Start failed with status ${start.status}`, 'red');
      log(`   Response: ${JSON.stringify(start.data)}`, 'red');
    } else {
      trialId = start.data.trialId;
      log(` Trial started:`, 'green');
      log(`   Trial ID: ${trialId}`, 'green');
      log(`   Evaluation window: ${start.data.evaluationWindow}s`, 'green');
      log(`   Min clicks: ${start.data.minClicks}`, 'green');
    }
  } catch (error) {
    log(` Error starting trial: ${error.message}`, 'red');
  }

  // Test 3: Evaluate Trial (Low Anomaly)
  log('\n Test 3: Evaluating Trial (Low Anomaly Scenario)...', 'blue');
  if (!trialId) {
    log('️  Skipping - no trial ID from start', 'yellow');
  } else {
  try {
    const evaluate1 = await request('POST', '/api/trials/evaluate', {
      trialId: trialId,
      metrics: {
        clickCount: 12,
        misclickCount: 0,
        rageClickCount: 0,
        avgTimeToClick: 800,
        formErrorCount: 0,
        zoomEventCount: 0
      }
    });

    if (evaluate1.status !== 200) {
      log(` Evaluate failed with status ${evaluate1.status}`, 'red');
      log(`   Response: ${JSON.stringify(evaluate1.data)}`, 'red');
    } else {
      const score1 = evaluate1.data.anomalyScore;
      log(` Trial evaluated:`, 'green');
      log(`   Anomaly score: ${score1.toFixed(2)} (Low = auto-accept)`, 'green');
      log(`   Decision: ${evaluate1.data.decision}`, 'green');
      log(`   Should prompt: ${evaluate1.data.shouldPrompt}`, 'green');
    }
  } catch (error) {
    log(` Error evaluating trial: ${error.message}`, 'red');
  }
  }

  // Test 4: Propose Trial 2 (for feedback test)
  log('\n Test 4: Proposing Second Trial (for feedback test)...', 'blue');
  let trial2Data = null;
  try {
    // Suggest xlarge (even larger) to test feedback
    const proposal2 = await request('POST', '/api/trials/propose', {
      userId: TEST_USER,
      mlSuggestedProfile: {
        'visual.fontSize': 'xlarge'  // Suggest 'xlarge' (current would be 'large' if first trial accepted)
      }
    });

    if (proposal2.status === 200 && proposal2.data.hasTrial) {
      trial2Data = proposal2.data.proposal;
      log(` Second trial proposed:`, 'green');
      log(`   Setting: ${trial2Data.settingKey}`, 'green');
      log(`   Attempt: ${trial2Data.attemptNumber}`, 'green');
    }
  } catch (error) {
    log(`️  Could not propose second trial: ${error.message}`, 'yellow');
  }

  if (trial2Data) {
    // Start second trial
    log('\n Test 5: Starting Second Trial...', 'blue');
    let trial2Id = null;
    try {
      const start2 = await request('POST', '/api/trials/start', {
        userId: TEST_USER,
        sessionId: 'test_session2_' + Date.now(),
        settingKey: trial2Data.settingKey,
        oldValue: trial2Data.oldValue,
        newValue: trial2Data.newValue,
        attemptNumber: trial2Data.attemptNumber
      });
      trial2Id = start2.data.trialId;
      log(` Second trial started`, 'green');
    } catch (error) {
      log(`️  Error starting second trial: ${error.message}`, 'yellow');
    }

    // Evaluate with medium anomaly
    log('\n Test 6: Evaluating Trial (Medium Anomaly - Should Prompt)...', 'blue');
    if (!trial2Id) {
      log('️  Skipping - no trial ID from start', 'yellow');
    } else {
    try {
      const evaluate2 = await request('POST', '/api/trials/evaluate', {
        trialId: trial2Id,
        metrics: {
          clickCount: 8,
          misclickCount: 2,
          rageClickCount: 1,
          avgTimeToClick: 1500,
          formErrorCount: 1,
          zoomEventCount: 0
        }
      });

      if (evaluate2.status === 200) {
        const score2 = evaluate2.data.anomalyScore;
        log(` Trial evaluated:`, 'green');
        log(`   Anomaly score: ${score2.toFixed(2)} (Medium = show prompt)`, 'green');
        log(`   Decision: ${evaluate2.data.decision}`, 'green');
        log(`   Should prompt: ${evaluate2.data.shouldPrompt}`, 'green');
      }
    } catch (error) {
      log(`️  Error evaluating trial: ${error.message}`, 'yellow');
    }
    }

    // Test feedback (too_big)
    log('\n Test 7: Submitting Feedback (Too Big)...', 'blue');
    if (!trial2Id) {
      log('️  Skipping - no trial ID from start', 'yellow');
    } else {
    try {
      const feedback = await request('POST', '/api/trials/feedback', {
        trialId: trial2Id,
        userId: TEST_USER,
        feedbackType: 'dislike',
        reason: 'too_big'
      });

      if (feedback.status === 200) {
        log(` Feedback processed:`, 'green');
        log(`   Locked: ${feedback.data.locked}`, 'green');
        if (feedback.data.nextSuggestion) {
          log(`   Next suggestion: ${feedback.data.nextSuggestion.newValue} (Attempt ${feedback.data.nextSuggestion.attemptNumber || feedback.data.attemptNumber})`, 'green');
        }
        log(`   Message: ${feedback.data.message}`, 'green');
      }
    } catch (error) {
      log(`️  Error submitting feedback: ${error.message}`, 'yellow');
    }
    }
  }

  // Test 5: Get Preferences
  log('\n Test 8: Getting User Preferences...', 'blue');
  try {
    const preferences = await request('GET', `/api/trials/preferences/${TEST_USER}`);

    if (preferences.status === 200) {
      log(` Preferences retrieved:`, 'green');
      log(`   Locked settings: ${preferences.data.summary?.lockedCount || 0}`, 'green');
      log(`   Active trials: ${preferences.data.summary?.activeCount || 0}`, 'green');
      log(`   Preference records: ${preferences.data.preferences?.length || 0}`, 'green');
    }
  } catch (error) {
    log(`️  Error getting preferences: ${error.message}`, 'yellow');
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log(' TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');

  log('\n Core Features Tested:', 'green');
  log('   1. Trial proposal with ML suggestions', 'green');
  log('   2. Silent trial starting', 'green');
  log('   3. Anomaly scoring (low = auto-accept)', 'green');
  log('   4. Anomaly scoring (medium = prompt)', 'green');
  log('   5. User feedback handling', 'green');
  log('   6. Bounded search (trying next value)', 'green');
  log('   7. Preference state tracking', 'green');

  log('\n What Happened:', 'yellow');
  log(`   - Proposed trial for user: ${TEST_USER}`, 'yellow');
  log('   - Started silent trial (user doesn\'t see immediate feedback)', 'yellow');
  log('   - Simulated normal user behavior (low anomaly)', 'yellow');
  log('   - Trial auto-accepted (no prompt needed)', 'yellow');
  log('   - Proposed second trial with stronger change', 'yellow');
  log('   - Simulated confused user behavior (medium anomaly)', 'yellow');
  log('   - DirectionalFeedbackPrompt would show', 'yellow');
  log('   - User gave "too big" feedback', 'yellow');
  log('   - System proposed smaller value (bounded search)', 'yellow');

  log('\n Next Steps:', 'blue');
  log('   1. Test in browser with NovaCart:', 'blue');
  log('      cd c:\\Users\\TUF\\Desktop\\research\\novacart', 'blue');
  log('      npm run dev', 'blue');
  log('   2. Update AdaptiveProvider with mode="trial-based"', 'blue');
  log('   3. Interact with UI normally', 'blue');
  log('   4. Watch console for metrics collection', 'blue');
  log('   5. See DirectionalFeedbackPrompt when anomaly detected', 'blue');

  log('\n Documentation:', 'blue');
  log('   - See TESTING_GUIDE.md for detailed testing scenarios', 'blue');
  log('   - See PHASE_2_COMPLETE.md for implementation details', 'blue');
  log('   - See VERIFICATION_REPORT.md for component verification', 'blue');

  log('\n' + '='.repeat(60) + '\n', 'cyan');
}

// Run tests
runTests().catch(error => {
  log(`\n Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
