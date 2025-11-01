import { Player, Question } from "./types.js";
import { compareGuess, generateAnswers, generateQuestions } from "./ai.js";
import { readCache, writeCache, CachedGameData, GameState } from "./cache.js";

export class Game {
  players: Player[] = [];
  questions: Question[] = [];
  current = 0; // question index
  turn = 0; // player index
  incorrectGuesses: string[] = []; // track all incorrect guesses
  private static progressCallback?: (progress: number, message: string) => void;

  protected constructor(players: string[]) {
    this.players = players.map((name) => ({ name, score: 0 }));
  }

  static setProgressCallback(callback: (progress: number, message: string) => void) {
    Game.progressCallback = callback;
  }

  static async create(topic: string, players: string[], model: string = "gpt-4o-mini", language: string = "ru"): Promise<Game> {
    const game = new Game(players);
    
    // Check cache first
    Game.progressCallback?.(5, "Checking cache...");
    console.log("[GAME] Checking cache for topic:", topic, "model:", model, "language:", language);
    const cached = await readCache(topic, model, language);
    
    let qs: string[];
    let answersMap: Record<string, string[]>;
    
    if (cached) {
      // Load from cache
      console.log("[GAME] Cache hit! Loading from cache");
      Game.progressCallback?.(50, "Loading from cache...");
      qs = cached.questions;
      answersMap = cached.answersMap;
      Game.progressCallback?.(90, "Loaded from cache");
    } else {
      // Generate new data
      console.log("[GAME] Cache miss. Generating new data");
      
      // Step 1: Generate questions (10% of total progress)
      Game.progressCallback?.(5, "Generating questions...");
      console.log("[GAME] Generating questions for topic:", topic, "with model:", model, "language:", language);
      qs = await generateQuestions(topic, model, language);
      console.log("[GAME] Generated", qs.length, "questions");
      Game.progressCallback?.(10, `Generated ${qs.length} questions`);
      
      // Step 2: Generate answers in parallel (90% of total progress)
      const totalQuestions = qs.length;
      let completedQuestions = 0;
      answersMap = {};
      
      const answerPromises = qs.map(async (q, i) => {
        console.log(`[GAME] Starting answer generation for question ${i + 1}/${totalQuestions}: ${q}`);
        const answers = await generateAnswers(q, topic, model, language);
        completedQuestions++;
        const progress = 10 + Math.floor((completedQuestions / totalQuestions) * 90);
        Game.progressCallback?.(progress, `Generated answers for ${completedQuestions}/${totalQuestions} questions`);
        console.log(`[GAME] Generated ${answers.length} answers for question ${i + 1}/${totalQuestions}`);
        return { question: q, answers };
      });
      
      const results = await Promise.all(answerPromises);
      results.forEach(({ question, answers }) => {
        answersMap[question] = answers;
      });
      
      // Save to cache
      const cacheData: CachedGameData = {
        topic,
        questions: qs,
        answersMap,
      };
      await writeCache(cacheData, model, language);
    }
    
    // Build questions array
    const questions: Question[] = qs.map((q) => ({
      text: q,
      answers: answersMap[q] || [],
      revealed: new Array(7).fill(false),
      givenUp: new Array(7).fill(false),
    }));
    
    game.questions = questions;
    game.current = 0;
    
    // Start with a random player for the first question
    // In tests, use deterministic behavior (always start with player 0)
    if (process.env.CACHE_DIR === 'cache-test') {
      game.turn = 0;
    } else {
      game.turn = Math.floor(Math.random() * game.players.length);
    }
    
    Game.progressCallback?.(100, "Game ready!");
    console.log("[GAME] Game creation complete");
    return game;
  }

  // Export current game state for caching
  exportState(topic: string, model: string, language: string, cacheFilePath: string): GameState {
    return {
      topic,
      model,
      language,
      cacheFilePath,
      players: this.players.map(p => ({ name: p.name, score: p.score })),
      currentQuestionIndex: this.current,
      currentPlayerIndex: this.turn,
      questions: this.questions.map(q => ({
        text: q.text,
        answers: [...q.answers],
        revealed: [...q.revealed],
        givenUp: [...q.givenUp],
      })),
      incorrectGuesses: [...this.incorrectGuesses],
    };
  }

  // Restore game from saved state
  static restoreFromState(state: GameState): Game {
    const game = new Game(state.players.map(p => p.name));
    
    // Restore player scores
    state.players.forEach((p, i) => {
      game.players[i].score = p.score;
    });
    
    // Sort players by score to maintain correct order
    game.sortPlayersByScore();
    
    // Restore questions
    game.questions = state.questions.map(q => ({
      text: q.text,
      answers: [...q.answers],
      revealed: [...q.revealed],
      givenUp: [...q.givenUp],
    }));
    
    // Restore game state
    game.current = state.currentQuestionIndex;
    game.turn = state.currentPlayerIndex;
    game.incorrectGuesses = [...state.incorrectGuesses];
    
    console.log("[GAME] Restored game from saved state");
    return game;
  }

  get currentQuestion(): Question | null {
    return this.questions[this.current] ?? null;
  }

  // Points: rank 1 => 7, rank 2 => 6, ... rank 7 => 1
  private pointsForRank(rankIndex: number): number {
    // rankIndex: 0..6
    return 8 - (rankIndex + 1);
  }

  private advanceTurn() {
    this.turn = (this.turn + 1) % this.players.length;
  }

  private sortPlayersByScore() {
    // Sort players by score in ascending order (lowest score first)
    this.players.sort((a, b) => a.score - b.score);
  }

  nextQuestion() {
    if (this.current < this.questions.length - 1) {
      this.current += 1;
      this.incorrectGuesses = []; // Reset incorrect guesses for new question
      
      // Sort players by score before starting the new question
      this.sortPlayersByScore();
      
      // Always start with player 0 (the one with lowest score after sorting)
      // No randomness for questions 2-10
        this.turn = 0;
    }
  }

  isFinished(): boolean {
    return this.current >= this.questions.length - 1 && this.allRevealed(this.current);
  }

  private allRevealed(qIndex: number): boolean {
    const q = this.questions[qIndex];
    return q ? q.revealed.every(Boolean) : true;
  }

  private handleGiveUp(): { correct: boolean; giveUp: boolean } {
    const q = this.currentQuestion;
    if (!q) return { correct: false, giveUp: true };

    // Reveal all remaining answers and mark them as given up
    for (let i = 0; i < q.answers.length; i++) {
      if (!q.revealed[i]) {
        q.revealed[i] = true;
        q.givenUp[i] = true;
      }
    }

    console.log("[GAME] Give up - all remaining answers revealed");
    return { correct: false, giveUp: true };
  }

  async handleGuess(rawGuess: string): Promise<{ correct: boolean; points?: number; answer?: string; similarity?: number; giveUp?: boolean }> {
    const guess = rawGuess.trim();

    // Special: allow client to request next question explicitly
    if (guess === "__NEXT__") {
      this.nextQuestion();
      return { correct: false };
    }

    // Special: handle give up action
    if (guess === "__GIVEUP__") {
      return this.handleGiveUp();
    }

    const q = this.currentQuestion;
    if (!q) return { correct: false };

    // Compare guess vs answers that are not yet revealed
    const remainingAnswers = q.answers.map((a, i) => ({ a, i })).filter(({ i }) => !q.revealed[i]);
    const candidateAnswers = remainingAnswers.map((x) => x.a);

    if (candidateAnswers.length === 0) {
      // move to next question if all revealed
      this.nextQuestion();
      this.advanceTurn();
      return { correct: false };
    }

    const { matchIndex: matchIndexInRemaining, similarity } = await compareGuess(guess, candidateAnswers);

    // Log cosine similarity to server logs
    console.log(`[GAME] Guess: "${guess}" | Cosine similarity: ${similarity.toFixed(3)}`);

    let result: { correct: boolean; points?: number; answer?: string; similarity?: number } = { correct: false, similarity };

    if (matchIndexInRemaining !== null) {
      const revealedIndex = remainingAnswers[matchIndexInRemaining].i; // index in full list
      q.revealed[revealedIndex] = true;
      const points = this.pointsForRank(revealedIndex);
      this.players[this.turn].score += points;
      result = { correct: true, points, answer: q.answers[revealedIndex], similarity };
    } else {
      // Record incorrect guess
      this.incorrectGuesses.push(guess);
    }

    // rotate turn regardless
    this.advanceTurn();

    return result;
  }
}
