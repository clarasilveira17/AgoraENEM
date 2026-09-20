import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Priority list of models optimized for Google AI Studio quotas (15 RPM / 500 RPD)
 */
export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.6-flash'
];

/**
 * Helper to call Gemini API with automatic model alias fallback, timeout & retry handling
 */
export async function generateContentWithFallback(genAI, config, contents, timeoutMs = 45000) {
  let lastErr = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        ...config,
        model: modelName
      });

      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`[Gemini Timeout] Chamada para modelo ${modelName} excedeu limite de ${timeoutMs / 1000}s.`));
        }, timeoutMs);
        if (timer.unref) timer.unref();
      });

      const result = await Promise.race([
        model.generateContent(contents),
        timeoutPromise
      ]);

      console.log(`[Gemini API] Executado com sucesso via modelo: ${modelName}`);
      return result;
    } catch (err) {
      lastErr = err;
      const msg = err.message || '';
      const isRetryable = msg.includes('404') || msg.includes('not found') ||
                          msg.includes('429') || msg.includes('Quota') ||
                          msg.includes('503') || msg.includes('Service Unavailable') ||
                          msg.includes('high demand') || msg.includes('overloaded') ||
                          msg.includes('Timeout');

      if (isRetryable) {
        console.warn(`[Gemini Fallback] Modelo ${modelName} indisponível (${msg.substring(0, 80)}...). Alternando modelo...`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

