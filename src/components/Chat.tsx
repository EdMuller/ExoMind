import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { generateAIResponse } from '../utils/ai';
import { Send, Bot, User, Loader2, Sparkles, Trash2, Mic, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const Chat: React.FC = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateAIResponse(input);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response || "Desculpe, não consegui processar isso.",
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Erro no chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* Chat Header */}
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100">Assistente IA</h3>
            <p className="text-xs text-zinc-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Online e pronto para ajudar
            </p>
          </div>
        </div>
        <button 
          onClick={() => setMessages([])}
          className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
          title="Limpar conversa"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <div className="p-4 bg-zinc-800 rounded-full">
              <Sparkles className="w-12 h-12 text-indigo-400" />
            </div>
            <div className="max-w-xs">
              <p className="text-zinc-100 font-medium">Como posso ajudar hoje?</p>
              <p className="text-sm text-zinc-500">Tente perguntar sobre produtividade, organização ou peça um resumo das suas notas.</p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                  msg.sender === 'user' ? 'bg-indigo-600' : 'bg-zinc-800 border border-zinc-700'
                }`}>
                  {msg.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-indigo-400" />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700 shadow-sm'
                }`}>
                  <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                    {msg.text}
                  </ReactMarkdown>
                  <p className={`text-[10px] mt-2 opacity-50 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex justify-start"
          >
            <div className="flex gap-3 items-center bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm text-zinc-400">Pensando...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800">
        <div className="flex items-end gap-4 max-w-4xl mx-auto">
          <div className="flex-1 relative bg-zinc-800 border border-zinc-700 rounded-2xl focus-within:border-indigo-500/50 transition-all shadow-inner">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Digite sua mensagem..."
              className="w-full bg-transparent border-none outline-none p-4 pr-12 text-sm resize-none min-h-[56px] max-h-32"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors">
                <Mic className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors">
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-4 rounded-2xl transition-all shadow-lg ${
              !input.trim() || isLoading 
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20 active:scale-95'
            }`}
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
        <p className="text-[10px] text-center text-zinc-600 mt-4">
          O Assistente Holístico pode cometer erros. Considere verificar informações importantes.
        </p>
      </div>
    </div>
  );
};

export default Chat;
