import React, { useState, useRef } from 'react';
import { Camera, Save, X, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { saveItem } from '../db';
import { generateItemMetadata } from '../utils/aiMetadata';

interface Props {
  onSaved: () => void;
  onCancel?: () => void;
}

export function DocumentCapture({ onSaved, onCancel }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSave = async () => {
    if (!photo || !description.trim()) return;
    setIsSaving(true);
    try {
      const metadata = await generateItemMetadata(description, 'photo');
      
      await saveItem({
        id: Date.now().toString(),
        type: 'photo',
        content: photo,
        metadata: { 
          description: description.trim(),
          title: metadata?.title || 'Documento sem título',
          summary: metadata?.summary || ''
        },
        timestamp: Date.now(),
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-48 h-48 rounded-3xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-purple-500 hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-4 group"
            >
              <Camera size={48} className="text-slate-400 group-hover:text-purple-400 transition-colors" />
              <span className="text-slate-300 font-medium">Tirar Foto</span>
            </button>
            <p className="text-slate-500 text-center text-sm px-8">
              Tire uma foto do documento para salvá-lo com segurança no seu dispositivo.
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

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-300">Descrição / Critérios</label>
              <textarea
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Recibo do almoço de negócios, CNH, etc..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none h-32"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={!description.trim() || isSaving || isSuccess}
              className={`w-full py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-auto disabled:opacity-50 disabled:cursor-not-allowed ${
                isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : isSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
              {isSuccess ? 'Salvo com sucesso!' : isSaving ? 'Salvando...' : 'Salvar Documento'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
