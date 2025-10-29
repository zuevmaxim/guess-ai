import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function mustArray(jsonText: string, expectedLength: number): string[] {
  try {
    const data = JSON.parse(jsonText);
    if (Array.isArray(data) && data.length >= expectedLength && data.every((x) => typeof x === "string")) {
      return data.slice(0, expectedLength);
    }
  } catch {
    // fall through to retry path below
  }
  // If parsing failed, try to salvage arrays from text using a regex
  const match = jsonText.match(/\[(.|\n|\r)*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr)) {
        return arr.filter((x) => typeof x === "string").slice(0, expectedLength);
      }
    } catch {
      // ignore
    }
  }
  throw new Error("Model did not return a valid JSON array of strings");
}

export async function generateQuestions(topic: string): Promise<string[]> {
  const sys = "You are a helpful game generator. Output only valid JSON arrays, no prose.";
  const user = `Create exactly 10 short, family-friendly survey questions for the topic "${topic}". 
Return ONLY a JSON array of 10 strings. No numbering, no extra text.`;

  const res = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "[]";
  const list = mustArray(text, 10);
  return list.map((q) => q.trim());
}

export async function generateAnswers(question: string): Promise<string[]> {
  const sys = "You help create Family Feud–style popular answers. Output only JSON arrays.";
  const user = `For the survey question: ${question}\nReturn ONLY the 7 most popular, concise answers as a JSON array of 7 strings. No duplicates, no explanations.`;

  const res = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "[]";
  const list = mustArray(text, 7);
  return list.map((a) => a.trim());
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function compareGuess(guess: string, answers: string[]): Promise<number | null> {
  // Compute embeddings for guess and answers
  const inputs = [guess, ...answers];
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: inputs,
  });
  const vectors = emb.data.map((d) => d.embedding as number[]);
  const guessVec = vectors[0];
  let bestIdx = -1;
  let best = -1;
  for (let i = 0; i < answers.length; i++) {
    const sim = cosineSim(guessVec, vectors[i + 1]);
    if (sim > best) {
      best = sim;
      bestIdx = i;
    }
  }
  // Threshold similarity > 0.8 ⇒ match
  if (best > 0.8) return bestIdx;
  return null;
}
