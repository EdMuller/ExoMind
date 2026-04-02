import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "../constants";

// @ts-ignore
const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

export const generateAIResponse = async (prompt: string, systemInstruction?: string) => {
  try {
    const response = await genAI.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || "Você é um assistente pessoal holístico e eficiente.",
        temperature: 0.7,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Erro na IA:", error);
    return "Desculpe, tive um problema ao processar sua solicitação.";
  }
};

export const analyzeImage = async (base64Image: string, prompt: string) => {
  try {
    const response = await genAI.models.generateContent({
      model: AI_MODEL,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
        ]
      }
    });
    return response.text;
  } catch (error) {
    console.error("Erro na análise de imagem:", error);
    return "Não consegui analisar a imagem.";
  }
};
