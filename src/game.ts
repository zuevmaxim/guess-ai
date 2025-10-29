import { Player, Question } from "./types.js";
import { compareGuess, generateAnswers, generateQuestions } from "./ai.js";

export class Game {
  players: Player[] = [];
  questions: Question[] = [];
  current = 0; // question index
  turn = 0; // player index

  protected constructor(players: string[]) {
    this.players = players.map((name) => ({ name, score: 0 }));
  }

  static async create(topic: string, players: string[]): Promise<Game> {
    const game = new Game(players);
    const qs = await generateQuestions(topic);
    const questions: Question[] = [];
    for (const q of qs) {
      const answers = await generateAnswers(q);
      questions.push({ text: q, answers, revealed: new Array(answers.length).fill(false) });
    }
    game.questions = questions;
    game.current = 0;
    game.turn = 0;
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
