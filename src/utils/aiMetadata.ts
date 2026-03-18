import { GoogleGenAI, Type } from '@google/genai';
import { getAI } from './ai';

export async function analyzeForSchedule(content: string) {
  try {
    const ai = getAI();
    const prompt = `Analise o seguinte texto e determine se ele contém uma intenção clara de agendamento, compromisso, lembrete com data/hora, ou evento futuro.
Se SIM, extraia os detalhes. Se NÃO, retorne isSchedule: false.

Texto: "${content}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSchedule: { type: Type.BOOLEAN, description: "Verdadeiro se o texto for um agendamento ou compromisso" },
            title: { type: Type.STRING, description: "Título curto do compromisso (máx 30 caracteres)" },
            date: { type: Type.STRING, description: "Data no formato DD/MM/AAAA, se houver" },
            time: { type: Type.STRING, description: "Horário no formato HH:MM, se houver" },
            location: { type: Type.STRING, description: "Local ou cidade, se houver" },
            summary: { type: Type.STRING, description: "Resumo de uma linha" },
          },
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error('Error analyzing for schedule:', error);
    return { isSchedule: false };
  }
}

export async function generateItemMetadata(content: string, type: 'note' | 'photo' | 'location' | 'schedule') {
  try {
    let prompt = '';
    const ai = getAI();
    if (type === 'note') {
      prompt = `Analise a seguinte nota e extraia:
1. Um título curto que represente o foco principal (máximo 30 caracteres).
2. Um resumo de uma linha que acrescente informação ao título (não repita o título).
Nota: "${content}"`;
    } else if (type === 'photo') {
      prompt = `Analise a seguinte descrição de uma foto e extraia:
1. Um título curto que represente o foco principal (máximo 30 caracteres).
2. Um resumo de uma linha que acrescente informação ao título.
Descrição: "${content}"`;
    } else if (type === 'location') {
      prompt = `Analise a seguinte descrição de um local e extraia:
1. Um título curto com o nome do local ou foco principal (máximo 30 caracteres).
2. Um resumo de uma linha com informação adicional.
Descrição: "${content}"`;
    } else if (type === 'schedule') {
      prompt = `Analise o seguinte agendamento e extraia:
1. Um título curto (máximo 30 caracteres).
2. A data (formato DD/MM/AAAA).
3. O horário (formato HH:MM).
4. O local ou cidade (se mencionado, caso contrário vazio).
5. Um resumo de uma linha com informação adicional.
Agendamento: "${content}"`;
    }

    const schemaProperties: any = {
      title: { type: Type.STRING, description: "Título curto (máx 30 caracteres)" },
      summary: { type: Type.STRING, description: "Resumo de uma linha" },
    };

    if (type === 'schedule') {
      schemaProperties.date = { type: Type.STRING, description: "Data no formato DD/MM/AAAA" };
      schemaProperties.time = { type: Type.STRING, description: "Horário no formato HH:MM" };
      schemaProperties.location = { type: Type.STRING, description: "Local ou cidade, se houver" };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error('Error generating metadata:', error);
    return null;
  }
}
