// Test realtime UI updates and feedback prompt
// Run after starting all services and NovaCart

const axios = require('axios');

const BACKEND = 'http://localhost:5000/api';
const userId = 'realtime_test_user';

async function test() {
  console.log('\n🚀 Testing Realtime UI + Feedback Prompt\n');

  // 1. Set high visual impairment profile
  console.log('1) Setting high visual impairment profile...');
  await axios.put(`${BACKEND}/profiles/${userId}`, {
    visual_impairment: 0.9,
    motor_skills: 0.6,
    cognitive_load: 0.4,
  });
  console.log('   ✅ Profile saved\n');

  // 2. Get personalization (should return large/high contrast)
  console.log('2) Getting personalization...');
  const personalization = await axios.get(`${BACKEND}/personalization`, {
    params: { userId, mode: 'explore' },
  });
  console.log('   Variant:', personalization.data.settings.variant);
  console.log('   Font size:', personalization.data.settings.fontSize);
  console.log('   Contrast:', personalization.data.settings.contrast);
  console.log('   ✅ UI settings fetched\n');

  // 3. Simulate explicit feedback (yes)
  console.log('3) Simulating positive feedback...');
  await axios.post(`${BACKEND}/feedback/explicit`, {
    userId,
    sessionId: personalization.data.sessionId,
    answer: 'yes',
    comment: 'UI looks great!',
  });
  console.log('   ✅ Positive feedback sent\n');

  // 4. Get personalization again (should learn from feedback)
  console.log('4) Getting personalization again...');
  const personalization2 = await axios.get(`${BACKEND}/personalization`, {
    params: { userId, mode: 'explore' },
  });
  console.log('   Variant:', personalization2.data.settings.variant);
  console.log('   ✅ Updated UI settings\n');

  console.log('📋 Manual Test Steps:\n');
  console.log('1. Open NovaCart: http://localhost:5173');
  console.log('2. Watch CSS variables update in DevTools (--aura-font-size-base, etc.)');
  console.log('3. After 30s, feedback prompt appears bottom-left');
  console.log('4. Click thumbs up/down');
  console.log('5. Check backend logs for "[Explicit Feedback] User ... answered: yes/no"');
  console.log('6. Thompson Sampling learns from your feedback!\n');
}

test().catch((err) => {
  console.error('\n❌ Test failed:', err.response?.data || err.message);
  process.exit(1);
});
