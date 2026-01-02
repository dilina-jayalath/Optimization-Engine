// Week 3 Integration Test
// Verifies profiles, personalization context, revert stats, and pattern detection

const axios = require('axios');

const BACKEND = 'http://localhost:5000/api';
const PYTHON = 'http://localhost:5001';

async function run() {
  console.log('\n🚀 Week 3 Integration Test');

  const userId = 'week3_user';

  // 1) Set accessibility profile
  console.log('\n1) Updating profile...');
  const profilePayload = {
    visual_impairment: 0.85,
    motor_skills: 0.55,
    cognitive_load: 0.35,
    preferredContrast: 'high',
    prefersLargeText: true,
    prefersReducedMotion: false,
  };
  const profileRes = await axios.put(`${BACKEND}/profiles/${userId}`, profilePayload);
  console.log('   Profile saved:', profileRes.data.profile);

  // 2) Get personalization (should use profile context)
  console.log('\n2) Fetching personalization...');
  const personalization = await axios.get(`${BACKEND}/personalization`, {
    params: { userId, mode: 'explore' },
  });
  console.log('   Source:', personalization.data.source);
  console.log('   Variant:', personalization.data.settings.variant);
  console.log('   Contrast:', personalization.data.settings.contrast);

  // 3) Revert stats before any revert
  console.log('\n3) Revert stats (pre) ...');
  const revertPre = await axios.get(`${BACKEND}/behavior/${userId}/revert-stats`);
  console.log('   Revert rate:', revertPre.data.revertRate);

  // 4) Send explicit revert (negative signal)
  console.log('\n4) Sending explicit revert...');
  const revertRes = await axios.post(`${BACKEND}/personalization/revert`, {
    userId,
    sessionId: 'week3_session_revert',
    reason: 'immediate',
  });
  console.log('   Message:', revertRes.data.message);

  // 5) Revert stats after revert
  console.log('\n5) Revert stats (post) ...');
  const revertPost = await axios.get(`${BACKEND}/behavior/${userId}/revert-stats`);
  console.log('   Revert rate:', revertPost.data.revertRate);
  console.log('   Last revert:', revertPost.data.lastRevertAt);

  // 6) Pattern detection from Python reward service
  console.log('\n6) Pattern detection (implicit reward service)...');
  const patterns = await axios.get(`${PYTHON}/patterns`);
  console.log('   Total sessions:', patterns.data.totalSessions);
  console.log('   Revert rate:', patterns.data.revertRate);

  console.log('\n✅ Week 3 test completed.');
}

run().catch((err) => {
  console.error('\n❌ Week 3 test failed:', err.response?.data || err.message);
  process.exit(1);
});
