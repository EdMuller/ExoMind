import { GoogleGenAI, Type } from '@google/genai';
import { getAI } from './ai';

export async function analyzeForSchedule(content: string) {
  try {
    const ai = getAI();
    const currentDate = new Date().toLocaleString('pt-BR');
    const prompt = `Analise o seguinte texto e determine se ele contém uma intenção clara de agendamento, compromisso, lembrete com data/hora, ou evento futuro.
Se SIM, extraia os detalhes. Se NÃO, retorne isSchedule: false.

Considere que a data e hora atual é: ${currentDate}. Resolva datas relativas (como "hoje", "amanhã", "próxima quarta") com base nesta data atual.

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "isSchedule": boolean,
  "title": "Título curto (máx 30 caracteres)",
  "date": "Data no formato DD/MM/AAAA (se houver)",
  "time": "Horário no formato HH:MM (se houver)",
  "location": "Local ou cidade (se houver)",
  "summary": "Resumo de uma linha"
}

Texto: "${content}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(text);
    return result;
  } catch (error) {
    console.error('Error analyzing for schedule:', error);
    return { isSchedule: false };
  }
}

export async function analyzePhoto(base64Data: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
              }
            },
            { text: "Descreva o que você vê nesta imagem de forma concisa e objetiva. Identifique objetos, textos ou o contexto geral. Retorne apenas a descrição em português." }
          ]
        }
      ]
    });
    return response.text || '';
  } catch (error) {
    console.error('Error analyzing photo:', error);
    return '';
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

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "title": "Título curto",
  "summary": "Resumo de uma linha"
}

Nota: "${content}"`;
    } else if (type === 'photo') {
      prompt = `Analise a seguinte descrição de uma foto e extraia:
1. Um título curto que represente o foco principal (máximo 30 caracteres).
2. Um resumo de uma linha que acrescente informação ao título.

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "title": "Título curto",
  "summary": "Resumo de uma linha"
}

Descrição: "${content}"`;
    } else if (type === 'location') {
      prompt = `Analise a seguinte descrição de um local e extraia:
1. Um título curto com o nome do local ou foco principal (máximo 30 caracteres).
2. Um resumo de uma linha com informação adicional.

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "title": "Título curto",
  "summary": "Resumo de uma linha"
}

Descrição: "${content}"`;
    } else if (type === 'schedule') {
      const currentDate = new Date().toLocaleString('pt-BR');
      prompt = `Analise o seguinte agendamento e extraia:
1. Um título curto (máximo 30 caracteres).
2. A data (formato DD/MM/AAAA).
3. O horário (formato HH:MM).
4. O local ou cidade (se mencionado, caso contrário vazio).
5. Um resumo de uma linha com informação adicional.

Considere que a data e hora atual é: ${currentDate}. Resolva datas relativas (como "hoje", "amanhã", "próxima quarta") com base nesta data atual.

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "title": "Título curto",
  "date": "Data",
  "time": "Horário",
  "location": "Local",
  "summary": "Resumo de uma linha"
}

Agendamento: "${content}"`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(text);
    return result;
  } catch (error) {
    console.error('Error generating metadata:', error);
    return null;
  }
}
