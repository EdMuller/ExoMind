import { generateAIResponse } from "./ai";

export const extractMetadataFromText = async (text: string) => {
  const prompt = `
    Analise o seguinte texto e extraia metadados úteis para organização:
    Texto: "${text}"
    
    Retorne APENAS um objeto JSON com:
    {
      "title": "Um título curto e descritivo",
      "description": "Um resumo de uma frase",
      "tags": ["array", "de", "tags", "relevantes"]
    }
  `;

  try {
    const response = await generateAIResponse(prompt, "Você é um especialista em organização de dados.");
    if (!response) {
      return { title: "Nova Captura", description: text.substring(0, 50), tags: [] };
    }
    
    // Tenta extrair o JSON da resposta (que pode vir com markdown)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { title: "Nova Captura", description: text.substring(0, 50), tags: [] };
  } catch (error) {
    console.error("Erro ao extrair metadados:", error);
    return { title: "Nova Captura", description: text.substring(0, 50), tags: [] };
  }
};
