import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const CACHE_DIR = process.env.CACHE_DIR || "cache";

export interface CachedGameData {
  topic: string;
  questions: string[];
  answersMap: Record<string, string[]>; // question -> answers
}

export interface LastGameConfig {
  topic: string;
  players: string[];
  model: string;
  language: string;
}

export interface GameState {
  topic: string;
  model: string;
  language: string;
  cacheFilePath: string; // Path to the cached questions file
  players: Array<{ name: string; score: number }>;
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  questions: Array<{
    text: string;
    answers: string[];
    revealed: boolean[];
    givenUp: boolean[];
  }>;
  incorrectGuesses: string[];
}

// Normalize topic to create a safe filename
function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

// Get cache file path for a topic, model, and language
function getCacheFilePath(topic: string, model: string = "gpt-4o-mini", language: string = "ru"): string {
  const normalized = normalizeTopic(topic);
  return join(CACHE_DIR, `${model}_${language}_${normalized}.json`);
}

// Check if cache exists for a topic, model, and language
export function cacheExists(topic: string, model: string = "gpt-4o-mini", language: string = "ru"): boolean {
  const filePath = getCacheFilePath(topic, model, language);
  return existsSync(filePath);
}

// Read cached data for a topic, model, and language
export async function readCache(topic: string, model: string = "gpt-4o-mini", language: string = "ru"): Promise<CachedGameData | null> {
  try {
    const filePath = getCacheFilePath(topic, model, language);
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content) as CachedGameData;
    console.log(`[CACHE] Loaded cache for topic: ${topic}, model: ${model}, language: ${language}`);
    return data;
  } catch (error) {
    console.error(`[CACHE] Error reading cache for topic ${topic}, model ${model}, language ${language}:`, error);
    return null;
  }
}

// Write cache data for a topic, model, and language
export async function writeCache(data: CachedGameData, model: string = "gpt-4o-mini", language: string = "ru"): Promise<void> {
  try {
    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
    
    const filePath = getCacheFilePath(data.topic, model, language);
    const content = JSON.stringify(data, null, 2);
    await writeFile(filePath, content, "utf-8");
    console.log(`[CACHE] Saved cache for topic: ${data.topic}, model: ${model}, language: ${language} to ${filePath}`);
  } catch (error) {
    console.error(`[CACHE] Error writing cache for topic ${data.topic}, model ${model}, language ${language}:`, error);
  }
}

// Dump AI response to a text file for debugging/inspection
export async function dumpAIResponse(topic: string, type: "questions" | "answers", question: string | null, response: string): Promise<void> {
  try {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
    
    const normalized = normalizeTopic(topic);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let filename: string;
    
    if (type === "questions") {
      filename = `${normalized}_questions_${timestamp}.txt`;
    } else {
      const questionNorm = question ? normalizeTopic(question).substring(0, 30) : "unknown";
      filename = `${normalized}_answers_${questionNorm}_${timestamp}.txt`;
    }
    
    const filePath = join(CACHE_DIR, filename);
    await writeFile(filePath, response, "utf-8");
    console.log(`[CACHE] Dumped AI response to ${filePath}`);
  } catch (error) {
    console.error(`[CACHE] Error dumping AI response:`, error);
  }
}

// Save last game configuration
export async function saveLastGameConfig(config: LastGameConfig): Promise<void> {
  try {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
    
    const filePath = join(CACHE_DIR, "last_game_config.json");
    const content = JSON.stringify(config, null, 2);
    await writeFile(filePath, content, "utf-8");
    console.log(`[CACHE] Saved last game config: topic="${config.topic}", players=${config.players.length}`);
  } catch (error) {
    console.error(`[CACHE] Error saving last game config:`, error);
  }
}

// Read last game configuration
export async function readLastGameConfig(): Promise<LastGameConfig | null> {
  try {
    const filePath = join(CACHE_DIR, "last_game_config.json");
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await readFile(filePath, "utf-8");
    const config = JSON.parse(content) as LastGameConfig;
    console.log(`[CACHE] Loaded last game config: topic="${config.topic}", players=${config.players.length}`);
    return config;
  } catch (error) {
    console.error(`[CACHE] Error reading last game config:`, error);
    return null;
  }
}

// Save current game state
export async function saveGameState(state: GameState): Promise<void> {
  try {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
    
    const filePath = join(CACHE_DIR, "current_game_state.json");
    const content = JSON.stringify(state, null, 2);
    await writeFile(filePath, content, "utf-8");
    console.log(`[CACHE] Saved game state: question ${state.currentQuestionIndex + 1}, player ${state.currentPlayerIndex}`);
  } catch (error) {
    console.error(`[CACHE] Error saving game state:`, error);
  }
}

// Read saved game state
export async function readGameState(): Promise<GameState | null> {
  try {
    const filePath = join(CACHE_DIR, "current_game_state.json");
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await readFile(filePath, "utf-8");
    const state = JSON.parse(content) as GameState;
    console.log(`[CACHE] Loaded game state: question ${state.currentQuestionIndex + 1}, player ${state.currentPlayerIndex}`);
    return state;
  } catch (error) {
    console.error(`[CACHE] Error reading game state:`, error);
    return null;
  }
}

// Clear saved game state
export async function clearGameState(): Promise<void> {
  try {
    const filePath = join(CACHE_DIR, "current_game_state.json");
    if (existsSync(filePath)) {
      const { unlink } = await import("fs/promises");
      await unlink(filePath);
      console.log(`[CACHE] Cleared game state`);
    }
  } catch (error) {
    console.error(`[CACHE] Error clearing game state:`, error);
  }
}
