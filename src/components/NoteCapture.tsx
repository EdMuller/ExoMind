import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { saveItem } from '../db';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { generateItemMetadata } from '../utils/aiMetadata';
import { AudioVisualizer } from './AudioVisualizer';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface NoteCaptureProps {
  inputMode: 'text' | 'voice';
  onSaved: () => void;
  onCancel: () => void;
}

export function NoteCapture({ inputMode, onSaved, onCancel }: NoteCaptureProps) {
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
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

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          systemInstruction: 'Aja EXCLUSIVAMENTE como um transcritor de áudio. O usuário vai falar em Português do Brasil. Escreva EXATAMENTE o que ele disser, palavra por palavra, em Português do Brasil. NÃO converse, NÃO responda perguntas, NÃO adicione comentários. Apenas retorne o texto do que foi dito.',
          outputAudioTranscription: {},
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
              
              const audioCtx = new AudioContext({ sampleRate: 24000 });
              try {
                const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                source.start();
                source.onended = () => {
                  if (isRecording) setStatusText('Ouvindo...');
                };
              } catch (e) {
                console.error('Error decoding audio', e);
              }
            }
            
            // Handle transcription
            const text = message.serverContent?.modelTurn?.parts[0]?.text;
            if (text) {
               setNote(prev => prev + ' ' + text);
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

  const handleSave = async () => {
    if (!note.trim()) return;
    setIsSaving(true);
    try {
      const metadata = await generateItemMetadata(note, 'note');
      
      await saveItem({
        id: Date.now().toString(),
        type: 'text',
        content: note,
        timestamp: Date.now(),
        metadata: {
          type: 'note',
          title: metadata?.title,
          summary: metadata?.summary
        }
      });
      onSaved();
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 absolute inset-0"
    >
      <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative">
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold text-white mb-6">Novo Comentário</h2>

        {inputMode === 'voice' ? (
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-8 mt-4">
              {isRecording && (
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" style={{ transform: 'scale(1.5)' }} />
              )}
              <button
                onClick={isRecording ? stopSession : startSession}
                disabled={isConnecting}
                className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-emerald-500 hover:bg-emerald-600'
                } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isConnecting ? (
                  <Loader2 size={32} className="text-white animate-spin" />
                ) : isRecording ? (
                  <MicOff size={32} className="text-white" />
                ) : (
                  <Mic size={32} className="text-white" />
                )}
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">{statusText}</p>
            <div className="h-16 w-full flex items-center justify-center">
              <AudioVisualizer stream={stream} isRecording={isRecording} />
            </div>
          </div>
        ) : null}

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-400 mb-2">Nota</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-32"
            placeholder="Digite ou dite sua nota aqui..."
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!note.trim() || isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          Salvar
        </button>
      </div>
    </motion.div>
  );
}
