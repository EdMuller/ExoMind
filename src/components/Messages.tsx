import React, { useState, useEffect } from 'react';
import { Send, User as UserIcon, Search, ArrowLeft, Clock, MessageSquare, Check, CheckCheck, Loader2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db as firestore } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  scheduledAt?: number;
  status: 'pending' | 'sent' | 'read';
  type: 'text' | 'photo' | 'audio' | 'video';
}

interface Contact {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export function Messages({ onBack }: { onBack: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [showScheduler, setShowScheduler] = useState(false);

  const user = auth.currentUser;

  // Fetch contacts (for now, anyone you've messaged or searched)
  useEffect(() => {
    if (!user) return;
    // This is a simplified version. In a real app, you'd have a 'contacts' collection.
    // Here we'll just show people you've messaged.
  }, [user]);

  // Fetch messages for selected contact
  useEffect(() => {
    if (!user || !selectedContact) return;

    const q = query(
      collection(firestore, 'messages'),
      where('senderId', 'in', [user.uid, selectedContact.uid]),
      where('receiverId', 'in', [user.uid, selectedContact.uid]),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      // Filter out scheduled messages that are not yet due (if you are the receiver)
      const now = Date.now();
      const visibleMsgs = msgs.filter(m => {
        if (m.receiverId === user.uid && m.scheduledAt && m.scheduledAt > now) return false;
        return true;
      });
      setMessages(visibleMsgs);

      // Mark as read
      msgs.forEach(m => {
        if (m.receiverId === user.uid && m.status !== 'read') {
          updateDoc(doc(firestore, 'messages', m.id), { status: 'read' });
        }
      });
    });

    return () => unsubscribe();
  }, [user, selectedContact]);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setIsSearching(true);
    try {
      const q = query(collection(firestore, 'users'), where('email', '==', searchEmail.trim()));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const contactData = snapshot.docs[0].data() as Contact;
        if (contactData.uid === user?.uid) {
          alert('Você não pode conversar consigo mesmo.');
        } else {
          setSelectedContact(contactData);
          setSearchEmail('');
        }
      } else {
        alert('Usuário não encontrado.');
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !selectedContact || (!newMessage.trim())) return;

    setIsSending(true);
    try {
      let scheduledAt = null;
      if (scheduledTime) {
        scheduledAt = new Date(scheduledTime).getTime();
      }

      const msgData = {
        senderId: user.uid,
        receiverId: selectedContact.uid,
        content: newMessage.trim(),
        timestamp: Date.now(),
        scheduledAt,
        status: 'sent',
        type: 'text'
      };

      await addDoc(collection(firestore, 'messages'), msgData);
      setNewMessage('');
      setScheduledTime('');
      setShowScheduler(false);
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 absolute inset-0 z-20">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <button onClick={selectedContact ? () => setSelectedContact(null) : onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        {selectedContact ? (
          <div className="flex items-center gap-3">
            {selectedContact.photoURL ? (
              <img src={selectedContact.photoURL} alt="" className="w-10 h-10 rounded-full border border-slate-700" />
            ) : (
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                <UserIcon size={20} className="text-slate-400" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-white leading-tight">{selectedContact.displayName}</h3>
              <p className="text-xs text-slate-500">{selectedContact.email}</p>
            </div>
          </div>
        ) : (
          <h2 className="text-xl font-bold text-white">Mensagens</h2>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!selectedContact ? (
          <div className="max-w-md mx-auto w-full space-y-6">
            <div className="relative">
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Buscar amigo por e-mail..."
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
              <button 
                onClick={handleSearch}
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>

            <div className="text-center py-12">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                <MessageSquare size={40} className="text-slate-600" />
              </div>
              <p className="text-slate-500">Busque um amigo para iniciar uma conversa.</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isMe = msg.senderId === user?.uid;
              const isScheduled = msg.scheduledAt && msg.scheduledAt > msg.timestamp;
              const isFuture = msg.scheduledAt && msg.scheduledAt > Date.now();

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${
                    isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                      {isScheduled && <Clock size={10} className="text-orange-300" />}
                      <span className="text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && (
                        msg.status === 'read' ? <CheckCheck size={12} /> : <Check size={12} />
                      )}
                    </div>
                  </div>
                  {isMe && isFuture && (
                    <span className="text-[10px] text-orange-400 mt-1">
                      Agendado para: {new Date(msg.scheduledAt!).toLocaleString()}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {selectedContact && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <AnimatePresence>
            {showScheduler && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">Agendar Envio</span>
                    <button onClick={() => setShowScheduler(false)} className="text-slate-500 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-orange-500"
                  />
                  <p className="text-[10px] text-slate-500 italic">
                    A mensagem será entregue ao destinatário somente após o horário definido.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowScheduler(!showScheduler)}
              className={`p-3 rounded-xl transition-colors ${showScheduler ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              title="Agendar Mensagem"
            >
              <Calendar size={20} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {isSending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}
