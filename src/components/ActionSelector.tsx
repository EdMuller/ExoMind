import React, { useEffect, useState } from 'react';
import { MessageSquare, Camera, MapPin, Calendar, Search, Loader2, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { playTTS, initAudio } from '../utils/tts';
import { useAuth } from '../AuthContext';

type InputMode = 'text' | 'voice';
type ActionType = 'comentar' | 'fotografar' | 'salvar_local' | 'agendar' | 'consultar';

interface ActionSelectorProps {
  inputMode: InputMode;
  onSelectAction: (action: ActionType) => void;
}

export function ActionSelector({ inputMode, onSelectAction }: ActionSelectorProps) {
  const { cacaVoiceUses, incrementCacaVoiceUses } = useAuth();
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (inputMode === 'voice') {
      speakOptions();
    }
  }, [inputMode]);

  const speakOptions = async () => {
    setIsSpeaking(true);
    try {
      let selectedVoice = localStorage.getItem('exo_voice_preference') || 'Zephyr';
      if (selectedVoice === 'uHxni9EgaoUr7MGw3Der' && cacaVoiceUses >= 5) {
        selectedVoice = 'Zephyr'; // Fallback if limit reached
      }
      
      await playTTS('O que você deseja fazer? Comentar, Fotografar, Salvar Local, Agendar ou Consultar?', selectedVoice);
      if (selectedVoice === 'uHxni9EgaoUr7MGw3Der') {
        await incrementCacaVoiceUses();
      }
      setIsSpeaking(false);
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
              initAudio(); // Initialize audio context on user interaction
              onSelectAction(action.id as ActionType);
            }}
            className={`flex flex-col items-center justify-center p-6 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all shadow-lg ${action.id === 'consultar' ? 'col-span-2' : ''}`}
          >
            <div className={`mb-3 ${action.color}`}>{action.icon}</div>
            <span className="font-medium text-slate-200">{action.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
