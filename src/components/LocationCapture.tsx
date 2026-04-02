import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MapPin, Save, Loader2, Navigation, X, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { saveItem } from '../db';
import { generateItemMetadata, analyzeForSchedule } from '../utils/aiMetadata';
import { generateICS } from '../utils/calendar';
import { useAuth } from '../AuthContext';
import { CREDIT_COSTS } from '../constants/costs';

interface Props {
  inputMode: 'text' | 'voice';
  folderId: string;
  onSaved: () => void;
  onCancel?: () => void;
}

export function LocationCapture({ inputMode, folderId, onSaved, onCancel }: Props) {
  const { spendCredits } = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [scheduleSuggestion, setScheduleSuggestion] = useState<any>(null);

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
    setIsAnalyzing(true);
    try {
      const scheduleData = await analyzeForSchedule(description);
      if (scheduleData && scheduleData.isSchedule) {
        setScheduleSuggestion(scheduleData);
        setIsAnalyzing(false);
        return; // Wait for user confirmation
      }
      
      // If not a schedule, proceed with normal save
      await proceedSaving('location');
    } catch (error) {
      console.error('Error analyzing location description:', error);
      await proceedSaving('location'); // Fallback to normal save
    }
  };

  const proceedSaving = async (type: 'location' | 'schedule', scheduleData?: any) => {
    // Spend credits for saving location/schedule
    const success = await spendCredits(CREDIT_COSTS.LOCATION_SAVE, `Salvar ${type === 'schedule' ? 'Agendamento' : 'Localização'}`);
    if (!success) return;

    setIsSaving(true);
    setScheduleSuggestion(null);
    try {
      const locationId = uuidv4();
      let scheduleId = null;

      if (type === 'schedule' && scheduleData) {
        scheduleId = uuidv4();
        
        // Save the schedule
        await saveItem({
          id: scheduleId,
          type: 'schedule',
          content: description || 'Localização com agendamento',
          timestamp: Date.now() + 1,
          folderId,
          metadata: {
            type: 'schedule',
            title: scheduleData.title || 'Compromisso sem título',
            date: scheduleData.date || '',
            time: scheduleData.time || '',
            location: scheduleData.location || '',
            summary: scheduleData.summary || '',
            linkedLocationId: locationId
          }
        });

        // Automatically trigger calendar download
        generateICS(scheduleData);
      }

      const metadata = await generateItemMetadata(description, 'location');
      
      await saveItem({
        id: locationId,
        type: 'location',
        content: JSON.stringify(location),
        timestamp: Date.now(),
        folderId,
        metadata: { 
          description: description.trim(),
          type: 'location',
          title: metadata?.title || 'Localização sem título',
          summary: metadata?.summary || '',
          ...(scheduleId ? { linkedScheduleId: scheduleId } : {})
        }
      });
      
      setIsSuccess(true);
      setTimeout(() => {
        onSaved();
      }, 1500);
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
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Onde estacionei o carro, Local da reunião com cliente..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none h-32"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!location || !description.trim() || isSaving || isAnalyzing || isSuccess}
            className={`w-full py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-auto disabled:opacity-50 disabled:cursor-not-allowed ${
              isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            {(isSaving || isAnalyzing) ? <Loader2 className="animate-spin" size={20} /> : isSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
            {isSuccess ? 'Salvo com sucesso!' : isAnalyzing ? 'Analisando...' : isSaving ? 'Salvando...' : 'Salvar Localização'}
          </button>
        </div>

        {/* Schedule Suggestion Modal */}
        {scheduleSuggestion && (
          <div className="absolute inset-0 bg-slate-900/90 rounded-2xl flex flex-col items-center justify-center p-6 z-50 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl w-full max-w-sm text-center">
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-orange-500" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Agendamento Identificado!</h3>
              <p className="text-slate-300 text-sm mb-4">
                Parece que você anotou um compromisso na descrição do local. Deseja salvar na sua agenda?
              </p>
              <div className="bg-slate-900 rounded-lg p-3 text-left mb-6 border border-slate-700">
                <p className="text-white font-medium">{scheduleSuggestion.title}</p>
                <p className="text-slate-400 text-sm mt-1">
                  {scheduleSuggestion.date} {scheduleSuggestion.time ? `às ${scheduleSuggestion.time}` : ''}
                </p>
                {scheduleSuggestion.location && (
                  <p className="text-slate-400 text-sm mt-1">📍 {scheduleSuggestion.location}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => proceedSaving('location')}
                  className="flex-1 py-2 px-4 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm font-medium"
                >
                  Não, apenas salvar local
                </button>
                <button
                  onClick={() => proceedSaving('schedule', scheduleSuggestion)}
                  className="flex-1 py-2 px-4 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors text-sm font-medium"
                >
                  Sim, agendar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
