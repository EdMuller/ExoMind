import React, { useEffect, useState } from 'react';
import { MessageSquare, Camera, MapPin, Calendar, Search, Loader2, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type InputMode = 'text' | 'voice';
type ActionType = 'comentar' | 'fotografar' | 'salvar_local' | 'agendar' | 'consultar' | 'video';

interface ActionSelectorProps {
  inputMode: InputMode;
  onSelectAction: (action: ActionType) => void;
}

export function ActionSelector({ inputMode, onSelectAction }: ActionSelectorProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (inputMode === 'voice') {
      speakOptions();
    }
  }, [inputMode]);

  const speakOptions = async () => {
    setIsSpeaking(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: 'O que você deseja fazer? Comentar, Fotografar, Salvar Local, Agendar ou Consultar?' }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const audioCtx = new AudioContext({ sampleRate: 24000 });
        const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();
        source.onended = () => setIsSpeaking(false);
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error('Error speaking options:', error);
      setIsSpeaking(false);
    }
  };

  const actions: { id: ActionType; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'comentar', label: 'Comentar', icon: <MessageSquare size={28} />, color: 'text-blue-400' },
    { id: 'fotografar', label: 'Fotografar', icon: <Camera size={28} />, color: 'text-purple-400' },
    { id: 'salvar_local', label: 'Local', icon: <MapPin size={28} />, color: 'text-orange-400' },
    { id: 'agendar', label: 'Agendar', icon: <Calendar size={28} />, color: 'text-emerald-400' },
    { id: 'video', label: 'Vídeo', icon: <Video size={28} />, color: 'text-red-400' },
    { id: 'consultar', label: 'Consultar', icon: <Search size={28} />, color: 'text-rose-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col items-center justify-center p-6 gap-6 w-full max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2 text-white">O que deseja fazer?</h2>
        <p className="text-slate-400">
          {isSpeaking ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Falando opções...
            </span>
          ) : (
            'Selecione uma ação para continuar.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        {actions.map((action, index) => (
          <button
            key={action.id}
            onClick={() => {
              if (action.id === 'video') {
                alert('Para salvar vídeos, configure um serviço de armazenamento em nuvem na tela de Configurações.');
              } else {
                onSelectAction(action.id as ActionType);
              }
            }}
            className={`flex flex-col items-center justify-center p-6 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all shadow-lg ${action.id === 'video' ? 'opacity-50 cursor-not-allowed' : ''} ${action.id === 'consultar' ? 'col-span-2' : ''}`}
          >
            <div className={`mb-3 ${action.color}`}>{action.icon}</div>
            <span className="font-medium text-slate-200">{action.label}</span>
            {action.id === 'video' && <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Requer Nuvem</span>}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
