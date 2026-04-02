import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { subscribeToCaptures, deleteCapture } from '../db';
import { CaptureItem } from '../types';
import { 
  FileText, 
  Mic, 
  Video, 
  MapPin, 
  Calendar, 
  Trash2, 
  ExternalLink, 
  Clock, 
  Tag,
  Search,
  Filter,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SavedItems: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToCaptures(user.uid, (data) => {
      setItems(data);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === 'all' || item.type === filter;
    const matchesSearch = item.metadata.title.toLowerCase().includes(search.toLowerCase()) ||
                         item.metadata.description?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getTypeIcon = (type: CaptureItem['type']) => {
    switch (type) {
      case 'note': return <FileText className="w-5 h-5 text-blue-400" />;
      case 'audio': return <Mic className="w-5 h-5 text-indigo-400" />;
      case 'video': return <Video className="w-5 h-5 text-rose-400" />;
      case 'location': return <MapPin className="w-5 h-5 text-emerald-400" />;
      case 'schedule': return <Calendar className="w-5 h-5 text-amber-400" />;
      default: return <FileText className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto no-scrollbar">
          {['all', 'note', 'audio', 'video', 'location', 'schedule'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                filter === t 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {t === 'all' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl w-full md:w-64">
          <Search className="w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar capturas..." 
            className="bg-transparent border-none outline-none text-sm w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group bg-zinc-900 border border-zinc-800 rounded-3xl p-6 hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/5 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl bg-zinc-800 border border-zinc-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-colors`}>
                  {getTypeIcon(item.type)}
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-100 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteCapture(item.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                  {item.metadata.title}
                </h4>
                <p className="text-sm text-zinc-400 line-clamp-2 min-h-[2.5rem]">
                  {item.metadata.description || 'Sem descrição.'}
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {item.createdAt ? format(item.createdAt.toDate(), "d 'de' MMM", { locale: ptBR }) : 'Recentemente'}
                </div>
                {item.metadata.tags && item.metadata.tags.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3 h-3" />
                    {item.metadata.tags[0]}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredItems.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <div className="p-6 bg-zinc-900 rounded-full w-20 h-20 flex items-center justify-center mx-auto border border-zinc-800">
            <Filter className="w-8 h-8 text-zinc-700" />
          </div>
          <div className="space-y-1">
            <p className="text-zinc-100 font-bold text-lg">Nenhuma captura encontrada</p>
            <p className="text-zinc-500">Tente mudar os filtros ou fazer uma nova captura.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedItems;
