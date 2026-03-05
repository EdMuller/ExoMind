import React, { useState, useEffect } from 'react';
import { MapPin, Save, Loader2, Navigation, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { saveItem } from '../db';
import { generateItemMetadata } from '../utils/aiMetadata';

interface Props {
  onSaved: () => void;
  onCancel?: () => void;
}

export function LocationCapture({ onSaved, onCancel }: Props) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = () => {
    setIsLocating(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocalização não suportada pelo seu navegador.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (err) => {
        console.error('Error getting location:', err);
        setError('Não foi possível obter a localização. Verifique as permissões.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    getLocation();
  }, []);

  const handleSave = async () => {
    if (!location || !description.trim()) return;
    setIsSaving(true);
    try {
      const metadata = await generateItemMetadata(description, 'location');
      
      await saveItem({
        id: Date.now().toString(),
        type: 'location',
        content: JSON.stringify(location),
        metadata: { 
          description: description.trim(),
          title: metadata?.title,
          summary: metadata?.summary
        },
        timestamp: Date.now(),
      });
      onSaved();
    } catch (error) {
      console.error('Error saving location:', error);
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
        <h2 className="text-2xl font-bold text-white mb-6">Salvar Localização</h2>

        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
            {isLocating ? (
              <>
                <Loader2 size={48} className="text-orange-400 animate-spin" />
                <p className="text-slate-400 font-medium">Buscando sinal GPS...</p>
              </>
            ) : error ? (
              <>
                <Navigation size={48} className="text-red-400" />
                <p className="text-red-400 text-center font-medium">{error}</p>
                <button
                  onClick={getLocation}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors mt-2"
                >
                  Tentar Novamente
                </button>
              </>
            ) : location ? (
              <>
                <MapPin size={48} className="text-orange-400" />
                <div className="text-center">
                  <p className="text-emerald-400 font-medium text-lg mb-1">Localização Obtida</p>
                  <p className="text-slate-400 text-sm font-mono">
                    Lat: {location.lat.toFixed(6)}<br />
                    Lng: {location.lng.toFixed(6)}
                  </p>
                </div>
                <button
                  onClick={getLocation}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors mt-2 flex items-center gap-2"
                >
                  <Navigation size={16} />
                  Atualizar
                </button>
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300">Descrição do Local / Evento</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Onde estacionei o carro, Local da reunião com cliente..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none h-32"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!location || !description.trim() || isSaving}
            className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-auto"
          >
            <Save size={20} />
            {isSaving ? 'Salvando...' : 'Salvar Localização'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
