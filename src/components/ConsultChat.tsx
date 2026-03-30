import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Bot, User, Mic, MicOff, X, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI, LiveServerMessage, Type, Modality } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { getAI } from '../utils/ai';
import { getItems } from '../db';
import { playTTS, initAudio, getAudioContext } from '../utils/tts';
import { useAuth } from '../AuthContext';
import { CREDIT_COSTS } from '../constants/costs';

interface ConsultChatProps {
  inputMode: 'text' | 'voice';
  folderId: string;
  onCancel: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  images?: string[];
}

export function ConsultChat({ inputMode, folderId, onCancel }: ConsultChatProps) {
  const { spendCredits } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbContextText, setDbContextText] = useState('');
  const [dbContextVoice, setDbContextVoice] = useState('');
  const [dbItems, setDbItems] = useState<any[]>([]);
  const [displayedImage, setDisplayedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dbItemsRef = useRef<any[]>([]);

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

  useEffect(() => {
    const loadContext = async () => {
      try {
        const appName = localStorage.getItem('appName') || 'ExoMind';
        const userName = localStorage.getItem('userName') || 'Usuário';
        const customInstructions = localStorage.getItem('customAiInstructions') || '';

        const items = await getItems(folderId);
        setDbItems(items);
        dbItemsRef.current = items;
        const contextString = items.map(item => {
          const date = new Date(item.timestamp).toLocaleString('pt-BR');
          let content = item.content;
          if (item.type === 'location' && typeof item.content === 'string') {
            try {
              const loc = JSON.parse(item.content);
              content = `Latitude: ${loc.lat}, Longitude: ${loc.lng}`;
            } catch (e) {}
          } else if (item.type === 'photo') {
            content = `[Imagem salva com ID: ${item.id}]`;
          }
          return `ID: ${item.id} | Data: [${date}] | Tipo: ${item.type} | Título/Descrição: ${item.metadata?.description || 'Sem descrição'} | Conteúdo: ${content}`;
        }).join('\n\n');
        
        const baseInstruction = `Seu nome é ${appName}. O nome do usuário com quem você está falando é ${userName}. Aqui estão as memórias e anotações salvas pelo usuário:\n\n${contextString}\n\nResponda às perguntas do usuário com base nessas informações.\n\nIMPORTANTE: Sempre que fornecer links (músicas, sites, etc), use o formato Markdown [Título](URL) para que o link seja clicável.\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${customInstructions}`;
        
        setDbContextText(`${baseInstruction} Se o usuário pedir para ver uma foto ou imagem, você DEVE incluir a tag <IMG:id_da_imagem> na sua resposta. Por exemplo: "Aqui está a foto: <IMG:123456789>".`);
        
        setDbContextVoice(`${baseInstruction} Se o usuário pedir para ver uma foto, você DEVE usar a ferramenta 'showImage' passando o ID da imagem correspondente. Fale naturalmente sobre a foto enquanto ela é exibida na tela.`);
      } catch (error) {
        console.error('Error loading DB context:', error);
      }
    };
    loadContext();
  }, [folderId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const processModelResponse = (text: string) => {
    const regex = /<IMG:\s*(\d+)\s*>/g;
    let match;
    const images: string[] = [];
    let cleanText = text;

    while ((match = regex.exec(text)) !== null) {
      const imageId = match[1];
      const item = dbItems.find(i => i.id === imageId && i.type === 'photo');
      if (item) {
        images.push(item.content);
      }
    }
    cleanText = text.replace(/<IMG:\s*(\d+)\s*>/g, '').trim();

    return { text: cleanText, images: images.length > 0 ? images : undefined };
  };

  const handleSendText = async () => {
    if (!input.trim() || isLoading) return;

    initAudio(); // Initialize audio context on user interaction

    const userMsg = input.trim();
    
    // Spend credits for AI Consult
    const success = await spendCredits(CREDIT_COSTS.AI_CONSULT, 'Consulta de Memória (Texto)');
    if (!success) return;

    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }]);
    setIsLoading(true);
    
    let selectedVoice = localStorage.getItem('exo_voice_preference') || 'Zephyr';
    const voiceRate = parseFloat(localStorage.getItem('exo_voice_rate') || '1.0');
    const webSearchEnabled = localStorage.getItem('exo_web_search') === 'true';
    
    // Fallback for deprecated voices
    if (selectedVoice === 'uHxni9EgaoUr7MGw3Der' || selectedVoice === 'personal_voice') {
      selectedVoice = 'Zephyr';
    }
    
    // Feedback de áudio suave (processando) - removido a pedido do usuário
    // playTTS("Processando sua pergunta...", selectedVoice === 'uHxni9EgaoUr7MGw3Der' ? 'Zephyr' : selectedVoice, voiceRate);

    try {
      const ai = getAI();
      const tools: any[] = [];
      if (webSearchEnabled) {
        tools.push({ googleSearch: {} });
      }

      // Construir o histórico para o modelo (limitar às últimas 10 mensagens para contexto)
      const history = messages.slice(-10).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      // Adicionar a mensagem atual do usuário
      const contents = [
        ...history,
        { role: 'user' as const, parts: [{ text: userMsg }] }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
          systemInstruction: dbContextText || 'Você é o ExoMind.',
          tools: tools.length > 0 ? tools : undefined,
        }
      });

      const responseText = response.text || 'Desculpe, não consegui gerar uma resposta.';
      const processed = processModelResponse(responseText);

      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: processed.text,
        images: processed.images
      }]);
      
      // Ler a resposta em voz alta - Apenas se o modo de entrada for voz
      if (inputMode === 'voice') {
        await playTTS(processed.text, selectedVoice, voiceRate);
      }
    } catch (error: any) {
      console.error('Error generating response:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: error?.message || 'Ocorreu um erro ao processar sua solicitação.' 
      }]);
      playTTS('Ocorreu um erro ao processar sua solicitação.', (selectedVoice === 'uHxni9EgaoUr7MGw3Der' || selectedVoice === 'personal_voice') ? 'Zephyr' : selectedVoice, voiceRate);
    } finally {
      setIsLoading(false);
    }
  };

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
        setAudioLevel(average / 128); // Normalize to 0-1 approx
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Erro ao acessar o microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    setIsLoading(true);
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

      // Spend credits for AI Consult (Voice)
      const success = await spendCredits(CREDIT_COSTS.AI_CONSULT, 'Consulta de Memória (Voz)');
      if (!success) {
        setIsLoading(false);
        setIsProcessing(false);
        return;
      }

      const ai = getAI();
      const webSearchEnabled = localStorage.getItem('exo_web_search') === 'true';
      const tools: any[] = [];
      if (webSearchEnabled) {
        tools.push({ googleSearch: {} });
      }

      // Add user message placeholder
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: '(Mensagem de voz)' }]);

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
              { text: "Responda à mensagem de voz acima com base no contexto das memórias fornecidas." }
            ]
          }
        ],
        config: {
          systemInstruction: dbContextText || 'Você é o ExoMind.',
          tools: tools.length > 0 ? tools : undefined,
        }
      });

      const responseText = response.text || 'Desculpe, não consegui entender o áudio.';
      const processed = processModelResponse(responseText);

      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: processed.text,
        images: processed.images
      }]);

      // TTS response
      let selectedVoice = localStorage.getItem('exo_voice_preference') || 'Zephyr';
      const voiceRate = parseFloat(localStorage.getItem('exo_voice_rate') || '1.0');
      
      // Fallback for deprecated voices
      if (selectedVoice === 'uHxni9EgaoUr7MGw3Der' || selectedVoice === 'personal_voice') {
        selectedVoice = 'Zephyr';
      }
      
      await playTTS(processed.text, selectedVoice, voiceRate);

    } catch (error) {
      console.error('Error processing voice input:', error);
      playTTS('Desculpe, tive um problema ao processar seu áudio.', 'Zephyr', 1.0);
    } finally {
      setIsLoading(false);
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col bg-slate-900 absolute inset-0 z-20"
    >
      <header className="p-4 border-b border-slate-800 flex items-center justify-between glass-panel sticky top-0 z-10">
        <h2 className="text-xl font-semibold text-white">Consultar Memória</h2>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
          <X size={20} />
        </button>
      </header>

      {inputMode === 'text' ? (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                <Bot size={48} className="text-slate-700" />
                <p className="text-center max-w-xs">
                  Pergunte-me sobre qualquer coisa que você salvou no ExoMind.
                </p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600'
                }`}>
                  {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
                }`}>
                  <div className="markdown-body text-sm leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.images && msg.images.map((img, idx) => (
                    <div key={idx} className="mt-3 rounded-lg overflow-hidden border border-slate-700 bg-black">
                      <img src={img} alt="Imagem recuperada" className="w-full h-auto max-h-64 object-contain" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                  <Loader2 className="animate-spin text-emerald-400" size={16} />
                  <span className="text-sm text-slate-400">Pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
            <div className="max-w-4xl mx-auto relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="Pergunte sobre suas memórias..."
                className="w-full bg-slate-800 border border-slate-700 rounded-full py-3 pl-4 pr-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={handleSendText}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-bold text-white">
              {isProcessing ? 'Processando...' : isRecording ? 'Gravando...' : 'Modo Voz'}
            </h3>
            <p className="text-slate-400 text-sm text-center">
              {isRecording ? 'Fale agora e clique em Enviar quando terminar.' : 'Clique no botão abaixo para começar a falar.'}
            </p>
          </div>

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
              disabled={isProcessing || isLoading}
              className={`relative z-10 px-8 py-4 rounded-full flex items-center justify-center gap-3 transition-all shadow-2xl font-bold text-lg min-w-[200px] ${
                isRecording 
                  ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } ${(isProcessing || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing || isLoading ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : isRecording ? (
                <>
                  <Send size={24} className="text-white" />
                  <span>Enviar</span>
                </>
              ) : (
                <>
                  <Mic size={24} className="text-white" />
                  <span>Pressione para Falar</span>
                </>
              )}
            </button>
          </div>

          {isRecording && (
            <div className="w-full max-w-xs bg-slate-800/50 rounded-full h-1.5 overflow-hidden border border-slate-700">
              <motion.div 
                className="h-full bg-emerald-500"
                animate={{ width: `${Math.min(100, audioLevel * 100)}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
