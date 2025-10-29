# Guess AI 🎮

A Family Feud–style game where players guess answers that an AI would give to survey-style questions.

## Tech Stack

- **TypeScript** (ES Modules)
- **Node.js** built-in `http` server
- **OpenAI API** (GPT-5 for generation, text-embedding-3-large for matching)
- No frameworks (no React, Express, etc.)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your OpenAI API key** in `.env`:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## How to Run

**Start the server:**
```bash
npm start
```

The server will start on `http://localhost:3000`

**Open in browser:**
```
http://localhost:3000
```

## How to Play

1. Enter a **topic** (e.g., "Movies", "Food", "Sports")
2. Enter **player names** (comma-separated)
3. Click **Start Game** and wait for AI to generate questions
4. Take turns guessing answers
5. Earn points based on answer rank (1st = 7 pts, 2nd = 6 pts, ... 7th = 1 pt)
6. Press **Space** to skip to the next question
7. After 10 questions, the winner is announced!

## Additional Commands

**Run tests:**
```bash
npm test
```

**Build project:**
```bash
npm run build
```

**Type check:**
```bash
npm run typecheck
```

## Game Rules

- AI generates 10 questions per game
- Each question has 7 popular answers
- Guesses are matched semantically using AI embeddings (threshold: 0.8)
- Players rotate turns after each guess
- Points awarded: rank 1→7 pts, rank 2→6 pts, ... rank 7→1 pt

## Project Structure

```
guess-ai/
├── src/
│   ├── server.ts      # HTTP server
│   ├── game.ts        # Game logic
│   ├── ai.ts          # OpenAI integration
│   ├── types.ts       # TypeScript interfaces
│   └── index.html     # Frontend UI
├── tests/
│   ├── ai.test.ts     # AI integration tests
│   └── game.test.ts   # Game engine tests
├── package.json
├── tsconfig.json
└── .env
```

## Requirements

- Node.js 18+
- OpenAI API key
- TypeScript 5+
