import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { saveCapture } from '../db';
import { 
  Video, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  Save, 
  Loader2, 
  Sparkles, 
  CheckCircle2,
  AlertCircle,
  Camera,
  RefreshCw,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VideoRecorder: React.FC = () => {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'preview' | 'recording' | 'recorded' | 'saving' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('preview');
    } catch (err) {
      console.error("Erro ao acessar câmera/microfone:", err);
      setError("Não foi possível acessar a câmera ou o microfone.");
    }
  };

  const stopPreview = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setStatus('idle');
  };

  const startRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setVideoBlob(blob);
      setStatus('recorded');
    };

    mediaRecorder.start();
    setIsRecording(true);
    setStatus('recording');
    setRecordingTime(0);
    
    timerRef.current = window.setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
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
    if (!user || !videoBlob) return;
    
    setIsProcessing(true);
    setStatus('saving');
    
    try {
      await saveCapture(user.uid, 'video', {
        duration: recordingTime,
        storagePath: `video/${user.uid}/${Date.now()}.webm`
      }, {
        title: `Gravação de Vídeo - ${new Date().toLocaleDateString()}`,
        description: "Captura de vídeo pessoal.",
        tags: ['vídeo', 'holístico']
      });

      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setVideoBlob(null);
        setRecordingTime(0);
      }, 3000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setError("Falha ao salvar a gravação.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-zinc-100">Gravador de Vídeo</h3>
        <p className="text-zinc-400">Capture momentos, reuniões ou reflexões em vídeo.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-20 flex flex-col items-center justify-center space-y-6"
            >
              <div className="p-6 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                <Video className="w-12 h-12 text-indigo-400" />
              </div>
              <button
                onClick={startPreview}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-3 active:scale-95"
              >
                <Camera className="w-5 h-5" />
                Ativar Câmera
              </button>
            </motion.div>
          )}

          {(status === 'preview' || status === 'recording') && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative aspect-video bg-black"
            >
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover"
              />
              
              <div className="absolute top-6 left-6 flex items-center gap-3">
                {status === 'recording' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-full text-xs font-bold animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    REC {formatTime(recordingTime)}
                  </div>
                )}
              </div>

              <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
                {status === 'preview' ? (
                  <>
                    <button
                      onClick={stopPreview}
                      className="p-4 bg-zinc-900/80 text-white rounded-full hover:bg-zinc-800"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <button
                      onClick={startRecording}
                      className="p-6 bg-red-600 text-white rounded-full hover:bg-red-500 shadow-xl active:scale-95 border-4 border-white/20"
                    >
                      <div className="w-8 h-8 rounded-full bg-white" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="p-6 bg-white text-zinc-950 rounded-full hover:bg-zinc-100 shadow-xl active:scale-95"
                  >
                    <Square className="w-8 h-8 fill-current" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {status === 'recorded' && videoBlob && (
            <motion.div 
              key="recorded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 space-y-6"
            >
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video">
                <video 
                  src={URL.createObjectURL(videoBlob)} 
                  controls 
                  className="w-full h-full"
                />
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    setVideoBlob(null);
                    startPreview();
                  }}
                  className="px-8 py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl hover:bg-zinc-700"
                >
                  Gravar Outro
                </button>
                <button
                  onClick={handleSave}
                  className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Salvar Vídeo
                </button>
              </div>
            </motion.div>
          )}

          {(status === 'saving' || status === 'success') && (
            <motion.div 
              key="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-20 flex flex-col items-center justify-center space-y-6"
            >
              {status === 'saving' ? (
                <>
                  <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                  <p className="text-xl font-bold text-zinc-100">Salvando Gravação...</p>
                </>
              ) : (
                <>
                  <div className="p-4 bg-emerald-500/10 rounded-full">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                  </div>
                  <p className="text-xl font-bold text-zinc-100">Vídeo Salvo com Sucesso!</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
};

export default VideoRecorder;
