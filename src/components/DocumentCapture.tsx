import React, { useState, useRef } from 'react';
import { Camera, Save, X, Image as ImageIcon } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
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
          title: metadata?.title,
          summary: metadata?.summary
        },
        timestamp: Date.now(),
      });
      onSaved();
    } catch (error) {
      console.error('Error saving photo:', error);
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Recibo do almoço de negócios, CNH, etc..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none h-32"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={!description.trim() || isSaving}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-auto"
            >
              <Save size={20} />
              {isSaving ? 'Salvando...' : 'Salvar Documento'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
