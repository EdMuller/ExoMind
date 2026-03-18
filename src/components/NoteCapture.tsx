import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Save, X, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { saveItem } from '../db';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { getAI } from '../utils/ai';
import { generateItemMetadata, analyzeForSchedule } from '../utils/aiMetadata';
import { AudioVisualizer } from './AudioVisualizer';

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
  const [isSuccess, setIsSuccess] = useState(false);
  const [scheduleSuggestion, setScheduleSuggestion] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startSession = async () => {
    setIsConnecting(true);
    setStatusText('Conectando...');

    try {
      const ai = getAI();
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
          systemInstruction: 'Você está no modo de ditado. Apenas ouça o usuário. Não responda, não converse, não faça perguntas. Apenas ouça.',
          inputAudioTranscription: {},
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
            // Handle user transcription
            const transcription = message.serverContent?.inputTranscription;
            if (transcription && transcription.text) {
              setNote(prev => {
                // Se for o primeiro texto, apenas define
                if (!prev) return transcription.text || '';
                // Se já tiver texto, adiciona com espaço
                return prev + (prev.endsWith(' ') ? '' : ' ') + transcription.text;
              });
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
    setIsAnalyzing(true);
    try {
      const scheduleData = await analyzeForSchedule(note);
      if (scheduleData && scheduleData.isSchedule) {
        setScheduleSuggestion(scheduleData);
        setIsAnalyzing(false);
        return; // Wait for user confirmation
      }
      
      // If not a schedule, proceed with normal save
      await proceedSaving('note');
    } catch (error) {
      console.error('Error analyzing note:', error);
      await proceedSaving('note'); // Fallback to normal save
    }
  };

  const proceedSaving = async (type: 'note' | 'schedule', scheduleData?: any) => {
    setIsSaving(true);
    setScheduleSuggestion(null);
    try {
      if (type === 'schedule' && scheduleData) {
        const scheduleId = Date.now().toString();
        const noteId = (Date.now() + 1).toString();
        
        // Save the schedule
        await saveItem({
          id: scheduleId,
          type: 'schedule',
          content: note,
          timestamp: Date.now(),
          metadata: {
            type: 'schedule',
            title: scheduleData.title || 'Compromisso sem título',
            date: scheduleData.date || '',
            time: scheduleData.time || '',
            location: scheduleData.location || '',
            summary: scheduleData.summary || '',
            linkedNoteId: noteId
          }
        });

        // Also save the original note
        const noteMetadata = await generateItemMetadata(note, 'note');
        await saveItem({
          id: noteId,
          type: 'text',
          content: note,
          timestamp: Date.now() + 1,
          metadata: {
            type: 'note',
            title: noteMetadata?.title || 'Nota sem título',
            summary: noteMetadata?.summary || '',
            linkedScheduleId: scheduleId
          }
        });
      } else {
        const metadata = await generateItemMetadata(note, 'note');
        
        await saveItem({
          id: Date.now().toString(),
          type: 'text',
          content: note,
          timestamp: Date.now(),
          metadata: {
            type: 'note',
            title: metadata?.title || 'Nota sem título',
            summary: metadata?.summary || ''
          }
        });
      }
      setIsSuccess(true);
      setTimeout(() => {
        onSaved();
      }, 1500);
    } catch (error) {
      console.error('Error saving item:', error);
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
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-32"
            placeholder="Digite ou dite sua nota aqui..."
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!note.trim() || isSaving || isAnalyzing || isSuccess}
          className={`w-full font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {(isSaving || isAnalyzing) ? <Loader2 className="animate-spin" size={20} /> : isSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
          {isSuccess ? 'Salvo com sucesso!' : isAnalyzing ? 'Analisando...' : 'Salvar'}
        </button>

        {/* Schedule Suggestion Modal */}
        {scheduleSuggestion && (
          <div className="absolute inset-0 bg-slate-900/90 rounded-2xl flex flex-col items-center justify-center p-6 z-50 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl w-full max-w-sm text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-blue-500" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Agendamento Identificado!</h3>
              <p className="text-slate-300 text-sm mb-4">
                Parece que você anotou um compromisso. Deseja salvar na sua agenda?
              </p>
              <div className="bg-slate-900 rounded-lg p-3 text-left mb-6 border border-slate-700">
                <p className="text-white font-medium">{scheduleSuggestion.title}</p>
                <p className="text-slate-400 text-sm mt-1">
                  {scheduleSuggestion.date} {scheduleSuggestion.time ? `às ${scheduleSuggestion.time}` : ''}
                </p>
                {scheduleSuggestion.location && (
                  <p className="text-slate-400 text-sm mt-1">📍 {scheduleSuggestion.location}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => proceedSaving('note')}
                  className="flex-1 py-2 px-4 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm font-medium"
                >
                  Não, salvar como nota
                </button>
                <button
                  onClick={() => proceedSaving('schedule', scheduleSuggestion)}
                  className="flex-1 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Sim, agendar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
