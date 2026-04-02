import React, { useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { saveCapture } from '../db';
import { analyzeImage } from '../utils/ai';
import { 
  Camera, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  X, 
  Sparkles,
  RefreshCw,
  Scan
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DocumentCapture: React.FC = () => {
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'captured' | 'analyzing' | 'success'>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      alert("Não foi possível acessar a câmera.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setImage(dataUrl);
        setStatus('captured');
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setStatus('captured');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image || !user) return;
    
    setIsProcessing(true);
    setStatus('analyzing');
    
    try {
      const base64Data = image.split(',')[1];
      const result = await analyzeImage(base64Data, "Analise este documento e extraia as informações mais importantes em formato de tópicos.");
      if (!result) throw new Error("Falha na análise da IA");
      
      setAnalysis(result);
      
      await saveCapture(user.uid, 'document', {
        image: image,
        analysis: result
      }, {
        title: `Documento - ${new Date().toLocaleDateString()}`,
        description: result.substring(0, 100) + "...",
        tags: ['documento', 'ia', 'holístico']
      });
      
      setStatus('success');
    } catch (err) {
      console.error("Erro na análise:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setAnalysis(null);
    setStatus('idle');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-zinc-100">Captura de Documentos</h3>
        <p className="text-zinc-400">Digitalize documentos e deixe a IA extrair os dados importantes para você.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <AnimatePresence mode="wait">
          {status === 'idle' && !showCamera && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-12 flex flex-col items-center justify-center space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-lg">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center justify-center gap-4 p-8 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-3xl transition-all group"
                >
                  <div className="p-4 bg-indigo-500/10 rounded-2xl group-hover:bg-indigo-500/20 transition-colors">
                    <Camera className="w-8 h-8 text-indigo-400" />
                  </div>
                  <span className="font-bold text-zinc-100">Usar Câmera</span>
                </button>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-4 p-8 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-3xl transition-all group"
                >
                  <div className="p-4 bg-emerald-500/10 rounded-2xl group-hover:bg-emerald-500/20 transition-colors">
                    <Upload className="w-8 h-8 text-emerald-400" />
                  </div>
                  <span className="font-bold text-zinc-100">Enviar Arquivo</span>
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload}
              />
            </motion.div>
          )}

          {showCamera && (
            <motion.div 
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative aspect-video bg-black"
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                <div className="w-full h-full border-2 border-dashed border-white/50 rounded-lg" />
              </div>
              <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
                <button
                  onClick={stopCamera}
                  className="p-4 bg-zinc-900/80 text-white rounded-full hover:bg-zinc-800"
                >
                  <X className="w-6 h-6" />
                </button>
                <button
                  onClick={capturePhoto}
                  className="p-6 bg-white text-zinc-950 rounded-full hover:bg-zinc-100 shadow-xl active:scale-95"
                >
                  <Camera className="w-8 h-8" />
                </button>
              </div>
            </motion.div>
          )}

          {status === 'captured' && image && (
            <motion.div 
              key="captured"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 space-y-6"
            >
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black">
                <img src={image} alt="Captura" className="max-h-[500px] mx-auto" />
                <button
                  onClick={reset}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={reset}
                  className="px-8 py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl hover:bg-zinc-700"
                >
                  Tirar Outra
                </button>
                <button
                  onClick={handleAnalyze}
                  className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                >
                  <Scan className="w-5 h-5" />
                  Analisar com IA
                </button>
              </div>
            </motion.div>
          )}

          {status === 'analyzing' && (
            <motion.div 
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-20 flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                <Sparkles className="w-6 h-6 text-indigo-400 absolute top-0 right-0 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-zinc-100">Processando Documento...</p>
                <p className="text-zinc-500">Nossa IA está extraindo informações e organizando os dados.</p>
              </div>
            </motion.div>
          )}

          {status === 'success' && analysis && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h4 className="text-xl font-bold text-zinc-100">Análise Concluída</h4>
                </div>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
                >
                  <RefreshCw className="w-4 h-4" />
                  Nova Captura
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black/50">
                  <img src={image!} alt="Original" className="w-full h-full object-contain max-h-[400px]" />
                </div>
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 space-y-4 overflow-y-auto max-h-[400px]">
                  <div className="flex items-center gap-2 text-indigo-400 mb-2">
                    <FileText className="w-5 h-5" />
                    <span className="font-bold text-xs uppercase tracking-widest">Resumo da IA</span>
                  </div>
                  <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {analysis}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default DocumentCapture;
