import React, { useState, useRef } from 'react';
import { Camera, Save, X, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { saveItem } from '../db';
import { generateItemMetadata, analyzeForSchedule, analyzePhoto } from '../utils/aiMetadata';
import { generateICS } from '../utils/calendar';
import { getAI } from '../utils/ai';
import { Mic, Sparkles, Lock } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { CREDIT_COSTS } from '../constants/costs';

interface Props {
  inputMode: 'text' | 'voice';
  folderId: string;
  onSaved: () => void;
  onCancel?: () => void;
}

export function DocumentCapture({ inputMode, folderId, onSaved, onCancel }: Props) {
  const { plan, spendCredits } = useAuth();
  const [photo, setPhoto] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [scheduleSuggestion, setScheduleSuggestion] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
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
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      
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
        setDescription(prev => prev + (prev ? ' ' : '') + transcription.trim());
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setPhoto(compressedBase64);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!photo) return;

    // Spend credits for AI Image Analysis
    const success = await spendCredits(CREDIT_COSTS.AI_IMAGE_ANALYSIS, 'Análise de Imagem por IA');
    if (!success) return;

    setIsAnalyzingPhoto(true);
    try {
      const description = await analyzePhoto(photo);
      if (description) {
        setDescription(description);
      }
    } catch (error) {
      console.error('Error analyzing photo:', error);
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!photo) return;
    setIsAnalyzing(true);
    try {
      const scheduleData = await analyzeForSchedule(description);
      if (scheduleData && scheduleData.isSchedule) {
        setScheduleSuggestion(scheduleData);
        setIsAnalyzing(false);
        return; // Wait for user confirmation
      }
      
      // If not a schedule, proceed with normal save
      await proceedSaving('photo');
    } catch (error) {
      console.error('Error analyzing photo description:', error);
      await proceedSaving('photo'); // Fallback to normal save
    }
  };

  const proceedSaving = async (type: 'photo' | 'schedule', scheduleData?: any) => {
    // Spend credits for saving photo/document
    const success = await spendCredits(CREDIT_COSTS.FILE_UPLOAD, `Salvar ${type === 'schedule' ? 'Agendamento' : 'Documento'}`);
    if (!success) return;

    setIsSaving(true);
    setScheduleSuggestion(null);
    try {
      const photoId = Date.now().toString();
      let scheduleId = null;

      if (type === 'schedule' && scheduleData) {
        scheduleId = (Date.now() + 1).toString();
        
        // Save the schedule
        await saveItem({
          id: scheduleId,
          type: 'schedule',
          content: description || 'Foto com agendamento',
          timestamp: Date.now() + 1,
          folderId,
          metadata: {
            type: 'schedule',
            title: scheduleData.title || 'Compromisso sem título',
            date: scheduleData.date || '',
            time: scheduleData.time || '',
            location: scheduleData.location || '',
            summary: scheduleData.summary || '',
            linkedPhotoId: photoId
          }
        });

        // Automatically trigger calendar download
        generateICS(scheduleData);
      }

      const metadata = await generateItemMetadata(description || 'Foto sem descrição', 'photo');
      const finalTitle = title.trim() || metadata?.title || 'Documento sem título';
      const finalSummary = description.trim() || metadata?.summary || '';
      
      await saveItem({
        id: photoId,
        type: 'photo',
        content: photo,
        timestamp: Date.now(),
        folderId,
        title: finalTitle,
        summary: finalSummary,
        metadata: { 
          description: description.trim(),
          type: 'photo',
          title: finalTitle,
          summary: finalSummary,
          ...(scheduleId ? { linkedScheduleId: scheduleId } : {})
        }
      });
      
      setIsSuccess(true);
      setTimeout(() => {
        onSaved();
      }, 1500);
    } catch (error) {
      console.error('Error saving photo:', error);
      alert('Erro ao salvar a foto. Tente novamente.');
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col p-6 bg-slate-900 absolute inset-0 overflow-y-auto"
    >
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full relative">
        {onCancel && (
          <button onClick={onCancel} className="absolute top-0 right-0 text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        )}
        <h2 className="text-2xl font-bold text-white mb-6">Salvar Documento</h2>

        {!photo ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={fileInputRef}
              onChange={handleCapture}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="gallery-input"
              onChange={handleGallery}
            />
            
            <div className="grid grid-cols-1 gap-4 w-full">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 rounded-3xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-purple-500 hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-4 group"
              >
                <Camera size={48} className="text-slate-400 group-hover:text-purple-400 transition-colors" />
                <span className="text-slate-300 font-medium text-lg">Tirar Foto</span>
              </button>

              <button
                onClick={() => document.getElementById('gallery-input')?.click()}
                className="w-full py-8 rounded-3xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-blue-500 hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-4 group"
              >
                <ImageIcon size={48} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                <span className="text-slate-300 font-medium text-lg">Galeria</span>
              </button>
            </div>

            <p className="text-slate-500 text-center text-sm px-8 mt-4">
              Capture ou selecione um documento para salvá-lo com segurança.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-6">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center border border-slate-700">
              <img src={photo} alt="Documento capturado" className="max-w-full max-h-full object-contain" />
              <button
                onClick={() => setPhoto(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center gap-2">
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
                      disabled={isProcessing || isAnalyzingPhoto}
                      className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isRecording 
                          ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } ${isProcessing || isAnalyzingPhoto ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isProcessing ? (
                        <Loader2 size={24} className="text-white animate-spin" />
                      ) : (
                        <Mic size={24} className="text-white" />
                      )}
                    </button>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-[10px]">
                      {isRecording ? 'Gravando...' : 'Descrever Voz'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleAnalyzePhoto}
                    disabled={isAnalyzingPhoto || isProcessing || plan !== 'Diamante'}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      plan !== 'Diamante'
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                        : isAnalyzingPhoto 
                          ? 'bg-purple-600/50 cursor-not-allowed' 
                          : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {isAnalyzingPhoto ? (
                      <Loader2 size={24} className="text-white animate-spin" />
                    ) : plan !== 'Diamante' ? (
                      <Lock size={24} />
                    ) : (
                      <Sparkles size={24} className="text-white" />
                    )}
                  </button>
                  <div className="text-center">
                    <p className={`font-bold text-[10px] ${plan !== 'Diamante' ? 'text-slate-600' : 'text-white'}`}>
                      {isAnalyzingPhoto ? 'Analisando...' : 'Analisar Foto'}
                    </p>
                    {plan !== 'Diamante' && (
                      <p className="text-[8px] text-amber-500 font-bold uppercase tracking-tighter">Exclusivo Diamante</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-400">Título (Opcional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dê um nome para este documento..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-400">Descrição / Resumo</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A transcrição ou análise aparecerá aqui..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none h-24"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving || isAnalyzing || isSuccess}
              className={`w-full py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-auto disabled:opacity-50 disabled:cursor-not-allowed ${
                isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {(isSaving || isAnalyzing) ? <Loader2 className="animate-spin" size={20} /> : isSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
              {isSuccess ? 'Salvo com sucesso!' : isAnalyzing ? 'Analisando...' : isSaving ? 'Salvando...' : 'Salvar Documento'}
            </button>
          </div>
        )}

        {/* Schedule Suggestion Modal */}
        {scheduleSuggestion && (
          <div className="absolute inset-0 bg-slate-900/90 rounded-2xl flex flex-col items-center justify-center p-6 z-50 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl w-full max-w-sm text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-purple-500" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Agendamento Identificado!</h3>
              <p className="text-slate-300 text-sm mb-4">
                Parece que você anotou um compromisso na descrição da foto. Deseja salvar na sua agenda?
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
                  onClick={() => proceedSaving('photo')}
                  className="flex-1 py-2 px-4 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm font-medium"
                >
                  Não, apenas salvar foto
                </button>
                <button
                  onClick={() => proceedSaving('schedule', scheduleSuggestion)}
                  className="flex-1 py-2 px-4 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm font-medium"
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
