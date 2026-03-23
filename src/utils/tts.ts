import { GoogleGenAI, Modality } from '@google/genai';
import { getAI } from './ai';

let sharedAudioCtx: AudioContext | null = null;
let audioUnlocked = false;

export function getAudioContext() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioCtx;
}

export function initAudio() {
  if (audioUnlocked) return;
  
  try {
    const audioCtx = getAudioContext();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(console.error);
    }
    
    // Play a silent buffer to unlock Web Audio API
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);

    // Unlock HTML5 Audio (for ElevenLabs)
    const audio = new Audio();
    audio.src = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    audio.play().catch(() => {});

    audioUnlocked = true;
  } catch (e) {
    console.error('Failed to unlock audio:', e);
  }
}

export async function playTTS(text: string, voiceId: string, rate: number = 1.0): Promise<void> {
  // Resume audio context synchronously if possible, or at least initiate it
  initAudio();
  const audioCtx = getAudioContext();

  return new Promise(async (resolve, reject) => {
    try {
      if (voiceId === 'uHxni9EgaoUr7MGw3Der') {
        const apiKey = process.env.ELEVENLABS_SECRET_KEY;
        if (!apiKey) {
          throw new Error('ElevenLabs API Key not configured');
        }
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (!response.ok) {
          throw new Error('Falha ao gerar áudio com ElevenLabs');
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = rate;
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        audio.play().catch(e => {
          console.error('Error playing audio:', e);
          resolve();
        });
      } else {
        const ai = getAI();
        console.log('Requesting TTS from Gemini for voice:', voiceId);
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceId || 'Zephyr' },
              },
            },
          },
        });

        console.log('TTS Response received:', response);
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          console.log('Audio data found, decoding...');
          const binaryString = atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          let audioBuffer: AudioBuffer;

          try {
            audioBuffer = await new Promise<AudioBuffer>((resolveDecode, rejectDecode) => {
              const decodePromise = audioCtx.decodeAudioData(
                bytes.buffer.slice(0),
                (decoded) => resolveDecode(decoded),
                (err) => rejectDecode(err)
              );
              if (decodePromise) {
                decodePromise.catch(rejectDecode);
              }
            });
          } catch (decodeError) {
            // Fallback to raw PCM (16-bit, 24kHz, mono)
            const pcmLength = Math.floor(len / 2);
            audioBuffer = audioCtx.createBuffer(1, pcmLength, 24000);
            const channelData = audioBuffer.getChannelData(0);
            const dataView = new DataView(bytes.buffer);
            for (let i = 0; i < pcmLength; i++) {
              // Read 16-bit integer (little-endian) and normalize to [-1, 1]
              channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
            }
          }

          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(console.error);
          }

          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = rate;
          source.connect(audioCtx.destination);
          source.onended = () => {
            resolve();
          };
          source.start(0);
        } else {
          console.error('No audio data returned from Gemini');
          resolve();
        }
      }
    } catch (error) {
      console.error('TTS Error:', error);
      resolve(); // Resolve anyway so we don't block the UI
    }
  });
}
