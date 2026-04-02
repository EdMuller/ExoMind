import React, { useState, useEffect } from 'react';
import { Users, Ticket, TrendingUp, DollarSign, Calendar, Search, Plus, Trash2, Check, X, Shield, User as UserIcon, ArrowLeft, RefreshCw, AlertTriangle, Settings, Edit } from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, addDoc, deleteDoc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_VERSION } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  plan: string;
  credits: number;
  isVip?: boolean;
  cacaVoiceUses?: number;
  totalSpent: number;
  totalProfit: number;
  subscriptionDate?: number;
  role: string;
  whatsapp?: string;
}

interface CouponData {
  id: string;
  code: string;
  benefit: string;
  type: 'credits' | 'plan_upgrade' | 'time_extension';
  value: number;
  expiresAt?: number;
  active: boolean;
}

interface PlanData {
  id: string;
  name: string;
  price: number;
  conv: string;
  delivery: string;
  profit: number;
  color: string;
  depositValue: number;
  conversionFactor: number;
  benefits: string[];
  duration: string;
}

interface ConfigData {
  currentVersion: string;
  forceUpdate: boolean;
  maintenanceMode: boolean;
  betaMode: boolean;
  supportWhatsapp?: string;
  defaultCredits?: number;
  defaultConversionFactor?: number;
}

interface TransactionData {
  id: string;
  amount: number;
  description: string;
  timestamp: number;
  type: string;
}

export const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'coupons' | 'stats' | 'version' | 'plans'>('users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [coupons, setCoupons] = useState<CouponData[]>([]);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [editingPlan, setEditingPlan] = useState<PlanData | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PlanData>>({});
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [userTransactions, setUserTransactions] = useState<TransactionData[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Coupon form state
  const [showAddCoupon, setShowAddCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState<Partial<CouponData>>({
    code: '',
    benefit: '',
    type: 'credits',
    value: 0,
    active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Clear editing states when tab changes to prevent UI leakage
  useEffect(() => {
    setEditingPlan(null);
    setEditingUser(null);
    setEditingRowId(null);
    setShowAddCoupon(false);
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserData));
      setUsers(usersList);

      const couponsSnap = await getDocs(collection(db, 'coupons'));
      const couponsList = couponsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CouponData));
      setCoupons(couponsList);

      const configSnap = await getDoc(doc(db, 'config', 'app_config'));
      if (configSnap.exists()) {
        setConfig(configSnap.data() as ConfigData);
      } else {
        const initialConfig = { 
          currentVersion: APP_VERSION, 
          forceUpdate: false, 
          maintenanceMode: false, 
          betaMode: false,
          supportWhatsapp: '5511999999999',
          defaultCredits: 50,
          defaultConversionFactor: 0.25
        };
        await setDoc(doc(db, 'config', 'app_config'), initialConfig);
        setConfig(initialConfig as ConfigData);
      }

      const plansSnap = await getDocs(collection(db, 'plans'));
      if (plansSnap.empty) {
        const defaultPlans: PlanData[] = [
          { 
            id: 'bronze', 
            name: 'Bronze', 
            price: 10, 
            conv: '25%', 
            delivery: 'R$ 2.50 em benefícios', 
            profit: 7.50, 
            color: 'text-orange-400',
            depositValue: 10,
            conversionFactor: 0.25,
            benefits: ['Benefícios Proporcionais'],
            duration: '30 dias'
          },
          { 
            id: 'prata', 
            name: 'Prata', 
            price: 10, 
            conv: '25%', 
            delivery: 'R$ 2.50 em benefícios', 
            profit: 7.50, 
            color: 'text-slate-300',
            depositValue: 10,
            conversionFactor: 0.25,
            benefits: ['Benefícios Proporcionais'],
            duration: '30 dias'
          },
          { 
            id: 'ouro', 
            name: 'Ouro', 
            price: 10, 
            conv: '25%', 
            delivery: 'R$ 2.50 em benefícios', 
            profit: 7.50, 
            color: 'text-yellow-400',
            depositValue: 10,
            conversionFactor: 0.25,
            benefits: ['Benefícios Proporcionais'],
            duration: '30 dias'
          },
          { 
            id: 'diamante', 
            name: 'Diamante', 
            price: 497, 
            conv: '25%', 
            delivery: 'R$ 124.25 em benefícios', 
            profit: 372.75, 
            color: 'text-blue-400',
            depositValue: 497,
            conversionFactor: 0.25,
            benefits: ['Créditos Ilimitados*', 'Voz IA Ilimitada*', 'Suporte VIP', 'Análise IA Avançada'],
            duration: '30 dias'
          }
        ];
        for (const p of defaultPlans) {
          await setDoc(doc(db, 'plans', p.id), p);
        }
        setPlans(defaultPlans);
      } else {
        const plansList = plansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanData));
        setPlans(plansList.sort((a, b) => a.price - b.price));
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (updates: Partial<ConfigData>) => {
    try {
      await updateDoc(doc(db, 'config', 'app_config'), updates);
      setConfig(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error("Error updating config:", error);
    }
  };

  const handleAddCoupon = async () => {
    if (!newCoupon.code || !newCoupon.type || newCoupon.value === undefined) return;
    
    try {
      await addDoc(collection(db, 'coupons'), {
        ...newCoupon,
        code: newCoupon.code.toUpperCase(),
        createdAt: Date.now()
      });
      setShowAddCoupon(false);
      setNewCoupon({ code: '', benefit: '', type: 'credits', value: 0, active: true });
      fetchData();
    } catch (error) {
      console.error("Error adding coupon:", error);
    }
  };

  const toggleCouponStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'coupons', id), { active: !currentStatus });
      fetchData();
    } catch (error) {
      console.error("Error updating coupon:", error);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este cupom?")) return;
    try {
      await deleteDoc(doc(db, 'coupons', id));
      fetchData();
    } catch (error) {
      console.error("Error deleting coupon:", error);
    }
  };

  const fetchUserTransactions = async (uid: string) => {
    setLoadingTransactions(true);
    try {
      const transSnap = await getDocs(query(collection(db, 'users', uid, 'transactions')));
      const transList = transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionData));
      setUserTransactions(transList.sort((a, b) => b.timestamp - a.timestamp));
      setShowTransactions(true);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleUpdateUser = async (uid: string, updates: Partial<UserData>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      setEditingUser(null);
      fetchData();
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const calculateDeliveryText = (price: number, factor: number) => {
    const deliveryValue = price * factor;
    if (deliveryValue >= 100) return "Ilimitado* / Suporte VIP / Análise IA";
    
    // If it's a free tier (price is 0), use the factor as a percentage of defaultCredits
    if (price === 0) {
      const baseCredits = config?.defaultCredits || 50;
      const freeCredits = Math.floor(baseCredits * factor);
      const freeHours = (freeCredits / 50).toFixed(1);
      return `${freeCredits} Créditos / ${freeHours}h Voz IA (Grátis)`;
    }

    const credits = Math.floor(deliveryValue * 50);
    const hours = Math.floor(deliveryValue * 1);
    return `${credits} Créditos / ${hours}h Voz IA`;
  };

  const handleUpdatePlan = async (id: string, updates: Partial<PlanData>) => {
    try {
      const plan = plans.find(p => p.id === id);
      if (!plan) return;

      const price = updates.price !== undefined ? updates.price : plan.price;
      const factor = updates.conversionFactor !== undefined ? updates.conversionFactor : plan.conversionFactor;
      
      // Automatic calculations based strictly on user input
      const deliveryValue = price * factor;
      const newProfit = price - deliveryValue;
      const deliveryText = calculateDeliveryText(price, factor);
      const convText = `${(factor * 100).toFixed(0)}%`;

      const finalUpdates = { 
        ...updates,
        price,
        conversionFactor: factor,
        profit: newProfit,
        delivery: deliveryText,
        conv: convText
      };

      await updateDoc(doc(db, 'plans', id), finalUpdates);
      setEditingPlan(null);
      fetchData();
    } catch (error) {
      console.error("Error updating plan:", error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = users.reduce((acc, u) => acc + (u.totalSpent || 0), 0);
  const totalProfit = users.reduce((acc, u) => acc + (u.totalProfit || 0), 0);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      {/* Admin Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-red-500" size={24} />
          <h2 className="text-xl font-bold text-white">Painel Administrativo</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Usuários
          </button>
          <button 
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'plans' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Planos
          </button>
          <button 
            onClick={() => setActiveTab('coupons')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'coupons' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Cupons
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'stats' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Métricas
          </button>
          <button 
            onClick={() => setActiveTab('version')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'version' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Configurações
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                          <th className="p-4 font-semibold">Usuário</th>
                          <th className="p-4 font-semibold">Plano</th>
                          <th className="p-4 font-semibold">Créditos</th>
                          <th className="p-4 font-semibold">Gasto Real</th>
                          <th className="p-4 font-semibold">Lucro</th>
                          <th className="p-4 font-semibold">WhatsApp</th>
                          <th className="p-4 font-semibold text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredUsers.map((u) => (
                          <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                                  <UserIcon size={16} />
                                </div>
                                <div>
                                  <div className="font-medium text-white flex items-center gap-2">
                                    {u.displayName || 'Sem nome'}
                                    {u.isVip && <Shield size={12} className="text-purple-400" fill="currentColor" />}
                                  </div>
                                  <div className="text-xs text-slate-500">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                                u.plan === 'Diamante' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                u.plan === 'Ouro' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                u.plan === 'Prata' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                'bg-slate-700 text-slate-400'
                              }`}>
                                {u.plan}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-sm">{(u.credits || 0).toFixed(0)}</td>
                            <td className="p-4 font-mono text-sm text-emerald-400">R$ {(u.totalSpent || 0).toFixed(2)}</td>
                            <td className="p-4 font-mono text-sm text-blue-400">R$ {(u.totalProfit || 0).toFixed(2)}</td>
                            <td className="p-4 text-xs text-slate-400">{u.whatsapp || '-'}</td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => setEditingUser(u)}
                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title="Editar Usuário"
                              >
                                <Edit size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'coupons' && (
              <motion.div
                key="coupons"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">Gerenciar Cupons</h3>
                  <button 
                    onClick={() => setShowAddCoupon(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                  >
                    <Plus size={18} />
                    Novo Cupom
                  </button>
                </div>

                {showAddCoupon && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 uppercase font-bold">Código</label>
                        <input 
                          type="text" 
                          value={newCoupon.code}
                          onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value})}
                          placeholder="EX: CUPOM20"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 uppercase font-bold">Tipo</label>
                        <select 
                          value={newCoupon.type}
                          onChange={(e) => setNewCoupon({...newCoupon, type: e.target.value as any})}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="credits">Créditos (R$)</option>
                          <option value="plan_upgrade">Upgrade de Plano</option>
                          <option value="time_extension">Extensão de Tempo</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 uppercase font-bold">Valor</label>
                        <input 
                          type="number" 
                          value={newCoupon.value}
                          onChange={(e) => setNewCoupon({...newCoupon, value: Number(e.target.value)})}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 uppercase font-bold">Descrição (Opcional)</label>
                        <input 
                          type="text" 
                          value={newCoupon.benefit}
                          onChange={(e) => setNewCoupon({...newCoupon, benefit: e.target.value})}
                          placeholder="Ex: 20% de desconto"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button 
                        onClick={() => setShowAddCoupon(false)}
                        className="px-6 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleAddCoupon}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-xl font-bold transition-all"
                      >
                        Salvar Cupom
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {coupons.map((c) => (
                    <div key={c.id} className={`bg-slate-900 border rounded-2xl p-5 flex justify-between items-start transition-all ${c.active ? 'border-slate-800' : 'border-slate-800 opacity-60'}`}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-white tracking-tighter">{c.code}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${c.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                            {c.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">{c.benefit || `${c.value} ${c.type === 'credits' ? 'em créditos' : 'de benefício'}`}</p>
                        <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                          <Ticket size={12} />
                          {c.type.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => toggleCouponStatus(c.id, c.active)}
                          className={`p-2 rounded-lg transition-colors ${c.active ? 'bg-slate-800 text-slate-400 hover:text-yellow-500' : 'bg-emerald-500/20 text-emerald-400'}`}
                          title={c.active ? "Desativar" : "Ativar"}
                        >
                          {c.active ? <X size={18} /> : <Check size={18} />}
                        </button>
                        <button 
                          onClick={() => deleteCoupon(c.id)}
                          className="p-2 bg-slate-800 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'plans' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <DollarSign className="text-purple-400" />
                      Análise de Assinaturas & Rentabilidade
                    </h3>
                    <button 
                      onClick={fetchData}
                      className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Recarregar Dados"
                    >
                      <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Plano</th>
                          <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Valor (R$)</th>
                          <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Fator Conversão</th>
                          <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Entrega (Mensal)</th>
                          <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Lucro Est.</th>
                          <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Ativos</th>
                          <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {plans.length === 0 && !loading && (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                              Nenhum plano encontrado. Clique no botão de recarregar para inicializar.
                            </td>
                          </tr>
                        )}
                        {plans.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className={`py-4 font-bold ${p.color}`}>{p.name}</td>
                            <td className="py-4">
                              <span className="text-white font-mono">R$ {p.price.toFixed(2)}</span>
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-2 text-slate-300 text-sm">
                                <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${p.conversionFactor * 100}%` }}></div>
                                </div>
                                {(p.conversionFactor * 100).toFixed(0)}%
                              </div>
                            </td>
                            <td className="py-4">
                              <span className="text-slate-400 text-xs italic">
                                {calculateDeliveryText(p.price, p.conversionFactor)}
                              </span>
                            </td>
                            <td className="py-4 text-emerald-400 font-bold">
                              R$ {(p.price * (1 - p.conversionFactor)).toFixed(2)}
                            </td>
                            <td className="py-4">
                              <span className="bg-slate-700 text-white px-3 py-1 rounded-full text-xs font-bold">
                                {users.filter(u => u.plan === p.name).length}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <button 
                                onClick={() => setEditingPlan(p)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all text-xs font-bold"
                                title="Editar Plano"
                              >
                                <Edit size={14} className="text-purple-400" />
                                Editar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-8 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <TrendingUp className="text-purple-400" size={18} />
                      <span className="text-sm font-bold text-purple-300">Resumo de Faturamento Mensal</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Bruto Estimado</div>
                        <div className="text-lg font-black text-white">
                          R$ {users.reduce((acc, u) => {
                            const plan = plans.find(p => p.name === u.plan);
                            return acc + (plan?.price || 0);
                          }, 0).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Lucro Líquido Est.</div>
                        <div className="text-lg font-black text-emerald-400">
                          R$ {users.reduce((acc, u) => {
                            const plan = plans.find(p => p.name === u.plan);
                            return acc + (plan?.profit || 0);
                          }, 0).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Transactions Modal */}
            <AnimatePresence>
              {showTransactions && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calendar className="text-blue-400" />
                        Histórico de Transações
                      </h3>
                      <button 
                        onClick={() => setShowTransactions(false)}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                      {loadingTransactions ? (
                        <div className="flex items-center justify-center py-20">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                      ) : userTransactions.length === 0 ? (
                        <div className="text-center py-20 text-slate-500 italic">
                          Nenhuma transação encontrada para este usuário.
                        </div>
                      ) : (
                        userTransactions.map((t) => (
                          <div key={t.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-sm font-bold text-white">{t.description}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {new Date(t.timestamp).toLocaleString('pt-BR')}
                              </div>
                            </div>
                            <div className={`text-sm font-black font-mono ${t.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.amount > 0 ? '+' : ''}{t.amount}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Edit User Modal */}
            <AnimatePresence>
              {editingUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <UserIcon size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white leading-tight">
                          {editingUser.displayName || 'Usuário'}
                        </h3>
                        <p className="text-xs text-slate-500">{editingUser.email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Créditos</label>
                          <input 
                            type="number"
                            value={editingUser.credits}
                            onChange={(e) => setEditingUser({ ...editingUser, credits: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plano</label>
                          <select 
                            value={editingUser.plan}
                            onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="Bronze">Bronze</option>
                            <option value="Prata">Prata</option>
                            <option value="Ouro">Ouro</option>
                            <option value="Diamante">Diamante</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                        <div>
                          <div className="text-sm font-bold text-white uppercase tracking-wider">Status VIP</div>
                          <div className="text-xs text-slate-500">Acesso ilimitado a funções</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={editingUser.isVip}
                            onChange={(e) => setEditingUser({ ...editingUser, isVip: e.target.checked })}
                          />
                          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo</label>
                        <select 
                          value={editingUser.role}
                          onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="user">Usuário Comum</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>

                      <button 
                        onClick={() => fetchUserTransactions(editingUser.uid)}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Calendar size={18} />
                        Ver Histórico de Transações
                      </button>
                    </div>
                    
                    <div className="flex gap-3 mt-8">
                      <button 
                        onClick={() => setEditingUser(null)}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => handleUpdateUser(editingUser.uid, {
                          credits: editingUser.credits,
                          plan: editingUser.plan,
                          isVip: editingUser.isVip,
                          role: editingUser.role
                        })}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                      >
                        Salvar
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Edit Plan Modal */}
            <AnimatePresence>
              {editingPlan && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl"
                  >
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                      Editar Plano: <span className={editingPlan.color}>{editingPlan.name}</span>
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
                          <input 
                            type="number"
                            value={editingPlan.price}
                            onChange={(e) => setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fator de Conversão (%)</label>
                          <input 
                            type="number"
                            step="1"
                            value={editingPlan.conversionFactor * 100}
                            onChange={(e) => setEditingPlan({ ...editingPlan, conversionFactor: parseFloat(e.target.value) / 100 })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Entrega Estimada</label>
                          <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-emerald-400 font-bold">
                            {calculateDeliveryText(editingPlan.price, editingPlan.conversionFactor)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lucro Estimado</label>
                          <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-blue-400 font-bold">
                            R$ {(editingPlan.price * (1 - editingPlan.conversionFactor)).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duração</label>
                          <input 
                            type="text"
                            value={editingPlan.duration}
                            onChange={(e) => setEditingPlan({ ...editingPlan, duration: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cor (Tailwind Class)</label>
                          <input 
                            type="text"
                            value={editingPlan.color}
                            onChange={(e) => setEditingPlan({ ...editingPlan, color: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Benefícios (um por linha)</label>
                        <textarea 
                          value={editingPlan.benefits.join('\n')}
                          onChange={(e) => setEditingPlan({ ...editingPlan, benefits: e.target.value.split('\n') })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 h-24"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-8">
                      <button 
                        onClick={() => setEditingPlan(null)}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => handleUpdatePlan(editingPlan.id, editingPlan)}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold">
                      <DollarSign size={14} className="text-emerald-500" />
                      Receita Total
                    </div>
                    <div className="text-3xl font-black text-white tracking-tighter">R$ {totalRevenue.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold">
                      <TrendingUp size={14} className="text-blue-500" />
                      Lucro ExoMind
                    </div>
                    <div className="text-3xl font-black text-white tracking-tighter">R$ {totalProfit.toFixed(2)}</div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Users size={20} className="text-blue-400" />
                    Distribuição de Planos
                  </h3>
                  <div className="space-y-3">
                    {['Bronze', 'Prata', 'Ouro', 'Diamante'].map(plan => {
                      const count = users.filter(u => u.plan === plan).length;
                      const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
                      return (
                        <div key={plan} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400 uppercase">{plan}</span>
                            <span className="text-white">{count} usuários ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                plan === 'Diamante' ? 'bg-purple-500' :
                                plan === 'Ouro' ? 'bg-yellow-500' :
                                plan === 'Prata' ? 'bg-blue-500' :
                                'bg-slate-600'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'version' && (
              <motion.div
                key="version"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <RefreshCw size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Controle de Versão</h3>
                      <p className="text-sm text-slate-500">Gerencie a publicação de novas versões.</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">Versão Atual do App</div>
                        <div className="text-xs text-slate-500">Versão rodando neste navegador</div>
                      </div>
                      <div className="text-2xl font-black text-blue-400">{APP_VERSION}</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">Versão Publicada (Nuvem)</div>
                        <div className="text-xs text-slate-500">Versão que os usuários serão notificados</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={config?.currentVersion}
                          onChange={(e) => handleUpdateConfig({ currentVersion: e.target.value })}
                          className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-center text-white font-mono font-bold"
                        />
                        <button 
                          onClick={() => handleUpdateConfig({ currentVersion: APP_VERSION })}
                          className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                        >
                          Usar Atual
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">WhatsApp de Suporte</div>
                        <div className="text-xs text-slate-500">Número para suporte (com DDI, ex: 5511999999999)</div>
                      </div>
                      <input 
                        type="text" 
                        value={config?.supportWhatsapp || ''}
                        onChange={(e) => handleUpdateConfig({ supportWhatsapp: e.target.value })}
                        placeholder="5511999999999"
                        className="w-48 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">Fator de Conversão Padrão (%)</div>
                        <div className="text-xs text-slate-500">Fator global para conversão de valores em tempo de IA</div>
                      </div>
                      <input 
                        type="number" 
                        step="0.01"
                        value={(config?.defaultConversionFactor || 0.25) * 100}
                        onChange={(e) => handleUpdateConfig({ defaultConversionFactor: parseFloat(e.target.value) / 100 })}
                        className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-center text-white font-mono font-bold"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">Créditos Iniciais</div>
                        <div className="text-xs text-slate-500">Créditos para novos usuários</div>
                      </div>
                      <input 
                        type="number" 
                        value={config?.defaultCredits || 0}
                        onChange={(e) => handleUpdateConfig({ defaultCredits: parseInt(e.target.value) || 0 })}
                        className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-center text-white font-mono font-bold"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">Forçar Atualização</div>
                        <div className="text-xs text-slate-500">Obriga o usuário a atualizar para continuar</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={config?.forceUpdate}
                          onChange={(e) => handleUpdateConfig({ forceUpdate: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">Modo Manutenção</div>
                        <div className="text-xs text-slate-500">Bloqueia o acesso ao app para todos exceto admins</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={config?.maintenanceMode}
                          onChange={(e) => handleUpdateConfig({ maintenanceMode: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">Modo Beta (Testes)</div>
                        <div className="text-xs text-slate-500">Ativa funções experimentais apenas para admins</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={config?.betaMode}
                          onChange={(e) => handleUpdateConfig({ betaMode: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </div>

                  {config?.maintenanceMode && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                      <AlertTriangle className="text-red-500 shrink-0" size={20} />
                      <p className="text-xs text-red-400 leading-relaxed">
                        <strong>Atenção:</strong> O Modo Manutenção está ATIVO. Apenas administradores podem acessar o aplicativo no momento.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Admin Footer */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <button 
          onClick={onBack}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft size={18} />
          Voltar para o ExoMind
        </button>
      </div>
    </div>
  );
};
