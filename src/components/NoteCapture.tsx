import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Save, X, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { saveItem } from '../db';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { getAI } from '../utils/ai';
import { generateItemMetadata, analyzeForSchedule } from '../utils/aiMetadata';
import { generateICS } from '../utils/calendar';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusText, setStatusText] = useState('Pressione para Falar');
  const [isSuccess, setIsSuccess] = useState(false);
  const [scheduleSuggestion, setScheduleSuggestion] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceInput(audioBlob);
      };

      // Set up audio visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const updateLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 128);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      mediaRecorder.start();
      setIsRecording(true);
      setStatusText('Gravando...');
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatusText('Erro ao acessar microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setStatusText('Processando...');
      
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/webm',
                  data: base64Audio
                }
              },
              { text: "Transcreva exatamente o que foi dito no áudio acima. Retorne apenas a transcrição, sem comentários." }
            ]
          }
        ]
      });

      const transcription = response.text || '';
      if (transcription) {
        setNote(prev => prev + (prev ? ' ' : '') + transcription.trim());
      }
      setStatusText('Pressione para Falar');
    } catch (error) {
      console.error('Error processing voice input:', error);
      setStatusText('Erro ao processar áudio');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
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

        // Automatically trigger calendar download
        generateICS(scheduleData);
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
          <div className="flex flex-col items-center mb-6 gap-4">
            <div className="relative">
              {isRecording && (
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2 + audioLevel * 2, 1],
                    opacity: [0.2, 0.4 + audioLevel, 0.2]
                  }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 bg-emerald-500/20 rounded-full" 
                  style={{ transform: 'scale(1.5)' }} 
                />
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isRecording 
                    ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing ? (
                  <Loader2 size={32} className="text-white animate-spin" />
                ) : isRecording ? (
                  <Mic size={32} className="text-white" />
                ) : (
                  <Mic size={32} className="text-white" />
                )}
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-white font-bold mb-1">
                {isRecording ? 'Gravando...' : isProcessing ? 'Processando...' : 'Pressione para Falar'}
              </p>
              <p className="text-slate-400 text-xs">
                {isRecording ? 'Clique no botão para Enviar' : 'Sua voz será transcrita abaixo'}
              </p>
            </div>

            {isRecording && (
              <div className="w-full max-w-[200px] bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-700">
                <motion.div 
                  className="h-full bg-emerald-500"
                  animate={{ width: `${Math.min(100, audioLevel * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>
            )}
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
