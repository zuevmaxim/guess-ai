import http from "http";
import { readFile } from "fs/promises";
import { URL } from "url";
import dotenv from "dotenv";
import { Game } from "./game.js";

dotenv.config();

let game: Game | null = null;
let gameProgress = { progress: 0, message: "", ready: false };

async function parseBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Serve index.html at root
    if (req.method === "GET" && url.pathname === "/") {
      const html = await readFile(new URL("./index.html", import.meta.url));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && url.pathname === "/start") {
      console.log("[SERVER] Received /start request");
      const body = await parseBody(req);
      console.log("[SERVER] Request body:", body);
      const topic: string = body?.topic ?? "General";
      const players: string[] = Array.isArray(body?.players) ? body.players.filter((s: any) => typeof s === "string" && s.trim()) : ["Player 1", "Player 2"];
      console.log("[SERVER] Creating game with topic:", topic, "players:", players);
      
      // Reset progress
      gameProgress = { progress: 0, message: "Starting...", ready: false };
      
      // Set up progress callback
      Game.setProgressCallback((progress, message) => {
        gameProgress = { progress, message, ready: false };
        console.log(`[SERVER] Progress: ${progress}% - ${message}`);
      });
      
      // Start game creation in background
      Game.create(topic, players).then((g) => {
        game = g;
        gameProgress = { progress: 100, message: "Game ready!", ready: true };
        console.log("[SERVER] Game created successfully");
      }).catch((err) => {
        console.error("[SERVER] Game creation failed:", err);
        gameProgress = { progress: 0, message: `Error: ${err.message}`, ready: false };
      });
      
      // Respond immediately
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "started" }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/progress") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(gameProgress));
      return;
    }

    if (req.method === "POST" && url.pathname === "/guess") {
      if (!game) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No active game. Call /start first." }));
        return;
      }
      const body = await parseBody(req);
      const guess: string = body?.guess ?? "";
      const result = await game.handleGuess(guess);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.method === "GET" && url.pathname === "/state") {
      if (!game) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ question: null, players: [], currentPlayer: null, revealed: [] }));
        return;
      }
      const q = game.currentQuestion;
      const state = {
        question: q ? q.text : null,
        answers: q ? q.answers : [],
        revealed: q ? q.revealed : [],
        players: game.players,
        currentIndex: game.current,
        currentPlayerIndex: game.turn,
        currentPlayer: game.players[game.turn]?.name ?? null,
        finished: game.isFinished(),
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(state));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(PORT, () => {
  console.log(`Guess AI server listening on http://localhost:${PORT}`);
});
