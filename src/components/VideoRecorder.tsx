import React, { useState, useEffect, useRef } from 'react';
import { Video, Square, Save, Trash2, X, Play, Pause, Loader2, Camera, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveItem } from '../db';

interface VideoRecorderProps {
  folderId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function VideoRecorder({ folderId, onSaved, onCancel }: VideoRecorderProps) {
  const [mode, setMode] = useState<'select' | 'record'>('select');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (mode === 'record' && !videoBlob) {
      startPreview();
    }
    return () => {
      stopPreview();
      if (timerRef.current) clearInterval(timerRef.current);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoBlob, facingMode, mode]);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode }, 
        audio: true 
      });
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Erro ao acessar a câmera. Verifique as permissões.');
    }
  };

  const stopPreview = () => {
    if (videoPreviewRef.current?.srcObject) {
      const stream = videoPreviewRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startRecording = async () => {
    try {
      const stream = videoPreviewRef.current?.srcObject as MediaStream;
      if (!stream) return;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        stopPreview();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoBlob(file);
      setVideoUrl(URL.createObjectURL(file));
      setMode('record'); // Switch to preview mode
    }
  };

  const handleSave = async () => {
    if (!videoBlob) return;
    setIsSaving(true);
    try {
      const finalTitle = title.trim() || 'Vídeo Salvo';
      const finalSummary = description.trim() || 'Gravação de vídeo';
      
      await saveItem({
        id: Date.now().toString(),
        type: 'video',
        content: videoBlob,
        timestamp: Date.now(),
        folderId,
        title: finalTitle,
        summary: finalSummary,
        metadata: {
          title: finalTitle,
          description: description.trim(),
          summary: finalSummary,
          type: 'video'
        }
      });
      onSaved();
    } catch (err) {
      console.error('Error saving video:', err);
      alert('Erro ao salvar o vídeo.');
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
      className="flex-1 flex flex-col p-4 bg-slate-900 absolute inset-0 z-40"
    >
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="w-full flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-white">Vídeo</h2>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {mode === 'select' && !videoBlob ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <div className="grid grid-cols-1 gap-4 w-full">
              <button
                onClick={() => setMode('record')}
                className="w-full py-6 rounded-3xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-red-500 hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <Video size={40} className="text-slate-400 group-hover:text-red-400 transition-colors" />
                <span className="text-slate-300 font-medium text-base">Gravar Vídeo</span>
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
          <div className="flex-1 flex flex-col items-center justify-center w-full relative">
            <div className="w-full aspect-[9/16] max-h-[45vh] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-800">
              {!videoBlob ? (
                <>
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {isRecording && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-2.5 py-1 rounded-full text-white font-bold text-xs animate-pulse">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      REC {formatTime(recordingTime)}
                    </div>
                  )}
                  {!isRecording && (
                    <button
                      onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                      className="absolute top-4 right-4 p-2.5 bg-slate-900/50 backdrop-blur-md rounded-full text-white hover:bg-slate-800 transition-all"
                    >
                      <Camera size={20} />
                    </button>
                  )}
                </>
              ) : (
                <video
                  ref={videoPlaybackRef}
                  src={videoUrl!}
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="mt-5 w-full flex flex-col items-center gap-4">
              {!videoBlob ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                      isRecording ? 'bg-red-600 hover:bg-red-700 scale-110' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isRecording ? <Square size={20} fill="white" className="text-white" /> : <Video size={24} className="text-white" />}
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
                        if (videoPlaybackRef.current?.paused) videoPlaybackRef.current.play();
                        else videoPlaybackRef.current?.pause();
                        setIsPlaying(!isPlaying);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-slate-800 flex items-center justify-center gap-3 text-white hover:bg-slate-700 transition-all border border-slate-700 text-sm"
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} fill="white" />}
                      <span className="font-bold">{isPlaying ? 'Pausar' : 'Ouvir Gravação'}</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setVideoBlob(null);
                        setVideoUrl(null);
                        setRecordingTime(0);
                        setMode('select');
                      }}
                      className="p-3 rounded-2xl bg-slate-800 flex items-center justify-center text-red-400 hover:bg-slate-700 transition-all border border-slate-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-400 ml-1">Título (Opcional)</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Dê um nome para este vídeo..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-400 ml-1">Descrição / Resumo</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="O que acontece neste vídeo?"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none h-20 text-sm"
                      />
                    </div>
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
      </div>
    </motion.div>
  );
}
