import React, { useEffect, useState, useRef } from 'react';
import { MessageSquare, Camera, MapPin, Calendar, Search, Loader2, Mic } from 'lucide-react';
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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (inputMode === 'voice') {
      speakOptions();
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [inputMode]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      console.log("User said:", transcript);
      
      if (transcript.includes('comentar') || transcript.includes('comentário')) {
        onSelectAction('comentar');
      } else if (transcript.includes('fotografar') || transcript.includes('foto')) {
        onSelectAction('fotografar');
      } else if (transcript.includes('local') || transcript.includes('salvar local') || transcript.includes('mapa')) {
        onSelectAction('salvar_local');
      } else if (transcript.includes('agendar') || transcript.includes('agenda') || transcript.includes('calendário')) {
        onSelectAction('agendar');
      } else if (transcript.includes('consultar') || transcript.includes('consulta') || transcript.includes('pesquisar')) {
        onSelectAction('consultar');
      } else {
        console.log("Command not recognized");
        // Optionally restart listening if command not recognized
        setTimeout(() => {
          try { recognition.start(); } catch (e) {}
        }, 500);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
    }
  };

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
      // Automatically start listening after speaking
      startListening();
    } catch (error) {
      console.error('Error speaking options:', error);
      setIsSpeaking(false);
      startListening(); // Try to listen even if speaking failed
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
          ) : isListening ? (
            <span className="flex items-center justify-center gap-2 text-emerald-400">
              <Mic className="animate-pulse" size={16} /> Ouvindo sua escolha...
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
              if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) {}
              }
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
