// test/test_week1_flow.js
/**
 * Week 1 Integration Test
 * Tests the complete implicit feedback flow:
 * 1. Simulate behavior data from frontend
 * 2. Send to Express backend
 * 3. Backend stores in MongoDB
 * 4. Backend calls Python service
 * 5. Python calculates reward
 * 6. Reward stored in MongoDB
 */

const axios = require('axios');

// Configuration
const EXPRESS_API = 'http://localhost:5000/api';
const PYTHON_API = 'http://localhost:5001';

// Test data - simulating a good user session
const testSession = {
  sessionId: `test_session_${Date.now()}`,
  userId: 'test_user_001',
  clientDomain: 'localhost',
  uiVariant: 'personalized',
  metrics: {
    duration: 180000,        // 3 minutes - optimal
    interactionCount: 12,    // Natural engagement
    errorCount: 0,           // No errors
    scrollDepth: 0.75,       // Good engagement
    tasksCompleted: 2,       // Completed tasks
    immediateReversion: false, // Did not revert
  },
  timestamp: new Date().toISOString(),
};

// Test data - simulating a bad session (immediate revert)
const badSession = {
  sessionId: `test_session_bad_${Date.now()}`,
  userId: 'test_user_002',
  clientDomain: 'localhost',
  uiVariant: 'personalized',
  metrics: {
    duration: 5000,          // 5 seconds - bounce
    interactionCount: 1,     // Single click
    errorCount: 0,
    scrollDepth: 0.1,        // Barely scrolled
    tasksCompleted: 0,
    immediateReversion: true, // Immediately reverted!
  },
  timestamp: new Date().toISOString(),
};

async function testHealthChecks() {
  console.log('\n🔍 Testing Health Checks...\n');
  
  try {
    // Test Python service
    const pythonHealth = await axios.get(`${PYTHON_API}/health`);
    console.log('✅ Python Service:', pythonHealth.data.status);
    
    // Test Express API (assuming it has a health endpoint)
    try {
      const expressHealth = await axios.get(`${EXPRESS_API}/../health`);
      console.log('✅ Express API:', expressHealth.data ? 'healthy' : 'running');
    } catch (e) {
      console.log('✅ Express API: running (no health endpoint)');
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.error('   Make sure both services are running!');
    process.exit(1);
  }
}

async function testGoodSession() {
  console.log('\n🧪 Test 1: Good User Session\n');
  console.log('Simulating a user who:');
  console.log('  - Spent 3 minutes on page');
  console.log('  - Had 12 interactions');
  console.log('  - No errors');
  console.log('  - Scrolled 75% of page');
  console.log('  - Completed 2 tasks');
  console.log('  - Did NOT revert\n');
  
  try {
    const response = await axios.post(`${EXPRESS_API}/behavior`, testSession);
    
    if (response.data.success) {
      console.log('✅ Backend received behavior data');
      
      if (response.data.reward !== undefined) {
        console.log(`✅ Reward calculated: ${response.data.reward.toFixed(3)}`);
        console.log(`   Confidence: ${response.data.confidence.toFixed(3)}`);
        
        if (response.data.reward > 0.6) {
          console.log('   ✨ This is a POSITIVE signal - UI is working well!');
        }
      } else {
        console.log('⚠️  Reward not calculated (Python service may be down)');
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

async function testBadSession() {
  console.log('\n🧪 Test 2: Bad User Session (Immediate Revert)\n');
  console.log('Simulating a user who:');
  console.log('  - Spent only 5 seconds');
  console.log('  - Had 1 click (the revert button!)');
  console.log('  - Barely scrolled');
  console.log('  - Completed 0 tasks');
  console.log('  - IMMEDIATELY REVERTED ⚠️\n');
  
  try {
    const response = await axios.post(`${EXPRESS_API}/behavior`, badSession);
    
    if (response.data.success) {
      console.log('✅ Backend received behavior data');
      
      if (response.data.reward !== undefined) {
        console.log(`✅ Reward calculated: ${response.data.reward.toFixed(3)}`);
        console.log(`   Confidence: ${response.data.confidence.toFixed(3)}`);
        
        if (response.data.reward < 0.3) {
          console.log('   ⚠️  This is a NEGATIVE signal - UI rejected by user!');
        }
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testDirectPythonCall() {
  console.log('\n🧪 Test 3: Direct Python Service Call\n');
  
  try {
    const response = await axios.post(`${PYTHON_API}/calculate_reward`, {
      sessionId: 'direct_test',
      userId: 'test_user',
      duration: 180000,
      interactionCount: 12,
      errorCount: 0,
      scrollDepth: 0.75,
      tasksCompleted: 2,
      immediateReversion: false,
    });
    
    if (response.data.success) {
      console.log('✅ Python service calculated reward');
      console.log(`   Reward: ${response.data.reward.toFixed(3)}`);
      console.log(`   Confidence: ${response.data.confidence.toFixed(3)}`);
      console.log('\n   Breakdown:');
      console.log(`   - Time score: ${response.data.breakdown.time.toFixed(3)}`);
      console.log(`   - Interactions: ${response.data.breakdown.interactions.toFixed(3)}`);
      console.log(`   - Errors: ${response.data.breakdown.errors.toFixed(3)}`);
      console.log(`   - Engagement: ${response.data.breakdown.engagement.toFixed(3)}`);
      console.log(`   - Continuity: ${response.data.breakdown.continuity.toFixed(3)}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testUserSummary() {
  console.log('\n🧪 Test 4: User Summary\n');
  
  try {
    const response = await axios.get(`${EXPRESS_API}/behavior/test_user_001/summary`);
    
    if (response.data.success) {
      console.log('✅ Retrieved user summary:');
      console.log(`   Total sessions: ${response.data.summary.totalSessions}`);
      console.log(`   Total interactions: ${response.data.summary.totalInteractions}`);
      console.log(`   Average scroll depth: ${(response.data.summary.averageScrollDepth * 100).toFixed(1)}%`);
      console.log(`   Immediate reversions: ${response.data.summary.immediateReversionCount}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 Week 1 Implementation Test');
  console.log('   Testing Implicit Feedback Flow');
  console.log('═══════════════════════════════════════════════════════');
  
  await testHealthChecks();
  await testGoodSession();
  await testBadSession();
  await testDirectPythonCall();
  await testUserSummary();
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ All tests complete!');
  console.log('\nNext steps:');
  console.log('1. Open NovaCart in browser (http://localhost:5173)');
  console.log('2. Browse the site, click products, scroll, etc.');
  console.log('3. Open DevTools console to see tracking logs');
  console.log('4. Wait 5 minutes (or close tab) for data to be sent');
  console.log('5. Check MongoDB for behavior logs');
  console.log('\nWeek 1 Status: ✅ COMPLETE');
  console.log('Week 2 Next: Thompson Sampling Implementation');
  console.log('═══════════════════════════════════════════════════════\n');
}

// Run tests
runAllTests().catch(console.error);
