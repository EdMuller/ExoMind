import React, { useState, useEffect } from 'react';
import { Camera, MapPin, FileText, Loader2, Trash2, Calendar, Folder, ArrowLeft, ArrowDownAZ, ArrowUpAZ, CalendarDays, Share2, Maximize2, X, Link as LinkIcon, CalendarPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getItems, deleteItem } from '../db';
import { generateICS } from '../utils/calendar';

type ItemCategory = 'note' | 'photo' | 'location' | 'schedule' | null;
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc';

export function SavedItems() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [viewingItem, setViewingItem] = useState<any | null>(null);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await getItems();
      setItems(data);
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
    } else {
      alert('O item vinculado não foi encontrado ou foi excluído.');
    }
  };

  const handleAddToCalendar = (item: any) => {
    generateICS(item.metadata || {});
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
              <h2 className="text-2xl font-bold text-white capitalize">
                {selectedCategory === 'note' ? 'Notas' : selectedCategory === 'photo' ? 'Fotos' : selectedCategory === 'location' ? 'Locais' : 'Agendamentos'}
              </h2>
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
                  return (
                    <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-white font-semibold text-lg leading-tight mb-1">{info.name}</h4>
                          <p className="text-slate-400 text-sm line-clamp-1">{info.brief}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded-md">{formatDate(item.timestamp)}</span>
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              onClick={() => setViewingItem(item)}
                              className="text-slate-500 hover:text-emerald-400 transition-colors p-1"
                              title="Abrir Detalhes"
                            >
                              <Maximize2 size={18} />
                            </button>
                            <button
                              onClick={() => handleShare(item)}
                              className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                              title="Compartilhar"
                            >
                              <Share2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors p-1"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {item.type === 'photo' && (
                        <div className="mt-2 rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
                          <img src={item.content} alt="Documento" className="max-w-full max-h-full object-contain" />
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
                <h3 className="text-lg font-bold text-white truncate pr-4">
                  {getItemDisplayInfo(viewingItem).name}
                </h3>
                <button
                  onClick={() => setViewingItem(null)}
                  className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1">
                <div className="text-sm text-slate-400 mb-4">
                  Salvo em: {formatDate(viewingItem.timestamp)}
                </div>
                
                {getCategory(viewingItem) === 'photo' ? (
                  <div className="space-y-4">
                    <img src={viewingItem.content} alt="Documento" className="w-full rounded-xl border border-slate-700" />
                    {viewingItem.metadata?.description && (
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
                    {viewingItem.metadata?.description && (
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
                  onClick={() => handleShare(viewingItem)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 size={20} />
                  Compartilhar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
