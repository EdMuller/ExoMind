import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Folder, Trash2, Move, Plus, X, ChevronRight, FileText, Download, Archive, AlertCircle, Check, Loader2, Camera, Mic, Video, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFolders, getItems, deleteItem, deleteFolder, updateItemFolder, ExoFolder, ExoItem, saveFolder } from '../db';

interface FolderManagerProps {
  onClose: () => void;
}

export function FolderManager({ onClose }: FolderManagerProps) {
  const [folders, setFolders] = useState<ExoFolder[]>([]);
  const [items, setItems] = useState<ExoItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [f, i] = await Promise.all([getFolders(), getItems()]);
    setFolders(f);
    setItems(i);
    setIsLoading(false);
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Tem certeza que deseja apagar este item permanentemente?')) {
      await deleteItem(id);
      loadData();
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (confirm('Ao apagar a pasta, todos os itens dentro dela serão movidos para o "Balaio". Deseja continuar?')) {
      await deleteFolder(id);
      loadData();
    }
  };

  const handleMoveItem = async (itemId: string, folderId: string) => {
    await updateItemFolder(itemId, folderId);
    setMovingItemId(null);
    loadData();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const newFolder: ExoFolder = {
      id: uuidv4(),
      name: newFolderName.trim(),
      parentId: null,
      userId: '',
      timestamp: Date.now()
    };
    await saveFolder(newFolder);
    setNewFolderName('');
    setShowNewFolder(false);
    loadData();
  };

  const handleExport = () => {
    const data = {
      folders,
      items: items.map(i => ({ ...i, content: typeof i.content === 'string' ? i.content : '(media file)' }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exomind-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const filteredItems = items.filter(i => 
    selectedFolderId === 'balaio' ? i.folderId === 'balaio' : 
    selectedFolderId ? i.folderId === selectedFolderId : true
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col bg-slate-950 absolute inset-0 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
        <div>
          <h2 className="text-2xl font-bold text-white">Gerenciar Memória</h2>
          <p className="text-slate-400 text-sm">Organize, mova ou apague seus registros</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="p-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all">
            <Download size={20} />
          </button>
          <button onClick={onClose} className="p-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Folders */}
        <div className="w-72 border-r border-slate-800 overflow-y-auto p-4 space-y-2 bg-slate-900/20">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${!selectedFolderId ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <FileText size={18} />
            <span className="font-medium">Todos os Itens</span>
          </button>

          <button
            onClick={() => setSelectedFolderId('balaio')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedFolderId === 'balaio' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Archive size={18} />
            <span className="font-medium">Balaio</span>
          </button>

          <div className="pt-4 pb-2">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Suas Pastas</span>
              <button onClick={() => setShowNewFolder(true)} className="p-1 text-blue-400 hover:bg-blue-400/10 rounded-md">
                <Plus size={16} />
              </button>
            </div>
            {folders.map(folder => (
              <div key={folder.id} className="group relative">
                <button
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all pr-10 ${selectedFolderId === folder.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  <Folder size={18} className={selectedFolderId === folder.id ? 'text-blue-400' : 'text-slate-500'} />
                  <span className="truncate font-medium">{folder.name}</span>
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content - Items */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <Archive size={48} className="mb-4 opacity-20" />
              <p>Nenhum item encontrado nesta pasta.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <motion.div
                  layout
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        item.type === 'text' ? 'bg-blue-500/20 text-blue-400' :
                        item.type === 'photo' ? 'bg-purple-500/20 text-purple-400' :
                        item.type === 'audio' ? 'bg-red-500/20 text-red-400' :
                        item.type === 'video' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {item.type === 'text' ? <FileText size={16} /> : 
                         item.type === 'photo' ? <Camera size={16} /> :
                         item.type === 'audio' ? <Mic size={16} /> :
                         item.type === 'video' ? <Video size={16} /> :
                         <MapPin size={16} />}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setMovingItemId(item.id)}
                        className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                      >
                        <Move size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 text-slate-300 text-sm line-clamp-3">
                    {typeof item.content === 'string' ? item.content : `Arquivo de ${item.type}`}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Folder size={10} />
                      {item.folderId === 'balaio' ? 'Balaio' : folders.find(f => f.id === item.folderId)?.name || 'Desconhecido'}
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${item.syncStatus === 'synced' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {item.syncStatus === 'synced' ? <Check size={10} /> : <Loader2 size={10} className="animate-spin" />}
                      {item.syncStatus === 'synced' ? 'Sincronizado' : 'Pendente'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Move Item Modal */}
      <AnimatePresence>
        {movingItemId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-6">Mover para...</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-6">
                <button
                  onClick={() => handleMoveItem(movingItemId, 'balaio')}
                  className="w-full flex items-center gap-3 p-4 bg-slate-900 hover:bg-slate-700 rounded-xl text-slate-300 transition-all"
                >
                  <Archive size={18} className="text-amber-500" />
                  <span>Balaio</span>
                </button>
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleMoveItem(movingItemId, f.id)}
                    className="w-full flex items-center gap-3 p-4 bg-slate-900 hover:bg-slate-700 rounded-xl text-slate-300 transition-all"
                  >
                    <Folder size={18} className="text-blue-500" />
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMovingItemId(null)}
                className="w-full py-3 bg-slate-700 text-white rounded-xl font-medium hover:bg-slate-600"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolder && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-4">Nova Pasta</h3>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nome da pasta..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none mb-6"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewFolder(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Criar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
