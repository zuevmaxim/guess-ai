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
  const sys = "You are a helpful game generator. Output only valid JSON arrays, no prose. You MUST respond in Russian language only.";
  const user = `Create exactly 10 short, family-friendly survey questions IN RUSSIAN LANGUAGE for the topic "${topic}". 
IMPORTANT RULES:
1. ALL questions MUST be in RUSSIAN language. Never use English or any other language.
2. All questions must be open-ended. Never create yes/no questions or questions that can be answered with a single word like "yes" or "no".
3. Each question must ask for ONE SINGLE thing only - one object, one action, or one adjective. Never ask for multiple things in a single question.
4. Questions MUST be designed so that answers are only 1-2 words maximum. Avoid questions that require long phrases or sentences.
5. Good examples: "Назовите популярный фрукт", "Какое животное часто держат дома", "Какой цвет успокаивает"
6. Bad examples: "Назовите фрукт или овощ", "Какие популярные домашние животные", "Какие цвета и формы вам нравятся"
7. Questions should ask "Назовите...", "Какой...", "Какая...", "Какое...", or similar formats that require a single descriptive answer.
Return ONLY a JSON array of 10 strings IN RUSSIAN. No numbering, no extra text.`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "[]";
  
  const list = mustArray(text, 10);
  return list.map((q) => q.trim());
}

export async function generateAnswers(question: string, topic?: string): Promise<string[]> {
  const sys = "You help create Family Feud–style popular answers. Output only JSON arrays. You MUST respond in Russian language only.";
  const user = `For the survey question: ${question}
Return ONLY the 7 most popular answers IN RUSSIAN LANGUAGE as a JSON array of 7 strings.
CRITICAL RULES:
1. ALL answers MUST be in RUSSIAN language only.
2. Each answer MUST be exactly 1-2 words maximum. Never use more than 2 words.
3. Use single nouns, adjectives, or very short phrases only.
4. Good examples: "Яблоко", "Красный", "Большой дом"
5. Bad examples: "Яблоко и груша", "Очень красивый цветок", "Поездка на море летом"
6. No duplicates, no explanations, no extra text.`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "[]";
  const list = mustArray(text, 7);
  const answers = list.map((a) => a.trim());
  
  // Log the generated answers
  console.log(`[AI] Generated answers for "${question}":`, answers);
  
  return answers;
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
