import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Bot, User, Mic, MicOff, X, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { getItems } from '../db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ConsultChatProps {
  inputMode: 'text' | 'voice';
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  images?: string[];
}

export function ConsultChat({ inputMode, onClose }: ConsultChatProps) {
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
  const [isConnecting, setIsConnecting] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const appName = localStorage.getItem('appName') || 'ExoMind';
        const userName = localStorage.getItem('userName') || 'Usuário';

        const items = await getItems();
        setDbItems(items);
        dbItemsRef.current = items;
        const contextString = items.map(item => {
          const date = new Date(item.timestamp).toLocaleString('pt-BR');
          let content = item.content;
          if (item.type === 'location') {
            try {
              const loc = JSON.parse(item.content);
              content = `Latitude: ${loc.lat}, Longitude: ${loc.lng}`;
            } catch (e) {}
          } else if (item.type === 'photo') {
            content = `[Imagem salva com ID: ${item.id}]`;
          }
          return `ID: ${item.id} | Data: [${date}] | Tipo: ${item.type} | Título/Descrição: ${item.metadata?.description || 'Sem descrição'} | Conteúdo: ${content}`;
        }).join('\n\n');
        
        const baseInstruction = `Seu nome é ${appName}. O nome do usuário com quem você está falando é ${userName}. Aqui estão as memórias e anotações salvas pelo usuário:\n\n${contextString}\n\nResponda às perguntas do usuário com base nessas informações.`;
        
        setDbContextText(`${baseInstruction} Se o usuário pedir para ver uma foto ou imagem, você DEVE incluir a tag <IMG:id_da_imagem> na sua resposta. Por exemplo: "Aqui está a foto: <IMG:123456789>".`);
        
        setDbContextVoice(`${baseInstruction} Se o usuário pedir para ver uma foto, você DEVE usar a ferramenta 'showImage' passando o ID da imagem correspondente. Fale naturalmente sobre a foto enquanto ela é exibida na tela.`);
      } catch (error) {
        console.error('Error loading DB context:', error);
      }
    };
    loadContext();
  }, []);

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

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: dbContextText,
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
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: 'Ocorreu um erro ao processar sua solicitação.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceSession = async () => {
    setIsConnecting(true);
    setDisplayedImage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: dbContextVoice,
          tools: [{
            functionDeclarations: [
              {
                name: 'showImage',
                description: 'Mostra uma imagem salva para o usuário na tela.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    imageId: {
                      type: Type.STRING,
                      description: 'O ID da imagem a ser mostrada.',
                    },
                  },
                  required: ['imageId'],
                },
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            setIsRecording(true);
            setIsConnecting(false);

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }

              const buffer = new ArrayBuffer(pcmData.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcmData.length; i++) {
                view.setInt16(i * 2, pcmData[i], true);
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));

              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
                });
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              if (!playbackContextRef.current) {
                playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              }
              const audioCtx = playbackContextRef.current;
              
              try {
                // Try decoding as a standard container first
                const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                source.start();
              } catch (e) {
                // Fallback: Assume raw 16-bit Linear PCM (24kHz)
                const pcmData = new Int16Array(bytes.buffer);
                const audioBuffer = audioCtx.createBuffer(1, pcmData.length, 24000);
                const channelData = audioBuffer.getChannelData(0);
                for (let i = 0; i < pcmData.length; i++) {
                  channelData[i] = pcmData[i] / 32768.0;
                }
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                source.start();
              }
            }

            if (message.toolCall && message.toolCall.functionCalls) {
              for (const call of message.toolCall.functionCalls) {
                if (call.name === 'showImage') {
                  const imageId = call.args.imageId as string;
                  const item = dbItemsRef.current.find(i => i.id === imageId && i.type === 'photo');
                  
                  if (item) {
                    setDisplayedImage(item.content);
                  }
                  
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { result: item ? 'Imagem exibida com sucesso na tela do usuário.' : 'Imagem não encontrada.' }
                      }]
                    });
                  });
                }
              }
            }
          },
          onclose: () => {
            stopVoiceSession();
          },
          onerror: (err) => {
            console.error('Live API Error:', err);
            stopVoiceSession();
          }
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error('Error starting voice session:', error);
      setIsConnecting(false);
    }
  };

  const stopVoiceSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
    }
    setIsRecording(false);
    setIsConnecting(false);
  };

  useEffect(() => {
    return () => {
      stopVoiceSession();
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
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
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
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
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
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {displayedImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 rounded-2xl overflow-hidden border-2 border-slate-700 bg-black max-w-sm shadow-2xl z-20"
            >
              <img src={displayedImage} alt="Imagem solicitada" className="w-full h-auto max-h-64 object-contain" />
            </motion.div>
          )}
          <div className="relative mb-12">
            {isRecording && (
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" style={{ transform: 'scale(1.5)' }} />
            )}
            <button
              onClick={isRecording ? stopVoiceSession : startVoiceSession}
              disabled={isConnecting}
              className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-emerald-500 hover:bg-emerald-600'
              } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isConnecting ? (
                <Loader2 size={48} className="text-white animate-spin" />
              ) : isRecording ? (
                <MicOff size={48} className="text-white" />
              ) : (
                <Mic size={48} className="text-white" />
              )}
            </button>
          </div>
          <h3 className="text-2xl font-medium text-white mb-2">
            {isConnecting ? 'Conectando...' : isRecording ? 'Ouvindo...' : 'Toque para iniciar'}
          </h3>
          <p className="text-slate-400 text-center max-w-xs">
            {isRecording 
              ? 'Faça perguntas sobre suas memórias salvas.' 
              : 'Inicie a conversa por voz para consultar o ExoMind.'}
          </p>
        </div>
      )}
    </motion.div>
  );
}
