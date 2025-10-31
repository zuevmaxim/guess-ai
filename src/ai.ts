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

export async function generateQuestions(topic: string, model: string = "gpt-4o-mini"): Promise<string[]> {
  const sys = "Ты полезный генератор игр. Выводи только валидные JSON массивы, без дополнительного текста. Ты ДОЛЖЕН отвечать ТОЛЬКО на русском языке.";
  const user = `Создай ровно 10 коротких, семейных вопросов-опросов на русском языке для темы "${topic}". 
Это для игры в стиле "Сто к одному", где игроки угадывают самые популярные ответы.

ВАЖНЫЕ ПРАВИЛА:
1. ВСЕ вопросы ДОЛЖНЫ быть на русском языке. Никогда не используй английский или другие языки.
2. Вопросы должны быть ИНТЕРЕСНЫМИ и УВЛЕКАТЕЛЬНЫМИ - избегай скучных или слишком очевидных вопросов.
3. Каждый вопрос должен иметь МНОГО ВОЗМОЖНЫХ ОТВЕТОВ (минимум 10-20 валидных вариантов), но ТОП-7 самых популярных ответов должны быть ПОНЯТНЫМИ и ОЧЕВИДНЫМИ для большинства людей.
4. Вопросы должны быть о УНИВЕРСАЛЬНЫХ темах, с которыми все могут себя ассоциировать - общий опыт, известные вещи, популярная культура, повседневная жизнь.
5. Каждый вопрос должен спрашивать только ОБ ОДНОЙ вещи - один объект, одно действие или одно прилагательное. Никогда не спрашивай о нескольких вещах.
6. Ответы должны быть максимум 1-2 слова. Избегай вопросов, требующих длинных фраз.
7. Вопросы должны быть ЛОГИЧНЫМИ - самые популярные ответы должны иметь смысл и быть предсказуемыми на основе общих знаний и опыта.
8. Хорошие примеры: "Назовите популярный фрукт" (много фруктов существует, но яблоко/банан очевидно самые популярные), "Что люди обычно едят на завтрак" (много вариантов, но есть очевидно популярные), "Какой подарок чаще всего дарят на день рождения"
9. Плохие примеры: "Назовите редкий фрукт" (слишком специфично, мало валидных ответов), "Что вы ели вчера" (слишком личное, нет четкого популярного ответа), "Назовите фрукт или овощ" (спрашивает о нескольких вещах)
10. Вопросы должны начинаться с "Назовите...", "Что люди обычно...", "Какой...", "Какая...", "Какое...", или подобных форматов.
Верни ТОЛЬКО JSON массив из 10 строк на русском языке. Без нумерации, без дополнительного текста.`;

  const res = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "[]";
  
  const list = mustArray(text, 10);
  return list.map((q) => q.trim());
}

export async function generateAnswers(question: string, topic?: string, model: string = "gpt-4o-mini"): Promise<string[]> {
  const sys = "Ты помогаешь создавать популярные ответы в стиле игры 'Сто к одному'. Выводи только JSON массивы. Ты ДОЛЖЕН отвечать ТОЛЬКО на русском языке.";
  const user = `Для вопроса-опроса: ${question}
Верни ТОЛЬКО 7 САМЫХ ПОПУЛЯРНЫХ ответов на русском языке в виде JSON массива из 7 строк, отсортированных от самого популярного (#1) до менее популярного (#7).

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. ВСЕ ответы ДОЛЖНЫ быть только на русском языке.
2. Ответы должны быть САМЫМИ ОЧЕВИДНЫМИ и МАССОВЫМИ вариантами, о которых большинство людей подумает в первую очередь.
3. Думай, как будто ты опросил 100 случайных людей - какими были бы ТОП-7 самых частых ответов?
4. Ответы должны быть ЛОГИЧНЫМИ и ПРЕДСКАЗУЕМЫМИ - вещи, которые имеют смысл на основе общих знаний, повседневного опыта и популярной культуры.
5. Приоритизируй ИЗВЕСТНЫЕ, ПОПУЛЯРНЫЕ варианты над малоизвестными, нишевыми или необычными.
6. Каждый ответ ДОЛЖЕН быть ровно 1-2 слова максимум. Никогда не используй больше 2 слов.
7. Используй только единичные существительные, прилагательные или очень короткие фразы.
8. Хорошие примеры: "Яблоко" (очень популярный фрукт), "Красный" (самый распространенный цвет), "Собака" (самый популярный питомец)
9. Плохие примеры: "Карамбола" (слишком экзотично/малоизвестно), "Яблоко и груша" (несколько предметов), "Очень красивый цветок" (слишком длинно)
10. Ранжируй ответы по НАСТОЯЩЕЙ ПОПУЛЯРНОСТИ - #1 должен быть абсолютно самым частым ответом, #7 должен быть все еще популярным, но менее.
11. Без дубликатов, без объяснений, без дополнительного текста.`;

  const res = await openai.chat.completions.create({
    model: model,
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

export async function compareGuess(guess: string, answers: string[]): Promise<{ matchIndex: number | null; similarity: number }> {
  // Convert to lowercase and normalize ё to е before building embeddings
  const normalize = (text: string) => text.toLowerCase().replace(/ё/g, 'е');
  const guessLower = normalize(guess);
  const answersLower = answers.map(a => normalize(a));
  
  // Compute embeddings for guess and answers
  const inputs = [guessLower, ...answersLower];
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
  // Threshold similarity > 0.7 ⇒ match
  const matchIndex = best > 0.7 ? bestIdx : null;
  return { matchIndex, similarity: best };
}
