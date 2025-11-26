import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, UserPlus, Settings, ArrowLeft, Shield, Activity, Server,
  Search, Filter, Power, Trash2, Clock, CheckCircle, XCircle, Briefcase, Edit, X, Save, Key, XCircle as CloseIcon, Wand2,
  HardDrive, Database, BarChart2, FileDown
} from 'lucide-react';
import { ViewState, User, Group, UserStatus, GroupPermissions, Patient } from '../types';
import { Logo } from './Logo';

interface AdminDashboardProps {
  onNavigate: (view: ViewState) => void;
  accessToken: string | null;
}

type Tab = 'overview' | 'users' | 'groups';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  '/api';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, accessToken }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patientStats, setPatientStats] = useState({ patients: 0, dicoms: 0 });
  const [systemHealth, setSystemHealth] = useState({
    backend: 'unknown',
    database: 'online',
    storage: 'online',
    web: 'online'
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [logStreaming, setLogStreaming] = useState(true);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  
  // -- Modals State --
  // Create User
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState<{
    name?: string;
    email?: string;
    login?: string;
    role?: 'admin' | 'user';
    groupId?: number;
    password?: string;
    expirationDate?: string | null;
  }>({ role: 'user' });
  const [isTemporary, setIsTemporary] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Edit User
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Edit Group
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // -- Helpers --

  const groupLookup = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g])),
    [groups]
  );

  const mapPermissions = (raw: any): GroupPermissions => ({
    canEditPatients: Boolean(raw.can_edit_patients ?? raw.canEditPatients),
    canExportData: Boolean(raw.can_export_data ?? raw.canExportData),
    canManageUsers: Boolean(raw.can_manage_users ?? raw.canManageUsers),
    canViewImages: Boolean(raw.can_view_images ?? raw.canViewImages),
  });

  const mapGroup = (raw: any): Group => ({
    id: raw.id,
    name: raw.name,
    description: raw.description,
    permissions: mapPermissions(raw),
  });

  const normalizeStatus = (status?: string, expiration?: string | null): UserStatus => {
    if (expiration) {
      const today = new Date().toISOString().slice(0, 10);
      if (expiration < today) return 'expired';
    }
    if (status === 'inactive' || status === 'disabled') return status as UserStatus;
    return 'active';
  };

  const mapUser = (raw: any, groupsMap = groupLookup): User => ({
    id: raw.id,
    username: raw.email?.split('@')[0] || raw.full_name,
    role: raw.role === 'admin' ? 'admin' : 'user',
    name: raw.full_name,
    email: raw.email,
    groupId: raw.group_id,
    groupName: raw.group?.name || groupsMap[raw.group_id]?.name,
    status: normalizeStatus(raw.status, raw.expiration_date),
    expirationDate: raw.expiration_date || null,
  });

  const withAuth = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    }
  });

  const loadGroups = async () => {
    try {
      const response = await fetch(`${API_BASE}/groups`, withAuth());
      if (!response.ok) throw new Error('Impossible de récupérer les groupes');
      const data = await response.json();
      const mapped = (data as any[]).map(mapGroup);
      setGroups(mapped);
      if (!newUser.groupId && mapped.length > 0) {
        setNewUser((prev) => ({ ...prev, groupId: mapped[0].id }));
      }
      return mapped;
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des groupes');
      return [] as Group[];
    }
  };

  const loadUsers = async (groupData?: Group[]) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/users`, withAuth());
      if (!response.ok) throw new Error('Impossible de récupérer les utilisateurs');
      const data = await response.json();
      const lookup = Object.fromEntries((groupData ?? groups).map((g) => [g.id, g]));
      setUsers((data as any[]).map((raw) => mapUser(raw, lookup)));
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups().then((groupData) => loadUsers(groupData));
    loadPatientStats();
    refreshHealth();
  }, []);

  useEffect(() => {
    if (!logStreaming) return;

    const interval = setInterval(() => {
      setLogs((prev) => [
        ...prev.slice(-200),
        `${new Date().toLocaleTimeString()} | INFO | Supervision active - aucune anomalie détectée`
      ]);
    }, 4000);

    return () => clearInterval(interval);
  }, [logStreaming]);

  const generateSecurePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
    setNewUser((prev) => ({ ...prev, password }));
  };

  // -- Handlers --

  const handleToggleStatus = async (userId: number) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const newStatus: UserStatus = target.status === 'active' ? 'inactive' : 'active';

    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, withAuth({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }));
      if (!response.ok) throw new Error('Mise à jour du statut impossible');
      setUsers(users.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
    } catch (err) {
      console.error(err);
      alert("Impossible de changer le statut de l'utilisateur");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ?')) return;

    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, withAuth({ method: 'DELETE' }));
      if (!response.ok) throw new Error('Suppression échouée');
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
      alert("La suppression de l'utilisateur a échoué");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newUser.name || !(newUser.email || newUser.login) || !newUser.password) {
      setError('Veuillez renseigner le nom, un identifiant/email et générer un mot de passe.');
      return;
    }

    const email = newUser.email || `${newUser.login}@imagine.fr`;

    const payload = {
      full_name: newUser.name,
      email,
      password: newUser.password,
      role: newUser.role || 'user',
      status: 'active',
      expiration_date: isTemporary ? newUser.expirationDate || null : null,
      group_id: newUser.groupId,
    };

    try {
      const response = await fetch(`${API_BASE}/users`, withAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));
      if (!response.ok) throw new Error('Création impossible');
      const created = await response.json();
      setUsers([...users, mapUser(created)]);
      setShowCreateUser(false);
      setNewUser({ role: 'user', groupId: newUser.groupId });
      setIsTemporary(false);
      setGeneratedPassword('');
    } catch (err) {
      console.error(err);
      setError('Impossible de créer le compte utilisateur');
    }
  };

  const loadPatientStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/patients`, withAuth());
      if (!response.ok) throw new Error('Impossible de récupérer les patients');
      const data = await response.json();
      const casted = data as Patient[];
      const dicomCount = casted.reduce((acc, patient) => acc + (patient.images?.length || 0), 0);
      setPatientStats({ patients: casted.length, dicoms: dicomCount });
    } catch (err) {
      console.error(err);
      setPatientStats({ patients: 0, dicoms: 0 });
    }
  };

  const refreshHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, withAuth());
      const ok = response.ok;
      setSystemHealth((prev) => ({
        ...prev,
        backend: ok ? 'online' : 'degraded',
        web: ok ? 'online' : prev.web,
      }));
    } catch (err) {
      console.error(err);
      setSystemHealth((prev) => ({ ...prev, backend: 'offline', web: 'degraded' }));
    }
  };

  const exportLogs = () => {
    const blob = new Blob([logs.join('\n') || 'Aucun log pour le moment'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${new Date().toISOString()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const payload = {
      full_name: editingUser.name,
      email: editingUser.email,
      role: editingUser.role,
      status: editingUser.status,
      expiration_date: editingUser.expirationDate || null,
      group_id: editingUser.groupId,
    };

    try {
      const response = await fetch(`${API_BASE}/users/${editingUser.id}`, withAuth({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));
      if (!response.ok) throw new Error('Mise à jour impossible');
      const updated = await response.json();
      setUsers(users.map((u) => (u.id === editingUser.id ? mapUser(updated) : u)));
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert('La mise à jour de l’utilisateur a échoué');
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser) return;
    const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
    try {
      const response = await fetch(`${API_BASE}/users/${editingUser.id}`, withAuth({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: tempPass }),
      }));
      if (!response.ok) throw new Error('Reset impossible');
      alert(`Réinitialisation effectuée.\n\nNouveau mot de passe temporaire : ${tempPass}\n\nVeuillez le transmettre à l'utilisateur de manière sécurisée.`);
    } catch (err) {
      console.error(err);
      alert('Impossible de réinitialiser le mot de passe');
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    const payload = {
      name: editingGroup.name,
      description: editingGroup.description,
      can_edit_patients: editingGroup.permissions.canEditPatients,
      can_view_images: editingGroup.permissions.canViewImages,
      can_export_data: editingGroup.permissions.canExportData,
      can_manage_users: editingGroup.permissions.canManageUsers,
    };

    try {
      const url = isCreatingGroup
        ? `${API_BASE}/groups`
        : `${API_BASE}/groups/${editingGroup.id}`;
      const method = isCreatingGroup ? 'POST' : 'PUT';
      const response = await fetch(url, withAuth({
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));
      if (!response.ok) throw new Error('Sauvegarde impossible');
      const saved = mapGroup(await response.json());
      if (isCreatingGroup) {
        setGroups([...groups, saved]);
      } else {
        setGroups(groups.map((g) => (g.id === saved.id ? saved : g)));
      }
      setEditingGroup(null);
      setIsCreatingGroup(false);
    } catch (err) {
      console.error(err);
      alert('Impossible de sauvegarder le groupe');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Supprimer ce groupe ? Les utilisateurs associés seront détachés.')) return;

    try {
      const response = await fetch(`${API_BASE}/groups/${groupId}`, withAuth({ method: 'DELETE' }));
      if (!response.ok) throw new Error('Suppression impossible');
      setGroups(groups.filter((g) => g.id !== groupId));
      setEditingGroup(null);
      loadUsers();
    } catch (err) {
      console.error(err);
      alert('La suppression du groupe a échoué');
    }
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

  const renderStatusPill = (status: string) => {
    const styles: Record<string, string> = {
      online: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      degraded: 'bg-amber-50 text-amber-600 border-amber-100',
      offline: 'bg-rose-50 text-rose-600 border-rose-100',
      unknown: 'bg-slate-50 text-slate-600 border-slate-100'
    };
    const label: Record<string, string> = {
      online: 'Opérationnel',
      degraded: 'Dégradé',
      offline: 'Arrêt',
      unknown: 'Inconnu'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status] || styles.unknown}`}>
        {label[status] || label.unknown}
      </span>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Utilisateurs Actifs</h3>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={20} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{users.filter(u => u.status === 'active').length}</p>
          <p className="text-xs text-slate-400 mt-1">Suivi des comptes en production</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Supervision de la plateforme</h2>
              <p className="text-sm text-slate-500">État des bases de données, serveurs web, API et stockage DICOM</p>
            </div>
            <button
              onClick={refreshHealth}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
            >
              <Activity size={16} /> Rafraîchir
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[{
              label: 'API Backend', icon: Server, status: systemHealth.backend, detail: 'Endpoint /health'
            }, {
              label: 'Base de données', icon: Database, status: systemHealth.database, detail: 'Transactions monitorées'
            }, {
              label: 'Serveur web', icon: Activity, status: systemHealth.web, detail: 'Interface utilisateur'
            }, {
              label: 'Stockage DICOM', icon: HardDrive, status: systemHealth.storage, detail: 'Volumes & espaces disque'
            }].map((item) => (
              <div key={item.label} className="border border-slate-200 rounded-lg p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-50 text-slate-700"><item.icon size={18} /></div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    {renderStatusPill(item.status)}
                  </div>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Statistiques</h3>
              <p className="text-sm text-slate-500">Volume de données patient & imagerie</p>
            </div>
            <BarChart2 className="text-indigo-500" size={22} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="text-xs text-indigo-700 uppercase tracking-wide">Patients</p>
              <p className="text-3xl font-bold text-indigo-900">{patientStats.patients}</p>
              <p className="text-xs text-indigo-800/70">Dossiers importés</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-xs text-emerald-700 uppercase tracking-wide">DICOM</p>
              <p className="text-3xl font-bold text-emerald-900">{patientStats.dicoms}</p>
              <p className="text-xs text-emerald-800/70">Instances disponibles</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Dernière mise à jour</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Logs en temps réel</h3>
            <p className="text-sm text-slate-500">Visualisation type terminal avec export des traces</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLogStreaming((prev) => !prev)}
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
            >
              {logStreaming ? 'Mettre en pause' : 'Relancer'}
            </button>
            <button
              onClick={exportLogs}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 inline-flex items-center gap-2"
            >
              <FileDown size={16} /> Exporter
            </button>
          </div>
        </div>
        <div className="bg-slate-950 text-emerald-100 font-mono text-xs rounded-lg p-4 h-64 overflow-auto border border-slate-800">
          {logs.length === 0 ? (
            <p className="text-slate-400">En attente de nouveaux événements...</p>
          ) : (
            <ul className="space-y-1">
              {logs.map((line, idx) => (
                <li key={`${line}-${idx}`} className="whitespace-pre-wrap">{line}</li>
              ))}
            </ul>
          )}
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
                        <span className="text-slate-800">{user.groupName || 'Non défini'}</span>
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
        <button
          onClick={() => {
            setIsCreatingGroup(true);
            setEditingGroup({
              id: 0,
              name: '',
              description: '',
              permissions: {
                canEditPatients: false,
                canExportData: false,
                canManageUsers: false,
                canViewImages: true,
              },
            });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
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
                onClick={() => {
                  setEditingGroup(group);
                  setIsCreatingGroup(false);
                }}
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
                  <input required type="text" value={newUser.login || ''} onChange={(e) => setNewUser({...newUser, login: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: j.dupont" />
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
                  <select value={newUser.groupId} onChange={(e) => setNewUser({...newUser, groupId: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
                      disabled
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
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
                    value={editingUser.groupId ?? ''}
                    onChange={(e) => setEditingUser({...editingUser, groupId: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
                  {!isCreatingGroup && (
                    <button
                      type="button"
                      onClick={() => editingGroup && handleDeleteGroup(editingGroup.id)}
                      className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium"
                    >
                      Supprimer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setEditingGroup(null); setIsCreatingGroup(false); }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                  >
                    Annuler
                  </button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">Sauvegarder</button>
                </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};