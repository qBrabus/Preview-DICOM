import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Users, UserPlus, Settings, ArrowLeft, Shield, Activity, 
  Search, Filter, Power, Trash2, Clock, CheckCircle, XCircle, Briefcase, Edit, X, Save, Key, XCircle as CloseIcon, Wand2
} from 'lucide-react';
import { ViewState, User, Group } from '../types';
import { ADMIN_STATS_DATA, MOCK_USERS, MOCK_GROUPS } from '../constants';
import { Logo } from './Logo';

interface AdminDashboardProps {
  onNavigate: (view: ViewState) => void;
}

type Tab = 'overview' | 'users' | 'groups';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  
  // -- Modals State --
  // Create User
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'user', status: 'active' });
  const [isTemporary, setIsTemporary] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Edit User
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Edit Group
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // -- Helpers --

  const generateSecurePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
  };

  // -- Handlers --

  const handleToggleStatus = (userId: string) => {
    setUsers(users.map(u => {
      if (u.id === userId) {
        const newStatus = u.status === 'active' ? 'inactive' : 'active';
        return { ...u, status: newStatus };
      }
      return u;
    }));
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ?')) {
      const updatedList = users.filter(u => u.id !== userId);
      setUsers(updatedList);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `u${Date.now()}`;
    const userToAdd: User = {
      id,
      username: newUser.username || `user.${id}`,
      name: newUser.name || 'Nouvel Utilisateur',
      email: newUser.email || '',
      role: newUser.role || 'user',
      group: newUser.group || 'Internes / Stagiaires',
      status: 'active',
      expirationDate: isTemporary ? newUser.expirationDate : undefined
    };
    setUsers([...users, userToAdd]);
    setShowCreateUser(false);
    setNewUser({ role: 'user', status: 'active' });
    setIsTemporary(false);
    setGeneratedPassword('');
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
    setEditingUser(null);
  };

  const handleResetPassword = () => {
    const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
    alert(`Réinitialisation effectuée.\n\nNouveau mot de passe temporaire : ${tempPass}\n\nVeuillez le transmettre à l'utilisateur de manière sécurisée.`);
  };

  const handleUpdateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    setGroups(groups.map(g => g.id === editingGroup.id ? editingGroup : g));
    setEditingGroup(null);
  };

  const toggleGroupPermission = (perm: keyof Group['permissions']) => {
    if (!editingGroup) return;
    setEditingGroup({
      ...editingGroup,
      permissions: {
        ...editingGroup.permissions,
        [perm]: !editingGroup.permissions[perm]
      }
    });
  };

  // -- Filtering Logic --
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = filterRole === 'all' || u.role === filterRole;

    return matchesSearch && matchesRole;
  });

  // -- Renderers --

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 font-medium text-sm">Utilisateurs Actifs</h3>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={20} /></div>
            </div>
            <p className="text-3xl font-bold text-slate-800">{users.filter(u => u.status === 'active').length}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Activity size={12} /> Système opérationnel</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 font-medium text-sm">Comptes Temporaires</h3>
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Clock size={20} /></div>
            </div>
            <p className="text-3xl font-bold text-slate-800">{users.filter(u => u.expirationDate).length}</p>
            <p className="text-xs text-slate-400 mt-1">Accès à durée limitée</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 font-medium text-sm">Groupes</h3>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Shield size={20} /></div>
            </div>
            <p className="text-3xl font-bold text-slate-800">{groups.length}</p>
            <p className="text-xs text-slate-400 mt-1">Politiques de sécurité</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Activité de la Plateforme</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ADMIN_STATS_DATA} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0' }} cursor={{fill: '#F1F5F9'}} />
                  <Bar dataKey="consultations" name="Consultations" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="nouveaux" name="Nouveaux Patients" fill="#A78BFA" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <input 
            type="text" 
            placeholder="Rechercher un utilisateur..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
          />
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => setFilterRole(prev => prev === 'all' ? 'admin' : (prev === 'admin' ? 'user' : 'all'))}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 min-w-[120px]"
          >
            <Filter size={16} /> 
            {filterRole === 'all' ? 'Tous' : (filterRole === 'admin' ? 'Admins' : 'Utilisateurs')}
          </button>
          <button onClick={() => setShowCreateUser(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 w-full md:w-auto">
            <UserPlus size={16} /> Créer Utilisateur
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium">Utilisateur</th>
              <th className="px-6 py-4 font-medium">Groupe / Rôle</th>
              <th className="px-6 py-4 font-medium">Statut</th>
              <th className="px-6 py-4 font-medium">Expiration</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Aucun utilisateur trouvé.</td>
                </tr>
            ) : (
                filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                        {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                        <p className="font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email || `@${user.username}`}</p>
                        </div>
                    </div>
                    </td>
                    <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="text-slate-800">{user.group}</span>
                        <span className="text-xs text-slate-500 capitalize">{user.role}</span>
                    </div>
                    </td>
                    <td className="px-6 py-4">
                    {user.status === 'active' && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} /> Actif</span>}
                    {user.status === 'inactive' && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"><Power size={12} /> Désactivé</span>}
                    {user.status === 'expired' && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><Clock size={12} /> Expiré</span>}
                    </td>
                    <td className="px-6 py-4">
                    {user.expirationDate ? (
                        <span className={`text-xs ${new Date(user.expirationDate) < new Date() ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                        {user.expirationDate}
                        </span>
                    ) : (
                        <span className="text-slate-400">-</span>
                    )}
                    </td>
                    <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button 
                        onClick={() => setEditingUser(user)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Modifier"
                        >
                        <Edit size={18} />
                        </button>
                        <button 
                        onClick={() => handleToggleStatus(user.id)}
                        className={`p-2 rounded-lg transition-colors ${user.status === 'active' ? 'text-slate-400 hover:text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}
                        title={user.status === 'active' ? 'Désactiver' : 'Activer'}
                        >
                        <Power size={18} />
                        </button>
                        <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Supprimer"
                        >
                        <Trash2 size={18} />
                        </button>
                    </div>
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGroups = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800">Groupes & Droits d'accès</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Shield size={16} /> Créer un Groupe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <div key={group.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                <Briefcase size={24} />
              </div>
              <button 
                onClick={() => setEditingGroup(group)}
                className="text-slate-400 hover:text-indigo-600"
              >
                <Settings size={18} />
              </button>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{group.name}</h3>
            <p className="text-sm text-slate-500 mb-6 h-10 line-clamp-2">{group.description}</p>
            
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Permissions</p>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {group.permissions.canEditPatients ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-slate-300" />}
                <span>Édition Dossiers</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {group.permissions.canViewImages ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-slate-300" />}
                <span>Voir Imagerie</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {group.permissions.canExportData ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-slate-300" />}
                <span>Export Données</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {group.permissions.canManageUsers ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-slate-300" />}
                <span>Gestion Admin</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 text-white h-16 flex items-center justify-between px-6 shadow-md z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate(ViewState.USER_DASHBOARD)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="h-6 w-px bg-slate-700 mx-2"></div>
          <Logo className="text-white" iconSize={24} />
          <span className="ml-2 px-2 py-1 bg-indigo-500/20 border border-indigo-500/50 rounded text-xs font-medium text-indigo-300 tracking-wide uppercase">Admin</span>
        </div>
        <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">Super Admin</p>
                <p className="text-xs text-slate-400">institut.imagine</p>
            </div>
            <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center font-bold">A</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Tabs */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
          <div className="p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Menu Principal</h2>
            <nav className="space-y-1">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Activity size={18} /> Vue d'ensemble
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Users size={18} /> Utilisateurs
              </button>
              <button 
                onClick={() => setActiveTab('groups')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'groups' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Shield size={18} /> Groupes & Droits
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">
                        {activeTab === 'overview' && "Tableau de Bord"}
                        {activeTab === 'users' && "Gestion des Utilisateurs"}
                        {activeTab === 'groups' && "Configuration des Groupes"}
                    </h1>
                    <p className="text-slate-500 mt-1">Gérez les accès et la sécurité de l'institut.</p>
                </div>

                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'users' && renderUsers()}
                {activeTab === 'groups' && renderGroups()}
            </div>
        </main>
      </div>

      {/* --- MODALS --- */}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Nouvel Utilisateur</h3>
              <button onClick={() => setShowCreateUser(false)} className="text-slate-400 hover:text-slate-600"><CloseIcon size={24} /></button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Nom Complet</label>
                  <input required type="text" onChange={(e) => setNewUser({...newUser, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Jean Dupont" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Identifiant</label>
                  <input required type="text" onChange={(e) => setNewUser({...newUser, username: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: j.dupont" />
                </div>
              </div>

               <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input type="email" onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: jean.dupont@imagine.fr" />
               </div>

               {/* Password Generation */}
               <div className="space-y-1 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium text-indigo-900">Mot de passe initial</label>
                    <button type="button" onClick={generateSecurePassword} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold">
                        <Wand2 size={12}/> Générer
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input 
                        type="text" 
                        readOnly 
                        value={generatedPassword} 
                        placeholder="Cliquez sur générer"
                        className="w-full px-3 py-2 border border-indigo-200 rounded-lg bg-white text-slate-700 font-mono text-sm" 
                    />
                  </div>
                  {generatedPassword && <p className="text-[10px] text-indigo-500 mt-1">Copiez ce mot de passe et transmettez-le à l'utilisateur.</p>}
               </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Groupe</label>
                  <select onChange={(e) => setNewUser({...newUser, group: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Rôle Système</label>
                  <select onChange={(e) => setNewUser({...newUser, role: e.target.value as any})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <input 
                        type="checkbox" 
                        id="tempAccess" 
                        checked={isTemporary} 
                        onChange={(e) => setIsTemporary(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
                    />
                    <label htmlFor="tempAccess" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Clock size={16} className="text-orange-500" /> Accès Temporaire
                    </label>
                </div>
                
                {isTemporary && (
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                        <label className="text-sm font-medium text-orange-800 mb-1 block">Date d'expiration</label>
                        <input 
                            type="date" 
                            required={isTemporary}
                            onChange={(e) => setNewUser({...newUser, expirationDate: e.target.value})}
                            className="w-full px-3 py-2 border border-orange-200 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                        />
                        <p className="text-xs text-orange-600 mt-2">L'utilisateur passera automatiquement en statut "Désactivé" après cette date.</p>
                    </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateUser(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Annuler</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">Créer le compte</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Modifier Utilisateur</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600"><CloseIcon size={24} /></button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Nom Complet</label>
                    <input 
                      type="text" 
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Identifiant</label>
                    <input 
                      type="text" 
                      value={editingUser.username}
                      onChange={(e) => setEditingUser({...editingUser, username: e.target.value})} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                 </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input 
                  type="email" 
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>

               <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Groupe</label>
                  <select 
                    value={editingUser.group}
                    onChange={(e) => setEditingUser({...editingUser, group: e.target.value})} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Rôle</label>
                  <select 
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                 <button type="button" onClick={handleResetPassword} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                   <Key size={14} /> Réinitialiser mot de passe
                 </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Annuler</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Configurer le Groupe</h3>
              <button onClick={() => setEditingGroup(null)} className="text-slate-400 hover:text-slate-600"><CloseIcon size={24} /></button>
            </div>
            <form onSubmit={handleUpdateGroup} className="p-6 space-y-5">
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Nom du Groupe</label>
                <input 
                  type="text" 
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({...editingGroup, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea 
                  value={editingGroup.description}
                  onChange={(e) => setEditingGroup({...editingGroup, description: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none" 
                />
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Permissions</p>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-700">Éditer les dossiers patients</span>
                  <button type="button" onClick={() => toggleGroupPermission('canEditPatients')}>
                    {editingGroup.permissions.canEditPatients ? <CheckCircle className="text-green-500" /> : <XCircle className="text-slate-300" />}
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-700">Voir l'imagerie médicale</span>
                  <button type="button" onClick={() => toggleGroupPermission('canViewImages')}>
                    {editingGroup.permissions.canViewImages ? <CheckCircle className="text-green-500" /> : <XCircle className="text-slate-300" />}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-700">Exporter les données</span>
                  <button type="button" onClick={() => toggleGroupPermission('canExportData')}>
                    {editingGroup.permissions.canExportData ? <CheckCircle className="text-green-500" /> : <XCircle className="text-slate-300" />}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-700">Accès Administration</span>
                  <button type="button" onClick={() => toggleGroupPermission('canManageUsers')}>
                    {editingGroup.permissions.canManageUsers ? <CheckCircle className="text-green-500" /> : <XCircle className="text-slate-300" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditingGroup(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Annuler</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">Sauvegarder</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};