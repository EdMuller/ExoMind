import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, FileText, Loader2, Trash2, Calendar, Folder, ArrowLeft, ArrowDownAZ, ArrowUpAZ, CalendarDays, Share2, Maximize2, X, Link as LinkIcon, CalendarPlus, Mic, Video, Play, Pause, Download, Save, CheckSquare, Square, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getItems, deleteItem, updateItemMetadata } from '../db';
import { generateICS } from '../utils/calendar';
import { VideoCreator } from './VideoCreator';

type ItemCategory = 'note' | 'photo' | 'location' | 'schedule' | 'audio' | 'video' | null;
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc';

function MediaSource({ content, mediaUrl, type, controls = true, autoPlay = false, loop = false }: { content: any, mediaUrl?: string, type: 'audio' | 'video', controls?: boolean, autoPlay?: boolean, loop?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (mediaUrl) {
      setUrl(mediaUrl);
      return;
    }

    if (content instanceof Blob) {
      const objectUrl = URL.createObjectURL(content);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (typeof content === 'string' && content.startsWith('data:')) {
      setUrl(content);
    } else if (typeof content === 'string' && content !== '(media file)') {
      // Fallback for cases where content might be a URL string
      setUrl(content);
    }
  }, [content, mediaUrl]);

  if (!url) return <div className="animate-pulse bg-slate-700 h-8 w-full rounded-lg" />;

  if (type === 'audio') {
    return <audio src={url} controls={controls} autoPlay={autoPlay} className="h-8 flex-1" />;
  }

  return <video src={url} controls={controls} autoPlay={autoPlay} loop={loop} playsInline className="max-w-full max-h-full object-contain" />;
}

export function SavedItems() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [viewingItem, setViewingItem] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showVideoCreator, setShowVideoCreator] = useState(false);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await getItems();
      // Deduplicate items by ID to prevent React key errors
      const uniqueItems = Array.from(new Map(data.map(item => [item.id, item])).values());
      setItems(uniqueItems);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteItem(id);
      loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  };

  const getCategory = (item: any): NonNullable<ItemCategory> => {
    if (item.type === 'photo') return 'photo';
    if (item.type === 'location') return 'location';
    if (item.type === 'audio') return 'audio';
    if (item.type === 'video') return 'video';
    if (item.type === 'schedule' || (item.type === 'text' && item.metadata?.type === 'schedule')) return 'schedule';
    return 'note';
  };

  const getItemDisplayInfo = (item: any) => {
    let name = item.metadata?.title || 'Item sem nome';
    let brief = item.metadata?.summary || '';
    
    const cat = getCategory(item);
    
    // Fallbacks for older items without AI metadata
    if (!item.metadata?.title) {
      if (cat === 'note') {
        const words = item.content.split(' ');
        name = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
        brief = item.content.length > 45 ? item.content.substring(0, 45) + '...' : item.content;
      } else if (cat === 'photo') {
        name = item.metadata?.description || 'Foto Salva';
        brief = 'Imagem capturada';
      } else if (cat === 'audio') {
        name = 'Áudio Salvo';
        brief = 'Gravação de voz';
      } else if (cat === 'video') {
        name = 'Vídeo Salvo';
        brief = 'Gravação de vídeo';
      } else if (cat === 'location') {
        name = item.metadata?.description || 'Localização Salva';
        try {
          const loc = JSON.parse(item.content);
          brief = `Lat: ${loc.lat.toFixed(4)}, Lng: ${loc.lng.toFixed(4)}`;
        } catch {
          brief = 'Coordenadas GPS';
        }
      } else if (cat === 'schedule') {
        name = item.metadata?.title || 'Agendamento';
        brief = `${item.metadata?.date || ''} às ${item.metadata?.time || ''}`;
      }
    } else if (cat === 'schedule') {
      // Format schedule brief if it has location
      brief = `${item.metadata.date || ''} às ${item.metadata.time || ''}`;
      if (item.metadata.location) {
        brief += ` (${item.metadata.location})`;
      } else if (item.metadata.summary) {
        brief += ` - ${item.metadata.summary}`;
      }
    }
    
    return { name, brief };
  };

  const filteredItems = items.filter(item => getCategory(item) === selectedCategory);
  
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'date_desc') return b.timestamp - a.timestamp;
    if (sortBy === 'date_asc') return a.timestamp - b.timestamp;
    
    const nameA = getItemDisplayInfo(a).name.toLowerCase();
    const nameB = getItemDisplayInfo(b).name.toLowerCase();
    if (sortBy === 'name_asc') return nameA.localeCompare(nameB);
    if (sortBy === 'name_desc') return nameB.localeCompare(nameA);
    return 0;
  });

  const getCounts = () => {
    return {
      note: items.filter(i => getCategory(i) === 'note').length,
      photo: items.filter(i => getCategory(i) === 'photo').length,
      location: items.filter(i => getCategory(i) === 'location').length,
      schedule: items.filter(i => getCategory(i) === 'schedule').length,
      audio: items.filter(i => getCategory(i) === 'audio').length,
      video: items.filter(i => getCategory(i) === 'video').length,
    };
  };

  const handleShare = async (item: any) => {
    try {
      const info = getItemDisplayInfo(item);
      let shareData: ShareData = {
        title: `ExoMind: ${info.name}`,
        text: `${info.name}\n\n${info.brief}\n\nSalvo no meu ExoMind.`,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        alert('O compartilhamento não é suportado neste navegador ou dispositivo.');
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  };

  const handleOpenLinkedItem = (linkedId: string) => {
    const linkedItem = items.find(i => i.id === linkedId);
    if (linkedItem) {
      setViewingItem(linkedItem);
      setIsEditing(false);
    } else {
      alert('O item vinculado não foi encontrado ou foi excluído.');
    }
  };

  const handleStartEdit = () => {
    const info = getItemDisplayInfo(viewingItem);
    setEditTitle(info.name);
    setEditSummary(info.brief);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!viewingItem) return;
    setIsSavingEdit(true);
    try {
      await updateItemMetadata(viewingItem.id, editTitle, editSummary);
      // Update local state to reflect changes immediately
      setItems(prev => prev.map(item => 
        item.id === viewingItem.id 
          ? { ...item, title: editTitle, summary: editSummary, metadata: { ...item.metadata, title: editTitle, summary: editSummary, description: editSummary } }
          : item
      ));
      setViewingItem(prev => ({ ...prev, title: editTitle, summary: editSummary, metadata: { ...prev.metadata, title: editTitle, summary: editSummary, description: editSummary } }));
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Erro ao salvar as alterações.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSelectToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleStartMontage = () => {
    if (selectedIds.length === 0) {
      alert('Selecione pelo menos uma foto ou vídeo.');
      return;
    }
    setShowVideoCreator(true);
  };

  const handleMontageSaved = () => {
    setShowVideoCreator(false);
    setIsSelectionMode(false);
    setSelectedIds([]);
    loadItems();
  };

  const handleAddToCalendar = (item: any) => {
    generateICS(item.metadata || {});
  };

  const handleDownload = async (item: any) => {
    let url = '';
    const info = getItemDisplayInfo(item);
    let filename = `${info.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

    if (item.mediaUrl) {
      url = item.mediaUrl;
    } else if (item.content instanceof Blob) {
      url = URL.createObjectURL(item.content);
    } else if (typeof item.content === 'string' && item.content.startsWith('data:')) {
      url = item.content;
    } else {
      const blob = new Blob([item.content], { type: 'text/plain' });
      url = URL.createObjectURL(blob);
      filename += '.txt';
    }

    if (item.type === 'audio' && !filename.endsWith('.webm')) filename += '.webm';
    else if (item.type === 'video' && !filename.endsWith('.webm')) filename += '.webm';
    else if (item.type === 'photo' && !filename.endsWith('.jpg')) filename += '.jpg';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (url.startsWith('blob:')) {
      // Wait a bit before revoking to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const counts = getCounts();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col h-full absolute inset-0 bg-slate-900 overflow-y-auto p-4"
    >
      <div className="max-w-md mx-auto w-full pb-20">
        {!selectedCategory ? (
          <>
            <h2 className="text-2xl font-bold text-white mb-6 mt-4">Suas Pastas</h2>
            
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-slate-500" size={32} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setSelectedCategory('note')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center transition-all group">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileText size={32} className="text-blue-400" />
                  </div>
                  <span className="font-semibold text-white">Notas</span>
                  <span className="text-sm text-slate-400 mt-1">{counts.note} itens</span>
                </button>

                <button onClick={() => setSelectedCategory('photo')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center transition-all group">
                  <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Camera size={32} className="text-purple-400" />
                  </div>
                  <span className="font-semibold text-white">Fotos</span>
                  <span className="text-sm text-slate-400 mt-1">{counts.photo} itens</span>
                </button>

                <button onClick={() => setSelectedCategory('audio')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center transition-all group">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Mic size={32} className="text-red-400" />
                  </div>
                  <span className="font-semibold text-white">Áudios</span>
                  <span className="text-sm text-slate-400 mt-1">{counts.audio} itens</span>
                </button>

                <button onClick={() => setSelectedCategory('video')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center transition-all group">
                  <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Video size={32} className="text-pink-400" />
                  </div>
                  <span className="font-semibold text-white">Vídeos</span>
                  <span className="text-sm text-slate-400 mt-1">{counts.video} itens</span>
                </button>

                <button onClick={() => setSelectedCategory('location')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center transition-all group">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <MapPin size={32} className="text-orange-400" />
                  </div>
                  <span className="font-semibold text-white">Locais</span>
                  <span className="text-sm text-slate-400 mt-1">{counts.location} itens</span>
                </button>

                <button onClick={() => setSelectedCategory('schedule')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center transition-all group">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Calendar size={32} className="text-emerald-400" />
                  </div>
                  <span className="font-semibold text-white">Agendamentos</span>
                  <span className="text-sm text-slate-400 mt-1">{counts.schedule} itens</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6 mt-4">
              <button onClick={() => setSelectedCategory(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-2xl font-bold text-white capitalize flex-1">
                {selectedCategory === 'note' ? 'Notas' : 
                 selectedCategory === 'photo' ? 'Fotos' : 
                 selectedCategory === 'audio' ? 'Áudios' :
                 selectedCategory === 'video' ? 'Vídeos' :
                 selectedCategory === 'location' ? 'Locais' : 'Agendamentos'}
              </h2>
              {(selectedCategory === 'photo' || selectedCategory === 'video') && (
                <button
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedIds([]);
                  }}
                  className={`p-2 rounded-xl transition-all border ${
                    isSelectionMode 
                      ? 'bg-blue-600 border-blue-500 text-white' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                  title="Selecionar múltiplos para montagem"
                >
                  <CheckSquare size={20} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mb-6 bg-slate-800 p-2 rounded-xl border border-slate-700">
              <span className="text-sm text-slate-400 ml-2">Ordenar por:</span>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
              >
                <option value="date_desc">Mais recentes</option>
                <option value="date_asc">Mais antigos</option>
                <option value="name_asc">Nome (A-Z)</option>
                <option value="name_desc">Nome (Z-A)</option>
              </select>
            </div>

            {sortedItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>Nenhum item nesta pasta.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedItems.map((item) => {
                  const info = getItemDisplayInfo(item);
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => isSelectionMode && handleSelectToggle(item.id)}
                      className={`bg-slate-800 border rounded-2xl p-4 flex flex-col gap-3 transition-all ${
                        isSelectionMode ? 'cursor-pointer' : ''
                      } ${
                        isSelected ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500' : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1 pr-4">
                          {isSelectionMode && (
                            <div className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-600 bg-slate-900'
                            }`}>
                              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold text-lg leading-tight mb-1 truncate">{info.name}</h4>
                            <p className="text-slate-400 text-sm line-clamp-1">{info.brief}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded-md">{formatDate(item.timestamp)}</span>
                          {!isSelectionMode && (
                            <div className="flex items-center gap-1 mt-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setViewingItem(item); }}
                                className="text-slate-500 hover:text-emerald-400 transition-colors p-1"
                                title="Abrir Detalhes"
                              >
                                <Maximize2 size={18} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                className="text-slate-500 hover:text-emerald-400 transition-colors p-1"
                                title="Baixar para o dispositivo"
                              >
                                <Download size={18} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleShare(item); }}
                                className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                                title="Compartilhar"
                              >
                                <Share2 size={18} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                title="Excluir"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {item.type === 'photo' && (
                        <div className="mt-2 rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
                          <img src={item.content} alt="Documento" className="max-w-full max-h-full object-contain" />
                        </div>
                      )}

                      {item.type === 'audio' && (
                        <div className="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-3">
                          <Mic size={20} className="text-red-400" />
                          <MediaSource content={item.content} mediaUrl={item.mediaUrl} type="audio" />
                        </div>
                      )}

                      {item.type === 'video' && (
                        <div className="mt-2 rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700 relative group/video">
                          <MediaSource content={item.content} mediaUrl={item.mediaUrl} type="video" controls={false} />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/video:opacity-100 transition-opacity">
                            <Play size={32} className="text-white" fill="white" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {isSelectionMode && selectedIds.length > 0 && (
          <FloatingSelectionBar
            selectedCount={selectedIds.length}
            onCancel={() => {
              setIsSelectionMode(false);
              setSelectedIds([]);
            }}
            onStartMontage={handleStartMontage}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVideoCreator && (
          <VideoCreator
            initialItems={items.filter(i => selectedIds.includes(i.id))}
            onClose={() => setShowVideoCreator(false)}
            onSaved={handleMontageSaved}
          />
        )}
      </AnimatePresence>

      {/* Modal de Visualização */}
      <AnimatePresence>
        {viewingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <div className="flex-1 truncate pr-4">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none focus:border-blue-500"
                      placeholder="Título do item"
                    />
                  ) : (
                    <h3 className="text-lg font-bold text-white truncate">
                      {getItemDisplayInfo(viewingItem).name}
                    </h3>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <button
                      onClick={handleStartEdit}
                      className="p-2 text-slate-400 hover:text-blue-400 transition-colors rounded-full hover:bg-slate-700"
                      title="Editar título e resumo"
                    >
                      <FileText size={20} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setViewingItem(null);
                      setIsEditing(false);
                    }}
                    className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1">
                <div className="text-sm text-slate-400 mb-4">
                  Salvo em: {formatDate(viewingItem.timestamp)}
                </div>
                
                {isEditing && (
                  <div className="mb-4 space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Resumo / Descrição</label>
                    <textarea
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none h-32"
                      placeholder="Edite o resumo gerado pela IA..."
                    />
                  </div>
                )}

                {getCategory(viewingItem) === 'photo' ? (
                  <div className="space-y-4">
                    <img src={viewingItem.content} alt="Documento" className="w-full rounded-xl border border-slate-700" />
                    {!isEditing && viewingItem.metadata?.description && (
                      <p className="text-white whitespace-pre-wrap">{viewingItem.metadata.description}</p>
                    )}
                    {viewingItem.metadata?.linkedScheduleId && (
                      <button
                        onClick={() => handleOpenLinkedItem(viewingItem.metadata.linkedScheduleId)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                      >
                        <LinkIcon size={16} />
                        Ver Agendamento Vinculado
                      </button>
                    )}
                  </div>
                ) : getCategory(viewingItem) === 'audio' ? (
                  <div className="space-y-4">
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                        <Mic size={32} className="text-red-400" />
                      </div>
                      <MediaSource content={viewingItem.content} mediaUrl={viewingItem.mediaUrl} type="audio" />
                    </div>
                    {!isEditing && viewingItem.metadata?.description && (
                      <p className="text-white whitespace-pre-wrap">{viewingItem.metadata.description}</p>
                    )}
                  </div>
                ) : getCategory(viewingItem) === 'video' ? (
                  <div className="space-y-4">
                    <div className="bg-black rounded-xl border border-slate-700 overflow-hidden aspect-video">
                      <MediaSource content={viewingItem.content} mediaUrl={viewingItem.mediaUrl} type="video" />
                    </div>
                    {!isEditing && viewingItem.metadata?.description && (
                      <p className="text-white whitespace-pre-wrap">{viewingItem.metadata.description}</p>
                    )}
                  </div>
                ) : getCategory(viewingItem) === 'location' ? (
                  <div className="space-y-4">
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 font-mono text-sm text-slate-300">
                      {(() => {
                        try {
                          const loc = JSON.parse(viewingItem.content);
                          return (
                            <>
                              Latitude: {loc.lat}<br/>
                              Longitude: {loc.lng}
                            </>
                          );
                        } catch {
                          return viewingItem.content;
                        }
                      })()}
                    </div>
                    {!isEditing && viewingItem.metadata?.description && (
                      <p className="text-white whitespace-pre-wrap">{viewingItem.metadata.description}</p>
                    )}
                    {viewingItem.metadata?.linkedScheduleId && (
                      <button
                        onClick={() => handleOpenLinkedItem(viewingItem.metadata.linkedScheduleId)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                      >
                        <LinkIcon size={16} />
                        Ver Agendamento Vinculado
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                      <p className="text-white whitespace-pre-wrap text-sm leading-relaxed">
                        {viewingItem.content}
                      </p>
                    </div>
                    {!isEditing && viewingItem.metadata?.summary && (
                      <p className="text-slate-400 text-sm italic">Resumo: {viewingItem.metadata.summary}</p>
                    )}
                    
                    {viewingItem.metadata?.linkedNoteId && (
                      <button
                        onClick={() => handleOpenLinkedItem(viewingItem.metadata.linkedNoteId)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                      >
                        <LinkIcon size={16} />
                        Ver Nota Original Vinculada
                      </button>
                    )}

                    {viewingItem.metadata?.linkedPhotoId && (
                      <button
                        onClick={() => handleOpenLinkedItem(viewingItem.metadata.linkedPhotoId)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                      >
                        <LinkIcon size={16} />
                        Ver Foto Original Vinculada
                      </button>
                    )}

                    {viewingItem.metadata?.linkedLocationId && (
                      <button
                        onClick={() => handleOpenLinkedItem(viewingItem.metadata.linkedLocationId)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                      >
                        <LinkIcon size={16} />
                        Ver Local Original Vinculado
                      </button>
                    )}
                    
                    {viewingItem.metadata?.linkedScheduleId && (
                      <button
                        onClick={() => handleOpenLinkedItem(viewingItem.metadata.linkedScheduleId)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                      >
                        <LinkIcon size={16} />
                        Ver Agendamento Vinculado
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-700 flex gap-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {isSavingEdit ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      Salvar Alterações
                    </button>
                  </>
                ) : (
                  <>
                    {getCategory(viewingItem) === 'schedule' && (
                      <button
                        onClick={() => handleAddToCalendar(viewingItem)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <CalendarPlus size={20} />
                        Adicionar à Agenda
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(viewingItem)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Download size={20} />
                      Baixar
                    </button>
                    <button
                      onClick={() => handleShare(viewingItem)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Share2 size={20} />
                      Compartilhar
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FloatingSelectionBar({ selectedCount, onCancel, onStartMontage }: { selectedCount: number, onCancel: () => void, onStartMontage: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl flex items-center gap-6 w-[90%] max-w-md"
    >
      <div className="text-sm font-medium">
        <span className="text-blue-400 font-bold">{selectedCount}</span> selecionados
      </div>
      <div className="flex items-center gap-2 flex-1 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={onStartMontage}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Film size={18} />
          Montagem
        </button>
      </div>
    </motion.div>
  );
}
