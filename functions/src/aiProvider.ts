import { defineSecret } from 'firebase-functions/params';

/**
 * Pluggable AI provider for question generation.
 *
 * Default: Google Gemini (has a usable free tier for the Gemini API,
 * https://ai.google.dev/pricing) since the brief was "whichever is free".
 * Swapping providers later only means rewriting `callLLM` below - nothing
 * else in generateQuestions.ts needs to change as long as it still returns
 * a plain string containing the model's raw text response.
 */

export const geminiApiKey = defineSecret('GEMINI_API_KEY');

const GEMINI_MODEL = 'gemini-2.0-flash'; // fast + free-tier eligible; adjust as needed

export async function callLLM(prompt: string): Promise<string> {
  const apiKey = geminiApiKey.value();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned no text content');
  }
  return text;
}

export const AI_MODEL_NAME = GEMINI_MODEL;
