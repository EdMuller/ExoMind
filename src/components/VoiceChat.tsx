import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AudioVisualizer } from './AudioVisualizer';
import { initAudio, getAudioContext } from '../utils/tts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function VoiceChat() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusText, setStatusText] = useState('Toque para iniciar');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startSession = async () => {
    setIsConnecting(true);
    setStatusText('Conectando...');
    initAudio();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = mediaStream;
      setStream(mediaStream);

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(mediaStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      const selectedVoice = localStorage.getItem('exo_voice_preference') || 'Zephyr';
      const liveVoice = selectedVoice === 'uHxni9EgaoUr7MGw3Der' ? 'Zephyr' : selectedVoice;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: liveVoice } },
          },
          systemInstruction: 'Você é o ExoMind, um assistente de voz útil e amigável. Responda sempre de forma concisa e natural exclusivamente em Português do Brasil.',
        },
        callbacks: {
          onopen: () => {
            setIsRecording(true);
            setIsConnecting(false);
            setStatusText('Ouvindo...');

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }

              // Convert to base64
              const buffer = new ArrayBuffer(pcmData.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcmData.length; i++) {
                view.setInt16(i * 2, pcmData[i], true);
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));

              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
                });
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setStatusText('Falando...');
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              const audioCtx = getAudioContext();
              if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
              }
              try {
                const audioBuffer = await new Promise<AudioBuffer>((resolveDecode, rejectDecode) => {
                  const decodePromise = audioCtx.decodeAudioData(
                    bytes.buffer.slice(0),
                    (decoded) => resolveDecode(decoded),
                    (err) => rejectDecode(err)
                  );
                  if (decodePromise) {
                    decodePromise.catch(rejectDecode);
                  }
                });
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                source.start();
                source.onended = () => {
                  if (isRecording) setStatusText('Ouvindo...');
                };
              } catch (e) {
                // Fallback: Assume raw 16-bit Linear PCM (24kHz)
                const pcmLength = Math.floor(len / 2);
                const audioBuffer = audioCtx.createBuffer(1, pcmLength, 24000);
                const channelData = audioBuffer.getChannelData(0);
                const dataView = new DataView(bytes.buffer);
                for (let i = 0; i < pcmLength; i++) {
                  channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
                }
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                source.start();
                source.onended = () => {
                  if (isRecording) setStatusText('Ouvindo...');
                };
              }
            }
          },
          onclose: () => {
            stopSession();
          },
          onerror: (err) => {
            console.error('Live API Error:', err);
            stopSession();
            setStatusText('Erro na conexão');
          }
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error('Error starting voice session:', error);
      setIsConnecting(false);
      setStatusText('Erro ao acessar microfone');
    }
  };

  const stopSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
    }
    setStream(null);
    setIsRecording(false);
    setIsConnecting(false);
    setStatusText('Toque para iniciar');
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 absolute inset-0"
    >
      <div className="relative mb-12">
        {isRecording && (
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" style={{ transform: 'scale(1.5)' }} />
        )}
        <button
          onClick={isRecording ? stopSession : startSession}
          disabled={isConnecting}
          className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-2xl ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-emerald-500 hover:bg-emerald-600'
          } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isConnecting ? (
            <Loader2 size={48} className="text-white animate-spin" />
          ) : isRecording ? (
            <MicOff size={48} className="text-white" />
          ) : (
            <Mic size={48} className="text-white" />
          )}
        </button>
      </div>
      
      <h3 className="text-2xl font-medium text-white mb-2">{statusText}</h3>
      <div className="h-16 w-full flex items-center justify-center mb-6">
        <AudioVisualizer stream={stream} isRecording={isRecording} />
      </div>
      <p className="text-slate-400 text-center max-w-xs">
        {isRecording 
          ? 'Fale naturalmente. O ExoMind está ouvindo e responderá em voz.' 
          : 'Pressione o botão acima para iniciar uma conversa por voz.'}
      </p>
    </motion.div>
  );
}
