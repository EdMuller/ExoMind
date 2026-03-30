import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, Archive, ChevronRight, Plus, X, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { getFolders, saveFolder, ExoFolder } from '../db';

interface FolderSelectorProps {
  onSelect: (folderId: string) => void;
  onCancel: () => void;
  showAllOption?: boolean;
}

export function FolderSelector({ onSelect, onCancel, showAllOption }: FolderSelectorProps) {
  const [folders, setFolders] = useState<ExoFolder[]>([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    setIsLoading(true);
    const data = await getFolders();
    setFolders(data);
    setIsLoading(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    const newFolder: ExoFolder = {
      id: Date.now().toString(),
      name: newFolderName.trim(),
      parentId: selectedParentId,
      userId: '', // Will be set in saveFolder
      timestamp: Date.now()
    };

    await saveFolder(newFolder);
    setNewFolderName('');
    setShowNewFolder(false);
    setSelectedParentId(null);
    loadFolders();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col p-6 bg-slate-900 absolute inset-0 z-30"
    >
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">Onde salvar?</h2>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* All Folders Option (for consulting) */}
          {showAllOption && (
            <button
              onClick={() => onSelect('all')}
              className="w-full flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all group"
            >
              <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                <Search size={24} />
              </div>
              <div className="flex-1 text-left">
                <span className="font-bold text-lg text-white">Todas as Pastas</span>
                <p className="text-slate-400 text-xs">Consultar em todo o seu cérebro</p>
              </div>
              <ChevronRight size={20} className="text-slate-600" />
            </button>
          )}

          {/* Balaio Option */}
          <button
            onClick={() => onSelect('balaio')}
            className="w-full flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all group"
          >
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Archive size={24} />
            </div>
            <div className="flex-1 text-left">
              <span className="font-bold text-lg text-white">Balaio</span>
              <p className="text-slate-400 text-xs">Pasta temporária / aleatória</p>
            </div>
            <ChevronRight size={20} className="text-slate-600" />
          </button>

          {/* New Folder Option */}
          <button
            onClick={() => setShowNewFolder(true)}
            className="w-full flex items-center gap-4 p-5 bg-blue-600/10 hover:bg-blue-600/20 rounded-2xl border border-blue-500/30 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <FolderPlus size={24} />
            </div>
            <div className="flex-1 text-left">
              <span className="font-bold text-lg text-blue-400">Nova Pasta</span>
              <p className="text-blue-500/60 text-xs">Criar uma nova categoria</p>
            </div>
            <Plus size={20} className="text-blue-500/50" />
          </button>

          {/* Existing Folders */}
          {folders.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Pastas Existentes</label>
              <div className="space-y-3">
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => onSelect(folder.id)}
                    className="w-full flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-700 rounded-xl border border-slate-700/50 transition-all"
                  >
                    <Folder size={20} className="text-slate-400" />
                    <span className="flex-1 text-left text-slate-200 font-medium">{folder.name}</span>
                    <ChevronRight size={16} className="text-slate-700" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* New Folder Modal */}
        {showNewFolder && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-4">Criar Pasta</h3>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nome da pasta..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none mb-4"
              />
              
              <div className="mb-6">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Vincular a (Subpasta)</label>
                <select
                  value={selectedParentId || ''}
                  onChange={(e) => setSelectedParentId(e.target.value || null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-300 outline-none"
                >
                  <option value="">Nenhuma (Pasta Principal)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewFolder(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Criar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
