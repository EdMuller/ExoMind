import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Save, Loader2, GripVertical, Trash2, Plus, Music, Film, Video } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { saveItem } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../AuthContext';
import { CREDIT_COSTS } from '../constants/costs';

interface VideoCreatorProps {
  initialItems: any[];
  onClose: () => void;
  onSaved: () => void;
}

export function VideoCreator({ initialItems, onClose, onSaved }: VideoCreatorProps) {
  const { spendCredits } = useAuth();
  const [items, setItems] = useState(initialItems);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('Minha Montagem');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const generateVideo = async () => {
    if (items.length === 0) return;

    // Spend credits for Video Montage
    const success = await spendCredits(CREDIT_COSTS.AI_VIDEO_MONTAGE, 'Criação de Montagem de Vídeo');
    if (!success) return;

    setIsGenerating(true);
    setProgress(0);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (16:9 aspect ratio)
    canvas.width = 1280;
    canvas.height = 720;

    const stream = canvas.captureStream(30); // 30 FPS
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);

    recorder.start();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setProgress(Math.round(((i) / items.length) * 100));

      if (item.type === 'photo') {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = item.mediaUrl || (item.content as string);
        
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });

        // Draw photo for 3 seconds
        const frames = 30 * 3;
        for (let f = 0; f < frames; f++) {
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Maintain aspect ratio
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const x = (canvas.width / 2) - (img.width / 2) * scale;
          const y = (canvas.height / 2) - (img.height / 2) * scale;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          
          await new Promise(r => requestAnimationFrame(r));
        }
      } else if (item.type === 'video') {
        const video = document.createElement('video');
        video.crossOrigin = "anonymous";
        video.src = item.mediaUrl || (item.content instanceof Blob ? URL.createObjectURL(item.content) : item.content);
        video.muted = true;
        video.playsInline = true;

        await new Promise((resolve) => {
          video.onloadeddata = resolve;
          video.onerror = resolve;
        });

        video.play();

        await new Promise((resolve) => {
          const drawFrame = () => {
            if (video.paused || video.ended) {
              resolve(null);
              return;
            }
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
            const x = (canvas.width / 2) - (video.videoWidth / 2) * scale;
            const y = (canvas.height / 2) - (video.videoHeight / 2) * scale;
            ctx.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale);
            
            requestAnimationFrame(drawFrame);
          };
          drawFrame();
        });
      }
    }

    setProgress(100);
    recorder.stop();

    await new Promise((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        
        const newItem = {
          id: uuidv4(),
          type: 'video' as const,
          content: blob,
          timestamp: Date.now(),
          folderId: 'balaio',
          title: title,
          summary: `Montagem criada com ${items.length} itens.`,
          metadata: {
            title: title,
            summary: `Montagem criada com ${items.length} itens.`,
            duration: 0, // Could calculate
            itemCount: items.length
          }
        };

        await saveItem(newItem);
        setIsGenerating(false);
        onSaved();
        resolve(null);
      };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
    >
      <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} />
          </button>
          <h2 className="text-xl font-bold">Criar Montagem</h2>
        </div>
        <button
          onClick={generateVideo}
          disabled={isGenerating || items.length === 0}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
        >
          {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Film size={20} />}
          {isGenerating ? `${progress}%` : 'Gerar Vídeo'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Título da Montagem</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-blue-500"
            placeholder="Ex: Minhas Férias"
          />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-slate-400 font-medium">Sequência de Itens ({items.length})</h3>
          <p className="text-xs text-slate-500 italic">Arraste para reordenar</p>
        </div>

        <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3">
          {items.map((item) => (
            <Reorder.Item
              key={item.id}
              value={item}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-4 group hover:border-slate-700 transition-colors"
            >
              <div className="cursor-grab active:cursor-grabbing p-1 text-slate-600 group-hover:text-slate-400">
                <GripVertical size={20} />
              </div>
              
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 border border-slate-700">
                {item.type === 'photo' ? (
                  <img src={item.mediaUrl || item.content} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-blue-400">
                    <Video size={24} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{item.metadata?.title || 'Sem título'}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  {item.type === 'photo' ? 'Foto' : 'Vídeo'}
                </div>
              </div>

              <button
                onClick={() => handleRemoveItem(item.id)}
                className="p-2 text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {items.length === 0 && (
          <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
            <Film size={48} className="mx-auto text-slate-700 mb-4" />
            <p className="text-slate-500">Nenhum item selecionado.</p>
          </div>
        )}
      </main>

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}
