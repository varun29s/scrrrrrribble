// Set env to test so we don't listen on port 3000
process.env.NODE_ENV = "test";

const assert = require("assert");
const {
  getLevenshteinDistance,
  generateLobbyId,
  getRandomWords,
  getWordHint
} = require("./server");

console.log("=== RUNNING SKRIBBLE SERVER UNIT TESTS ===");

try {
  // Test 1: Levenshtein Distance
  console.log("Testing Levenshtein Distance...");
  assert.strictEqual(getLevenshteinDistance("apple", "apple"), 0);
  assert.strictEqual(getLevenshteinDistance("apple", "aple"), 1); // delete p
  assert.strictEqual(getLevenshteinDistance("apple", "apples"), 1); // add s
  assert.strictEqual(getLevenshteinDistance("cat", "cut"), 1); // substitute a -> u
  assert.strictEqual(getLevenshteinDistance("cat", "dog"), 3); // all diff
  console.log("✓ Levenshtein tests passed.");

  // Test 2: Lobby ID Generation
  console.log("Testing Lobby ID Generation...");
  const id1 = generateLobbyId();
  const id2 = generateLobbyId();
  assert.strictEqual(typeof id1, "string");
  assert.strictEqual(id1.length, 6);
  assert.notStrictEqual(id1, id2); // should be random
  console.log("✓ Lobby ID tests passed.");

  // Test 3: Word Selection
  console.log("Testing Word Selector...");
  const selected = getRandomWords(3);
  assert.strictEqual(Array.isArray(selected), true);
  assert.strictEqual(selected.length, 3);
  assert.strictEqual(new Set(selected).size, 3); // unique elements
  console.log("✓ Word selection tests passed.");

  // Test 4: Word Hint Generator
  console.log("Testing Word Hint Generator...");
  assert.strictEqual(getWordHint("apple", []), "_____");
  assert.strictEqual(getWordHint("ice cream", []), "___ _____"); // space preserved
  assert.strictEqual(getWordHint("t-shirt", []), "_-_____"); // hyphen preserved
  
  // With some indices revealed
  assert.strictEqual(getWordHint("apple", [0, 3]), "a__l_");
  assert.strictEqual(getWordHint("ice cream", [1, 5, 8]), "_c_ _r__m");
  console.log("✓ Word hint tests passed.");

  console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<");
  process.exit(0);
} catch (error) {
  console.error("\n❌ TEST FAILURE DETECTED:");
  console.error(error);
  process.exit(1);
}
