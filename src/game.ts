import { Player, Question } from "./types.js";
import { compareGuess, generateAnswers, generateQuestions } from "./ai.js";
import { readCache, writeCache, CachedGameData } from "./cache.js";

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

  static async create(topic: string, players: string[]): Promise<Game> {
    const game = new Game(players);
    
    // Check cache first
    Game.progressCallback?.(5, "Checking cache...");
    console.log("[GAME] Checking cache for topic:", topic);
    const cached = await readCache(topic);
    
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
      console.log("[GAME] Generating questions for topic:", topic);
      qs = await generateQuestions(topic);
      console.log("[GAME] Generated", qs.length, "questions");
      Game.progressCallback?.(10, `Generated ${qs.length} questions`);
      
      // Step 2: Generate answers in parallel (90% of total progress)
      const totalQuestions = qs.length;
      let completedQuestions = 0;
      answersMap = {};
      
      const answerPromises = qs.map(async (q, i) => {
        console.log(`[GAME] Starting answer generation for question ${i + 1}/${totalQuestions}: ${q}`);
        const answers = await generateAnswers(q, topic);
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
      await writeCache(cacheData);
    }
    
    // Build questions array
    const questions: Question[] = qs.map((q) => ({
      text: q,
      answers: answersMap[q] || [],
      revealed: new Array(7).fill(false),
    }));
    
    game.questions = questions;
    game.current = 0;
    game.turn = 0;
    Game.progressCallback?.(100, "Game ready!");
    console.log("[GAME] Game creation complete");
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

  nextQuestion() {
    if (this.current < this.questions.length - 1) {
      this.current += 1;
      this.incorrectGuesses = []; // Reset incorrect guesses for new question
    }
  }

  isFinished(): boolean {
    return this.current >= this.questions.length - 1 && this.allRevealed(this.current);
  }

  private allRevealed(qIndex: number): boolean {
    const q = this.questions[qIndex];
    return q ? q.revealed.every(Boolean) : true;
  }

  async handleGuess(rawGuess: string): Promise<{ correct: boolean; points?: number; answer?: string }> {
    const guess = rawGuess.trim();

    // Special: allow client to request next question explicitly
    if (guess === "__NEXT__") {
      this.nextQuestion();
      this.advanceTurn();
      return { correct: false };
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

    const matchIndexInRemaining = await compareGuess(guess, candidateAnswers);

    let result: { correct: boolean; points?: number; answer?: string } = { correct: false };

    if (matchIndexInRemaining !== null) {
      const revealedIndex = remainingAnswers[matchIndexInRemaining].i; // index in full list
      q.revealed[revealedIndex] = true;
      const points = this.pointsForRank(revealedIndex);
      this.players[this.turn].score += points;
      result = { correct: true, points, answer: q.answers[revealedIndex] };
    } else {
      // Record incorrect guess
      this.incorrectGuesses.push(guess);
    }

    // rotate turn regardless
    this.advanceTurn();

    // auto-advance question if all answers revealed
    if (this.allRevealed(this.current)) {
      this.nextQuestion();
    }

    return result;
  }
}
