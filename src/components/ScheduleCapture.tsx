import React, { useState } from 'react';
import { Calendar, Save, X, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { saveItem } from '../db';
import { generateItemMetadata } from '../utils/aiMetadata';

interface ScheduleCaptureProps {
  inputMode: 'text' | 'voice';
  onSaved: () => void;
  onCancel: () => void;
}

export function ScheduleCapture({ inputMode, onSaved, onCancel }: ScheduleCaptureProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !date || !time) return;
    setIsSaving(true);
    try {
      const fullText = `Título: ${title}. Data: ${date}. Hora: ${time}. Notas: ${description}`;
      const metadata = await generateItemMetadata(fullText, 'schedule');

      await saveItem({
        id: Date.now().toString(),
        type: 'text', // Saving as text for now, could be a specific 'schedule' type
        content: `Agendamento: ${title} em ${date} às ${time}\n${description}`,
        metadata: { 
          description: title, 
          date: metadata?.date || date, 
          time: metadata?.time || time, 
          type: 'schedule',
          title: metadata?.title || title,
          summary: metadata?.summary,
          location: metadata?.location
        },
        timestamp: Date.now(),
      });
      setIsSuccess(true);
      setTimeout(() => {
        onSaved();
      }, 1500);
    } catch (error) {
      console.error('Error saving schedule:', error);
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 absolute inset-0"
    >
      <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative">
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={24} />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <Calendar size={28} className="text-emerald-400" />
          <h2 className="text-2xl font-bold text-white">Novo Agendamento</h2>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Título do Evento</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              placeholder="Ex: Reunião com cliente"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Hora</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Local / Notas Adicionais</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none h-20"
              placeholder="Ex: No escritório central..."
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!title.trim() || !date || !time || isSaving || isSuccess}
          className={`w-full font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : isSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
          {isSuccess ? 'Salvo com sucesso!' : 'Salvar Agendamento'}
        </button>
      </div>
    </motion.div>
  );
}
