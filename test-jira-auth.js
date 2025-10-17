#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const email = process.env.JIRA_EMAIL;
const apiToken = process.env.JIRA_API_TOKEN;
const baseUrl = process.env.JIRA_BASE_URL;
const authType = process.env.JIRA_AUTH_TYPE || 'basic';

console.log('Testing Jira Authentication...\n');
console.log(`Base URL: ${baseUrl}`);
console.log(`Email: ${email}`);
console.log(`Token: ${apiToken ? apiToken.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`Auth Type: ${authType}\n`);

// Test 1: Basic Auth
console.log('=== Test 1: Basic Auth ===');
const basicAuth = Buffer.from(`${email}:${apiToken}`).toString('base64');
console.log(`Authorization Header: Basic ${basicAuth.substring(0, 20)}...\n`);

axios.get(`${baseUrl}/rest/api/2/myself`, {
  headers: {
    'Authorization': `Basic ${basicAuth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  timeout: 10000
})
.then(response => {
  console.log('✅ Basic Auth SUCCESS!');
  console.log('User:', response.data.displayName);
  console.log('Email:', response.data.emailAddress);
  console.log('Account ID:', response.data.accountId || response.data.name);
})
.catch(error => {
  console.log('❌ Basic Auth FAILED!');
  console.log('Status:', error.response?.status);
  console.log('Status Text:', error.response?.statusText);
  console.log('Error Message:', error.message);
  if (error.response?.data) {
    console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
  }
})
.finally(() => {
  console.log('\n=== Test 2: Bearer Auth ===');
  
  // Test 2: Bearer Auth
  axios.get(`${baseUrl}/rest/api/2/myself`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 10000
  })
  .then(response => {
    console.log('✅ Bearer Auth SUCCESS!');
    console.log('User:', response.data.displayName);
    console.log('Email:', response.data.emailAddress);
    console.log('Account ID:', response.data.accountId || response.data.name);
  })
  .catch(error => {
    console.log('❌ Bearer Auth FAILED!');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Error Message:', error.message);
    if (error.response?.data) {
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  })
  .finally(() => {
    console.log('\n=== Test Complete ===');
  });
});
