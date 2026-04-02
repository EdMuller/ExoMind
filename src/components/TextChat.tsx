import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Send, Loader2, Image as ImageIcon, X, Sparkles, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAI } from '../utils/ai';
import { useAuth } from '../AuthContext';
import { analyzePhoto } from '../utils/aiMetadata';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export function TextChat() {
  const { plan } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    try {
      const ai = getAI();
      chatRef.current = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: 'Você é o ExoMind, um assistente pessoal útil, conciso e amigável.',
        },
      });
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      setMessages([{ id: 'error', role: 'model', text: error instanceof Error ? error.message : 'Erro ao inicializar a IA.' }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;
    if (!chatRef.current) {
      setMessages(prev => [...prev, { id: uuidv4(), role: 'model', text: 'O chat ainda não foi inicializado. Tente novamente em alguns segundos.' }]);
      return;
    }

    const userMsg = input.trim();
    const imageToUpload = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    
    const messageId = uuidv4();
    setMessages(prev => [...prev, { 
      id: messageId, 
      role: 'user', 
      text: userMsg || (imageToUpload ? '[Imagem enviada]' : '') 
    }]);
    setIsLoading(true);

    try {
      let response;
      if (imageToUpload && plan === 'Diamante') {
        const base64Data = imageToUpload.split(',')[1];
        response = await chatRef.current.sendMessage({
          message: {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              { text: userMsg || "O que você vê nesta imagem?" }
            ]
          }
        });
      } else {
        response = await chatRef.current.sendMessage({ message: userMsg });
      }
      
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: response.text }]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: error?.message || 'Desculpe, ocorreu um erro ao processar sua mensagem.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col h-full absolute inset-0 bg-slate-900"
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-500">
            <p>Comece a digitar para conversar comigo.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl p-3 rounded-tl-sm border border-slate-700">
              <Loader2 className="animate-spin text-slate-400" size={20} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 relative inline-block"
            >
              <img src={selectedImage} alt="Preview" className="h-20 w-20 object-cover rounded-xl border border-slate-700" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
              >
                <X size={14} />
              </button>
              {plan !== 'Diamante' && (
                <div className="absolute inset-0 bg-slate-900/80 rounded-xl flex flex-col items-center justify-center p-1 text-center">
                  <Lock size={12} className="text-amber-500 mb-1" />
                  <span className="text-[8px] text-amber-500 font-bold leading-tight">Diamante Only</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <input 
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 rounded-full transition-colors ${selectedImage ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400 hover:text-white bg-slate-800'}`}
          >
            <ImageIcon size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={selectedImage ? "Pergunte sobre a foto..." : "Digite sua mensagem..."}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white placeholder-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-full text-white transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
