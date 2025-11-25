import React, { useState } from 'react';
import { Logo } from './Logo';
import { User, ViewState } from '../types';
import { X, Send, Mail } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  onNavigate: (view: ViewState) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Request Access Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    firstName: '',
    lastName: '',
    profession: '',
    reason: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    // Mock authentication logic
    if (username === 'admin' && password === 'admin') {
      onLogin({ id: 'u1', username: 'admin', role: 'admin', name: 'Dr. Administrateur' });
    } else {
      // Default to user role for any other non-empty credentials
      onLogin({ id: 'u2', username: 'user', role: 'user', name: 'Dr. Martin' });
    }
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const subject = `Demande d'accès Portail Imagine - ${requestForm.lastName} ${requestForm.firstName}`;
    const body = `Bonjour,

Je souhaite demander un accès au portail médical de l'Institut Imagine.

Informations :
- Nom : ${requestForm.lastName}
- Prénom : ${requestForm.firstName}
- Profession : ${requestForm.profession}

Motif de la demande :
${requestForm.reason}

Cordialement.`;

    // Open mail client
    window.location.href = `mailto:quentin.ladane@institutimagine.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    setShowRequestModal(false);
    alert("Votre client de messagerie a été ouvert pour envoyer la demande.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-8 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>

        <div className="flex flex-col items-center mb-10">
          <Logo className="mb-6" iconSize={40} />
          <h2 className="text-2xl font-semibold text-slate-800">Portail Médical</h2>
          <p className="text-slate-500 text-sm mt-1">Connectez-vous pour accéder aux dossiers</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 uppercase tracking-wide">Identifiant</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
              placeholder="Ex: dr.martin"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 uppercase tracking-wide">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95"
            >
              Connexion
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <button 
            onClick={() => setShowRequestModal(true)}
            className="w-full text-indigo-600 hover:text-indigo-800 text-sm font-medium border border-indigo-200 hover:border-indigo-300 rounded-lg py-2 transition-colors"
          >
            Demander un accès
          </button>
        </div>
      </div>

      {/* Request Access Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Mail size={20} className="text-indigo-600"/> Demande d'accès
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nom</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={requestForm.lastName}
                    onChange={(e) => setRequestForm({...requestForm, lastName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Prénom</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={requestForm.firstName}
                    onChange={(e) => setRequestForm({...requestForm, firstName: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Profession / Poste</label>
                <input 
                  required 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ex: Médecin Chercheur, Interne..."
                  value={requestForm.profession}
                  onChange={(e) => setRequestForm({...requestForm, profession: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Motif de la demande</label>
                <textarea 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                  placeholder="Décrivez brièvement pourquoi vous avez besoin d'accès..."
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})}
                />
              </div>

              <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 border border-slate-200">
                Cette action va ouvrir votre client mail pour envoyer une demande à <strong>quentin.ladane@institutimagine.org</strong>.
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                  <Send size={16} /> Envoyer la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};