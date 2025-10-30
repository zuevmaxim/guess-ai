import { test } from "node:test";
import assert from "node:assert";
import { Game } from "../src/game.ts";
import { Question } from "../src/types.ts";

// Helper to create a game with pre-generated questions (no AI calls)
function createMockGame(players: string[], questions: Question[]): Game {
  const game = new Game(players);
  game.questions = questions;
  game.current = 0;
  game.turn = 0;
  return game;
}

// Expose the private constructor for testing
class TestGame extends Game {
  constructor(players: string[]) {
    super(players);
  }
}

// Replace Game with TestGame for testing
const GameConstructor = TestGame as any as typeof Game;

test("Game - handleGuess with correct answer awards points based on rank", async () => {
  const questions: Question[] = [
    {
      text: "Name a popular fruit",
      answers: ["Apple", "Banana", "Orange", "Grape", "Strawberry", "Watermelon", "Pineapple"],
      revealed: [false, false, false, false, false, false, false],
    },
  ];
  const game = createMockGame(["Alice", "Bob"], questions);

  // Guess rank 1 answer (index 0) - should award 7 points
  const result1 = await game.handleGuess("Apple");
  assert.strictEqual(result1.correct, true, "Correct guess should return true");
  assert.strictEqual(result1.points, 7, "Rank 1 answer should award 7 points");
  assert.strictEqual(result1.answer, "Apple", "Should return the matched answer");
  assert.strictEqual(game.players[0].score, 7, "Alice should have 7 points");
  assert.strictEqual(game.questions[0].revealed[0], true, "Answer should be revealed");
});

test("Game - turn rotation after each guess", async () => {
  const questions: Question[] = [
    {
      text: "Name a color",
      answers: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink"],
      revealed: [false, false, false, false, false, false, false],
    },
  ];
  const game = createMockGame(["Alice", "Bob", "Charlie"], questions);

  assert.strictEqual(game.turn, 0, "Should start with player 0");

  await game.handleGuess("Red");
  assert.strictEqual(game.turn, 1, "Should rotate to player 1 after first guess");

  await game.handleGuess("Blue");
  assert.strictEqual(game.turn, 2, "Should rotate to player 2 after second guess");

  await game.handleGuess("Green");
  assert.strictEqual(game.turn, 0, "Should wrap back to player 0 after third guess");
});

test("Game - incorrect guess awards 0 points and rotates turn", async () => {
  const questions: Question[] = [
    {
      text: "Name an animal",
      answers: ["Dog", "Cat", "Bird", "Fish", "Hamster", "Rabbit", "Turtle"],
      revealed: [false, false, false, false, false, false, false],
    },
  ];
  const game = createMockGame(["Alice", "Bob"], questions);

  const result = await game.handleGuess("Automobile");
  assert.strictEqual(result.correct, false, "Incorrect guess should return false");
  assert.strictEqual(result.points, undefined, "Incorrect guess should not award points");
  assert.strictEqual(game.players[0].score, 0, "Alice should still have 0 points");
  assert.strictEqual(game.turn, 1, "Turn should rotate even on incorrect guess");
});

test("Game - scoring for different ranks", async () => {
  const questions: Question[] = [
    {
      text: "Name a vehicle",
      answers: ["Car", "Truck", "Motorcycle", "Bicycle", "Bus", "Train", "Airplane"],
      revealed: [false, false, false, false, false, false, false],
    },
  ];
  const game = createMockGame(["Alice"], questions);

  // Rank 1 (index 0) = 7 points
  await game.handleGuess("Car");
  assert.strictEqual(game.players[0].score, 7, "Rank 1 should award 7 points");

  // Rank 3 (index 2) = 5 points
  await game.handleGuess("Motorcycle");
  assert.strictEqual(game.players[0].score, 12, "Rank 3 should award 5 points (total 12)");

  // Rank 7 (index 6) = 1 point
  await game.handleGuess("Airplane");
  assert.strictEqual(game.players[0].score, 13, "Rank 7 should award 1 point (total 13)");
});

test("Game - already revealed answers are not matched again", async () => {
  const questions: Question[] = [
    {
      text: "Name a sport",
      answers: ["Soccer", "Basketball", "Tennis", "Baseball", "Football", "Golf", "Swimming"],
      revealed: [true, false, false, false, false, false, false], // Soccer already revealed
    },
  ];
  const game = createMockGame(["Alice", "Bob"], questions);

  // Try to guess already revealed answer
  const result = await game.handleGuess("Soccer");
  // Should not match because it's already revealed
  assert.strictEqual(result.correct, false, "Already revealed answer should not match");
  assert.strictEqual(game.players[0].score, 0, "Should not award points for already revealed answer");
});

test("Game - no auto-advance when all answers revealed (client controls advance)", async () => {
  const questions: Question[] = [
    {
      text: "Question 1",
      answers: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      revealed: [true, true, true, true, true, true, false], // Only one left
    },
    {
      text: "Question 2",
      answers: ["B1", "B2", "B3", "B4", "B5", "B6", "B7"],
      revealed: [false, false, false, false, false, false, false],
    },
  ];
  const game = createMockGame(["Alice"], questions);

  assert.strictEqual(game.current, 0, "Should start at question 0");

  // Reveal the last answer
  await game.handleGuess("A7");

  // Should NOT auto-advance - stays at question 0 to allow intermission screen
  assert.strictEqual(game.current, 0, "Should stay at question 0 after all answers revealed");
  assert.strictEqual(game.currentQuestion?.text, "Question 1", "Should still be on question 1");
  
  // Client must explicitly advance using __NEXT__ token
  await game.handleGuess("__NEXT__");
  assert.strictEqual(game.current, 1, "Should advance to question 1 after __NEXT__ token");
  assert.strictEqual(game.currentQuestion?.text, "Question 2", "Should be on question 2");
});

test("Game - nextQuestion advances to next question", async () => {
  const questions: Question[] = [
    {
      text: "Question 1",
      answers: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      revealed: [false, false, false, false, false, false, false],
    },
    {
      text: "Question 2",
      answers: ["B1", "B2", "B3", "B4", "B5", "B6", "B7"],
      revealed: [false, false, false, false, false, false, false],
    },
  ];
  const game = createMockGame(["Alice"], questions);

  assert.strictEqual(game.current, 0, "Should start at question 0");
  game.nextQuestion();
  assert.strictEqual(game.current, 1, "Should advance to question 1");
});

test("Game - isFinished returns true when on last question with all revealed", async () => {
  const questions: Question[] = [
    {
      text: "Last Question",
      answers: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      revealed: [true, true, true, true, true, true, true],
    },
  ];
  const game = createMockGame(["Alice"], questions);

  assert.strictEqual(game.isFinished(), true, "Game should be finished");
});

test("Game - isFinished returns false when not all answers revealed", async () => {
  const questions: Question[] = [
    {
      text: "Last Question",
      answers: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      revealed: [true, true, true, true, true, true, false],
    },
  ];
  const game = createMockGame(["Alice"], questions);

  assert.strictEqual(game.isFinished(), false, "Game should not be finished");
});

test("Game - special __NEXT__ token advances question", async () => {
  const questions: Question[] = [
    {
      text: "Question 1",
      answers: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      revealed: [false, false, false, false, false, false, false],
    },
    {
      text: "Question 2",
      answers: ["B1", "B2", "B3", "B4", "B5", "B6", "B7"],
      revealed: [false, false, false, false, false, false, false],
    },
  ];
  const game = createMockGame(["Alice", "Bob"], questions);

  assert.strictEqual(game.current, 0, "Should start at question 0");
  const result = await game.handleGuess("__NEXT__");
  assert.strictEqual(result.correct, false, "Special token should return false");
  assert.strictEqual(game.current, 1, "Should advance to question 1");
  assert.strictEqual(game.turn, 1, "Turn should still rotate");
});
