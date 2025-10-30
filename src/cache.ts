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
}

// Normalize topic to create a safe filename
function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

// Get cache file path for a topic and model
function getCacheFilePath(topic: string, model: string = "gpt-4o-mini"): string {
  const normalized = normalizeTopic(topic);
  return join(CACHE_DIR, `${model}_${normalized}.json`);
}

// Check if cache exists for a topic and model
export function cacheExists(topic: string, model: string = "gpt-4o-mini"): boolean {
  const filePath = getCacheFilePath(topic, model);
  return existsSync(filePath);
}

// Read cached data for a topic and model
export async function readCache(topic: string, model: string = "gpt-4o-mini"): Promise<CachedGameData | null> {
  try {
    const filePath = getCacheFilePath(topic, model);
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content) as CachedGameData;
    console.log(`[CACHE] Loaded cache for topic: ${topic}, model: ${model}`);
    return data;
  } catch (error) {
    console.error(`[CACHE] Error reading cache for topic ${topic}, model ${model}:`, error);
    return null;
  }
}

// Write cache data for a topic and model
export async function writeCache(data: CachedGameData, model: string = "gpt-4o-mini"): Promise<void> {
  try {
    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
    
    const filePath = getCacheFilePath(data.topic, model);
    const content = JSON.stringify(data, null, 2);
    await writeFile(filePath, content, "utf-8");
    console.log(`[CACHE] Saved cache for topic: ${data.topic}, model: ${model} to ${filePath}`);
  } catch (error) {
    console.error(`[CACHE] Error writing cache for topic ${data.topic}, model ${model}:`, error);
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
