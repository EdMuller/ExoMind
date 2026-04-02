import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Mic, Square, Save, Trash2, X, Play, Pause, Loader2, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveItem } from '../db';

interface AudioRecorderProps {
  folderId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function AudioRecorder({ folderId, onSaved, onCancel }: AudioRecorderProps) {
  const [mode, setMode] = useState<'select' | 'record'>('select');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(40).fill(4));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRecordingRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      updateLevels();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Erro ao acessar o microfone. Verifique as permissões.');
    }
  };

  const updateLevels = () => {
    if (!analyzerRef.current || !isRecordingRef.current) return;
    
    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzerRef.current.getByteFrequencyData(dataArray);
    
    // Create a more dynamic visualization by sampling different frequency ranges
    const newLevels = [];
    const step = Math.floor(bufferLength / 40);
    
    for (let i = 0; i < 40; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j];
      }
      const average = sum / step;
      // Apply some non-linear scaling for better visual impact
      const level = Math.max(6, (average / 255) * 120);
      newLevels.push(level);
    }
    
    setAudioLevels(newLevels);
    animationRef.current = requestAnimationFrame(updateLevels);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      setMode('record'); // Switch to preview mode
    }
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    setIsSaving(true);
    try {
      await saveItem({
        id: uuidv4(),
        type: 'audio',
        content: audioBlob,
        timestamp: Date.now(),
        folderId,
      });
      onSaved();
    } catch (err) {
      console.error('Error saving audio:', err);
      alert('Erro ao salvar o áudio.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col p-4 bg-slate-900 absolute inset-0 z-40 overflow-y-auto"
    >
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="w-full flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold text-white">Áudio</h2>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {mode === 'select' && !audioBlob ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full">
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <div className="grid grid-cols-1 gap-4 w-full">
              <button
                onClick={() => setMode('record')}
                className="w-full py-6 rounded-3xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-red-500 hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <Mic size={40} className="text-slate-400 group-hover:text-red-400 transition-colors" />
                <span className="text-slate-300 font-medium text-base">Gravar Áudio</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 rounded-3xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-blue-500 hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <Upload size={40} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                <span className="text-slate-300 font-medium text-base">Upload de Arquivo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Visualization */}
            <div className="flex items-center justify-center gap-0.5 h-40 mb-4 w-full">
              {audioLevels.map((level, i) => (
                <motion.div
                  key={i}
                  animate={{ height: level }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className={`w-1.5 rounded-full ${isRecording ? 'bg-red-500' : 'bg-blue-500/50'}`}
                />
              ))}
            </div>

            <div className="text-2xl font-mono text-white mb-4 tabular-nums">
              {formatTime(recordingTime)}
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
              {!audioBlob ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                      isRecording ? 'bg-red-600 hover:bg-red-700 scale-110' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isRecording ? <Square size={24} fill="white" className="text-white" /> : <Mic size={28} className="text-white" />}
                  </button>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`px-6 py-2.5 rounded-full font-bold text-white transition-all text-sm ${
                      isRecording ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isRecording ? 'Interromper Gravação' : 'Iniciar Gravação'}
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        if (isPlaying) audioRef.current?.pause();
                        else audioRef.current?.play();
                        setIsPlaying(!isPlaying);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-slate-800 flex items-center justify-center gap-3 text-white hover:bg-slate-700 transition-all border border-slate-700 text-sm"
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} fill="white" />}
                      <span className="font-bold">{isPlaying ? 'Pausar' : 'Ouvir Gravação'}</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setAudioBlob(null);
                        setAudioUrl(null);
                        setRecordingTime(0);
                        setMode('select');
                        isRecordingRef.current = false;
                      }}
                      className="p-3 rounded-2xl bg-slate-800 flex items-center justify-center text-red-400 hover:bg-slate-700 transition-all border border-slate-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={22} />}
                    {isSaving ? 'Salvando...' : 'Salvar no ExoMind'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
      </div>
    </motion.div>
  );
}
