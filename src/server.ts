import http from "http";
import { readFile } from "fs/promises";
import { URL } from "url";
import dotenv from "dotenv";
import { Game } from "./game.js";

dotenv.config();

let game: Game | null = null;

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
      const body = await parseBody(req);
      const topic: string = body?.topic ?? "General";
      const players: string[] = Array.isArray(body?.players) ? body.players.filter((s: any) => typeof s === "string" && s.trim()) : ["Player 1", "Player 2"];
      game = await Game.create(topic, players);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
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
