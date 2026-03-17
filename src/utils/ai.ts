import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not defined. Please check your environment variables.');
      // Return a dummy instance or throw a clear error
      throw new Error('A chave da API do Gemini não foi configurada. Por favor, adicione a variável GEMINI_API_KEY nas configurações do seu servidor (Vercel).');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}
