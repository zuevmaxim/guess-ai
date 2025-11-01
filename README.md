# Guess AI 🎮

A Family Feud–style game where players guess answers that an AI would give to survey-style questions.

## Tech Stack

- **TypeScript** (ES Modules)
- **Node.js** built-in `http` server
- **OpenAI API** (gpt-4o-mini or gpt-5 for generation, text-embedding-3-large for matching)
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

**Stop the server:**
```bash
npm stop
```

**Open in browser:**
```
http://localhost:3000
```

## How to Play

1. **Select language** (Russian or English) and **AI model** (gpt-4o-mini or gpt-5)
2. Enter a **topic** (e.g., "Movies", "Food", "Sports")
3. Enter **player names** using dynamic text fields (a new field appears as you type)
4. Click **Start Game** and wait for AI to generate questions
5. Take turns guessing answers - the game automatically focuses on the input field
6. Earn points based on answer rank (1st = 7 pts, 2nd = 6 pts, ... 7th = 1 pt)
7. Use **Give Up** button to reveal all remaining answers
8. Use **End Game** button to return to main screen at any time
9. After each question, view the **score board** and click to continue
10. After 10 questions, the winner is announced!

**Game State Persistence:**
- The game automatically saves your progress
- If you refresh the page, the game will resume from where you left off
- Your last game configuration (topic, players, model, language) is remembered

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
- Guesses are matched semantically using AI embeddings (threshold: 0.7)
- Players are sorted by score at the start of each question (lowest score first)
- Starting player for each question is randomly selected
- Players rotate turns after each guess
- Points awarded: rank 1→7 pts, rank 2→6 pts, ... rank 7→1 pt
- Incorrect guesses are tracked and displayed
- Answers revealed via "Give Up" are shown in a different color

## Features

- **Multi-language support**: Play in Russian or English
- **Model selection**: Choose between gpt-4o-mini and gpt-5
- **Dynamic player inputs**: Add players on-the-fly with auto-expanding fields
- **Game state caching**: Questions are cached per topic/model/language to save API costs
- **Progress tracking**: Real-time progress bar during question generation
- **Intermission screens**: Score board displayed between questions
- **Modern UI**: Gradient backgrounds, smooth animations, responsive design
- **Auto-focus**: Input field automatically focused for seamless gameplay
- **Normalization**: Handles Russian 'ё'/'е' equivalence and case-insensitive matching

## Project Structure

```
guess-ai/
├── src/
│   ├── server.ts      # HTTP server
│   ├── game.ts        # Game logic
│   ├── ai.ts          # OpenAI integration
│   ├── cache.ts       # Caching system
│   ├── types.ts       # TypeScript interfaces
│   └── index.html     # Frontend UI
├── tests/
│   ├── ai.test.ts     # AI integration tests
│   ├── game.test.ts   # Game engine tests
│   └── server.test.ts # Server endpoint tests
├── cache/             # Production cache directory
├── cache-test/        # Test cache directory
├── package.json
├── tsconfig.json
└── .env
```

## Requirements

- Node.js 18+
- OpenAI API key
- TypeScript 5+
