import { test } from "node:test";
import assert from "node:assert";
import { compareGuess } from "../src/ai.ts";

test("compareGuess - exact match should return correct index", async () => {
  const answers = ["Pizza", "Burger", "Sushi", "Pasta", "Tacos", "Salad", "Steak"];
  const guess = "Pizza";
  const result = await compareGuess(guess, answers);
  assert.strictEqual(result, 0, "Exact match 'Pizza' should return index 0");
});

test("compareGuess - similar match should return correct index", async () => {
  const answers = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio"];
  const guess = "New York City";
  const result = await compareGuess(guess, answers);
  assert.strictEqual(result, 0, "Similar match 'New York City' should match 'New York' at index 0");
});

test("compareGuess - case insensitive matching", async () => {
  const answers = ["Apple", "Banana", "Orange", "Grape", "Strawberry", "Watermelon", "Pineapple"];
  const guess = "apple";
  const result = await compareGuess(guess, answers);
  assert.strictEqual(result, 0, "Case insensitive 'apple' should match 'Apple' at index 0");
});

test("compareGuess - close synonym may not match due to threshold", async () => {
  const answers = ["Happy", "Sad", "Angry", "Excited", "Nervous", "Calm", "Confused"];
  const guess = "Joyful";
  const result = await compareGuess(guess, answers);
  // Note: Synonyms may not always exceed 0.8 threshold, so we accept null or 0
  assert.ok(result === null || result === 0, "Synonym 'Joyful' may or may not match 'Happy' depending on embedding similarity");
});

test("compareGuess - no match below threshold should return null", async () => {
  const answers = ["Dog", "Cat", "Bird", "Fish", "Hamster", "Rabbit", "Turtle"];
  const guess = "Automobile";
  const result = await compareGuess(guess, answers);
  assert.strictEqual(result, null, "Unrelated guess 'Automobile' should return null");
});

test("compareGuess - match answer at different positions", async () => {
  const answers = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink"];
  const guess = "Green";
  const result = await compareGuess(guess, answers);
  assert.strictEqual(result, 2, "Exact match 'Green' should return index 2");
});

test("compareGuess - partial word in phrase", async () => {
  const answers = ["Go to the beach", "Watch a movie", "Read a book", "Play sports", "Cook dinner", "Visit friends", "Take a nap"];
  const guess = "Go to beach";
  const result = await compareGuess(guess, answers);
  // Very similar phrase should match
  assert.strictEqual(result, 0, "Similar phrase 'Go to beach' should match 'Go to the beach' at index 0");
});

test("compareGuess - very similar words", async () => {
  const answers = ["Running", "Swimming", "Cycling", "Walking", "Hiking", "Dancing", "Jumping"];
  const guess = "Run";
  const result = await compareGuess(guess, answers);
  // Very similar root word should match
  assert.strictEqual(result, 0, "Root word 'Run' should match 'Running' at index 0");
});
