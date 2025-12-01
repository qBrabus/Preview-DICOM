import React, { useState } from 'react';
import { X, Save, User, Mail, Key } from 'lucide-react';
import { User as UserType } from '../types';

const API_BASE =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE ||
    '/api';

interface ProfileSettingsModalProps {
    user: UserType;
    accessToken: string | null;
    csrfToken: string | null;
    onClose: () => void;
    onUpdate: (updatedUser: UserType) => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
    user,
    accessToken,
    csrfToken,
    onClose,
    onUpdate
}) => {
    const [fullName, setFullName] = useState(user.name);
    const [email, setEmail] = useState(user.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!currentPassword) {
            setError('Le mot de passe actuel est requis pour effectuer des modifications');
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            setError('Les nouveaux mots de passe ne correspondent pas');
            return;
        }

        if (newPassword && newPassword.length < 8) {
            setError('Le nouveau mot de passe doit contenir au moins 8 caractères');
            return;
        }

        setIsLoading(true);

        try {
            const payload: any = {
                current_password: currentPassword,
            };

            if (fullName !== user.name) {
                payload.full_name = fullName;
            }
            if (email !== user.email) {
                payload.email = email;
            }
            if (newPassword) {
                payload.new_password = newPassword;
            }

            const response = await fetch(`${API_BASE}/users/me/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({ detail: 'Erreur lors de la mise à jour' }));
                throw new Error(data.detail || 'Erreur lors de la mise à jour du profil');
            }

            const updatedUser = await response.json();
            setSuccess('Profil mis à jour avec succès');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            // Update parent component
            onUpdate({
                ...user,
                name: updatedUser.full_name,
                email: updatedUser.email,
            });

            // Close modal after a short delay
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Erreur lors de la mise à jour du profil');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <User size={20} className="text-indigo-600" />
                        Paramètres du Profil
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Full Name */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <User size={16} />
                            Nom Complet
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Nom complet"
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Mail size={16} />
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="email@example.com"
                        />
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200 pt-4">
                        <p className="text-xs text-slate-500 mb-3">Changement de mot de passe (optionnel)</p>
                    </div>

                    {/* Current Password */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Key size={16} />
                            Mot de passe actuel *
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Requis pour toute modification"
                            required
                        />
                    </div>

                    {/* New Password */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">
                            Nouveau mot de passe
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Min. 8 caractères"
                        />
                    </div>

                    {/* Confirm Password */}
                    {newPassword && (
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">
                                Confirmer le nouveau mot de passe
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Répétez le nouveau mot de passe"
                            />
                        </div>
                    )}

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg">
                            {success}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                            disabled={isLoading}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            <Save size={16} />
                            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
