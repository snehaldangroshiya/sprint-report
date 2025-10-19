#!/usr/bin/env tsx
/**
 * Verification script for board mappings bundle
 * Ensures the bundled data is loaded correctly
 */

import {
  BOARD_NAME_MAPPINGS,
  BoardLookup,
  getTotalBoards,
  findBoard,
} from '../src/utils/board-mappings';

console.log('🔍 Verifying Board Mappings Bundle...\n');

// Test 1: Check if data is loaded
const totalBoards = getTotalBoards();
console.log(`✅ Total boards loaded: ${totalBoards}`);

if (totalBoards === 0) {
  console.error('❌ ERROR: No boards loaded!');
  process.exit(1);
}

// Test 2: Check data structure
const boardNames = Object.keys(BOARD_NAME_MAPPINGS);
if (boardNames.length > 0) {
  console.log(`✅ Board names array has ${boardNames.length} entries`);
} else {
  console.error('❌ ERROR: Board names array is empty!');
  process.exit(1);
}

// Test 3: Sample board lookup
const sampleBoardName = boardNames[0];
const sampleBoard = findBoard(sampleBoardName);
if (sampleBoard) {
  console.log(`✅ Sample board lookup successful:`);
  console.log(`   Name: ${sampleBoard.name}`);
  console.log(`   ID: ${sampleBoard.id}`);
  console.log(`   Type: ${sampleBoard.type}`);
} else {
  console.error('❌ ERROR: Sample board lookup failed!');
  process.exit(1);
}

// Test 4: Search functionality
const searchResults = BoardLookup.searchBoardsByName('scrum');
console.log(`✅ Search for "scrum" returned ${searchResults.length} results`);

// Test 5: Board ID lookup
const allBoardIds = BoardLookup.getAllBoardIds();
console.log(`✅ Total board IDs: ${allBoardIds.length}`);

// Test 6: Verify data integrity
const firstBoard = Object.values(BOARD_NAME_MAPPINGS)[0];
if (!firstBoard) {
  console.error('❌ ERROR: Cannot access first board!');
  process.exit(1);
}

if (!firstBoard.id || !firstBoard.name || !firstBoard.type) {
  console.error('❌ ERROR: Board data structure is invalid!');
  console.error('Board:', firstBoard);
  process.exit(1);
}

console.log('✅ Board data structure is valid');

// Test 7: Check for specific known boards
const knownBoards = [
  'Scrum Board',
  'Kanban Board',
  'Banking Team Sprint Board',
];

let foundKnown = 0;
knownBoards.forEach(boardName => {
  const board = BoardLookup.getBoardByName(boardName);
  if (board) {
    foundKnown++;
  }
});

console.log(
  `✅ Found ${foundKnown} out of ${knownBoards.length} known test boards`
);

console.log('\n🎉 All verification tests passed!');
console.log('📦 Board mappings are successfully bundled and accessible.\n');

// Summary
console.log('Summary:');
console.log('━'.repeat(50));
console.log(`Total Boards: ${totalBoards}`);
console.log(
  `Memory Usage: ~${Math.round(JSON.stringify(BOARD_NAME_MAPPINGS).length / 1024)}KB`
);
console.log(`Data Source: Bundled at build time`);
console.log('━'.repeat(50));
