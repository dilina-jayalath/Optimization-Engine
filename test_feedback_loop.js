
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
const USER_ID = 'u_001';
const PARAMETER = 'targetSize';

async function runTest() {
    try {
        console.log("1. Fetching current user settings...");
        const userRes = await axios.get(`${API_URL}/users/${USER_ID}`);
        const currentSettings = userRes.data.data.currentSettings;
        const currentValue = currentSettings[PARAMETER] || 32;
        console.log(`Current ${PARAMETER}:`, currentValue);

        console.log("\n2. Sending NEGATIVE feedback...");
        const feedbackPayload = {
            parameter: PARAMETER,
            currentValue: currentValue,
            feedback: {
                type: 'negative',
                rating: 2,
                accepted: false,
                responseTime: 2000
            },
            context: {
                deviceType: 'desktop',
                timeOfDay: 'morning'
            }
        };

        const feedbackRes = await axios.post(`${API_URL}/users/${USER_ID}/feedback`, feedbackPayload);
        const data = feedbackRes.data.data;
        
        console.log("\n3. Analyzing Response:");
        console.log("Updated Settings (Immediate):", data.updatedSettings);
        console.log("Next Suggestion:", data.nextSuggestion);

        if (data.nextSuggestion && data.nextSuggestion.suggestedValue !== currentValue) {
            console.log(" FAILSAFE: System correctly suggested a change.");
        } else {
            console.log(" ERROR: System did NOT suggest a change or suggested the same value.");
        }

    } catch (error) {
        console.error("Test Failed:", error.message);
        if (error.response) {
            console.error("Response Data:", error.response.data);
        }
    }
}

runTest();
