import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { saveCapture } from '../db';
import { generateAIResponse } from '../utils/ai';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  Save, 
  Loader2, 
  Sparkles, 
  CheckCircle2,
  AlertCircle,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AudioRecorder: React.FC = () => {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'recording' | 'recorded' | 'saving' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setStatus('recorded');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus('recording');
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      setError("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!user || !audioBlob) return;
    
    setIsProcessing(true);
    setStatus('saving');
    
    try {
      // Simulação de transcrição e resumo via IA
      let aiSummary = await generateAIResponse(
        "Resuma este áudio fictício de uma reunião sobre produtividade holística.",
        "Você é um especialista em transcrição e resumo de áudio."
      );

      if (!aiSummary) aiSummary = "Resumo indisponível no momento.";

      await saveCapture(user.uid, 'audio', {
        duration: recordingTime,
        summary: aiSummary,
        // Em um app real, aqui faríamos upload para o Firebase Storage
        storagePath: `audio/${user.uid}/${Date.now()}.webm`
      }, {
        title: `Gravação de Voz - ${new Date().toLocaleDateString()}`,
        description: aiSummary,
        tags: ['voz', 'holístico', 'produtividade']
      });

      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setError("Falha ao salvar a gravação.");
    } finally {
      setIsProcessing(false);
      setAudioBlob(null);
      setRecordingTime(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-zinc-100">Gravador Inteligente</h3>
        <p className="text-zinc-400">Capture suas ideias e deixe a IA transcrever e organizar para você.</p>
      </div>

      <div className="flex flex-col items-center justify-center py-12 space-y-8">
        {/* Recording Visualizer (Mock) */}
        <div className="relative flex items-center justify-center">
          <AnimatePresence>
            {isRecording && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 0.2 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute w-32 h-32 bg-red-500 rounded-full"
              />
            )}
          </AnimatePresence>
          
          <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-2xl relative z-10 ${
            isRecording ? 'bg-red-500 shadow-red-500/20' : 'bg-zinc-800 border border-zinc-700'
          }`}>
            {isRecording ? (
              <Square className="w-10 h-10 text-white fill-current" />
            ) : (
              <Mic className={`w-10 h-10 ${status === 'success' ? 'text-emerald-400' : 'text-zinc-400'}`} />
            )}
          </div>
        </div>

        <div className="text-4xl font-mono font-bold tracking-widest text-zinc-100">
          {formatTime(recordingTime)}
        </div>

        <div className="flex items-center gap-4">
          {!isRecording && status === 'idle' && (
            <button
              onClick={startRecording}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-3 active:scale-95"
            >
              <Mic className="w-5 h-5" />
              Começar Gravação
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center gap-3 active:scale-95"
            >
              <Square className="w-5 h-5" />
              Parar Agora
            </button>
          )}

          {status === 'recorded' && !isProcessing && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStatus('idle')}
                className="p-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-2xl transition-all"
              >
                <Trash2 className="w-6 h-6" />
              </button>
              <button
                onClick={handleSave}
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-3 active:scale-95"
              >
                <Save className="w-5 h-5" />
                Salvar e Processar
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 px-8 py-4 bg-zinc-800 text-zinc-400 font-bold rounded-2xl border border-zinc-700">
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando com IA...
            </div>
          )}

          {status === 'success' && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 px-8 py-4 bg-emerald-500/10 text-emerald-400 font-bold rounded-2xl border border-emerald-500/20"
            >
              <CheckCircle2 className="w-5 h-5" />
              Salvo com Sucesso!
            </motion.div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="pt-8 border-t border-zinc-800 grid grid-cols-2 gap-4">
        <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800 space-y-1">
          <div className="flex items-center gap-2 text-indigo-400">
            <Volume2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Qualidade</span>
          </div>
          <p className="text-sm text-zinc-100">Áudio HD Estéreo</p>
        </div>
        <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800 space-y-1">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">IA Ativa</span>
          </div>
          <p className="text-sm text-zinc-100">Resumo Automático</p>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
