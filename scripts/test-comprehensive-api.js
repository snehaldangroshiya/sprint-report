// Test script to verify comprehensive analytics data structure
const axios = require('axios');
const fs = require('fs');

async function testComprehensive() {
  try {
    const url = 'http://localhost:3000/api/sprints/44298/comprehensive?include_tier1=true&include_tier2=true&include_tier3=true&include_forward_looking=true';
    console.log('Testing:', url);

    const response = await axios.get(url);
    const data = response.data;

    console.log('\n=== RESPONSE ANALYSIS ===');
    console.log('Total keys:', Object.keys(data).length);
    console.log('Keys:', Object.keys(data));
    console.log('\nTier fields present:');
    console.log('- sprintGoal:', !!data.sprintGoal);
    console.log('- scopeChanges:', !!data.scopeChanges);
    console.log('- spilloverAnalysis:', !!data.spilloverAnalysis);
    console.log('- blockers:', !!data.blockers);
    console.log('- bugMetrics:', !!data.bugMetrics);
    console.log('- cycleTimeMetrics:', !!data.cycleTimeMetrics);
    console.log('- teamCapacity:', !!data.teamCapacity);
    console.log('- epicProgress:', !!data.epicProgress);
    console.log('- technicalDebt:', !!data.technicalDebt);
    console.log('- risks:', !!data.risks);
    console.log('- nextSprintForecast:', !!data.nextSprintForecast);
    console.log('- carryoverItems:', !!data.carryoverItems);
    console.log('- enhancedGitHubMetrics:', !!data.enhancedGitHubMetrics);
    console.log('\nMetadata:', !!data.metadata);
    if (data.metadata) {
      console.log('Metadata flags:',  {
        includeTier1: data.metadata.includeTier1,
        includeTier2: data.metadata.includeTier2,
        includeTier3: data.metadata.includeTier3
      });
    }

    // Write full response to file
    fs.writeFileSync('/tmp/comprehensive-response.json', JSON.stringify(data, null, 2));
    console.log('\nFull response written to /tmp/comprehensive-response.json');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testComprehensive();
