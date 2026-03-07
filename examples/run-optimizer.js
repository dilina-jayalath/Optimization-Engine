/**
 * Example: Running the Adaptive Optimizer
 */

const AdaptiveOptimizer = require('../engine/AdaptiveOptimizer');
const path = require('path');

async function main() {
  console.log(' Starting Adaptive Optimizer Demo\n');
  
  // Initialize optimizer
  const optimizer = new AdaptiveOptimizer({
    userId: 'user_123',
    apiUrl: 'http://localhost:5000/api',
    onSettingsChange: (settings) => {
      console.log(' Settings updated:', settings);
    },
    onOptimizationComplete: (optimizations) => {
      console.log(' Optimization complete:', optimizations);
    }
  });
  
  // Initialize (load from backend)
  console.log(' Connecting to backend...');
  await optimizer.initialize();
  
  // Load ML profiles
  console.log('\n Loading ML profiles...');
  const categoryWisePath = path.join(__dirname, '../data/category-wise.json');
  const userWisePath = path.join(__dirname, '../data/user-wise.json');
  
  try {
    const mergedProfile = await optimizer.loadMLProfiles(categoryWisePath, userWisePath);
    console.log('ML Profile loaded:',mergedProfile);
  } catch (error) {
    console.log('️ ML profiles not found, creating sample data...');
    
    // Create sample data
    const fs = require('fs');
    const sampleCategory = {
      profile: {
        fontSize: 'large',
        theme: 'light'
      },
      confidence: 0.65
    };
    
    const sampleUser = {
      profile: {
        fontSize: 'x-large',
        lineHeight: 1.6
      },
      confidence: 0.83
    };
    
    fs.mkdirSync(path.dirname(categoryWisePath), { recursive: true });
    fs.writeFileSync(categoryWisePath, JSON.stringify(sampleCategory, null, 2));
    fs.writeFileSync(userWisePath, JSON.stringify(sampleUser, null, 2));
    
    await optimizer.loadMLProfiles(categoryWisePath, userWisePath);
  }
  
  // Run optimization
  console.log('\n Running RL optimization...');
  const optimizedSettings = await optimizer.optimize();
  console.log('Optimized settings:', optimizedSettings);
  
  // Simulate user feedback
  console.log('\n Simulating user feedback (positive)...');
  await optimizer.submitFeedback('positive', {
    timeToFeedback: 5000, // 5 seconds
    continuedUsing: true
  });
  
  // Get statistics
  console.log('\n Q-Learning Statistics:');
  console.log(optimizer.getStatistics());
  
  // Get ML summary
  console.log('\n ML Summary:');
  console.log(optimizer.getMLSummary());
  
  console.log('\n Demo complete!');
  console.log(' Open http://localhost:5000/dashboard to view the dashboard');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
