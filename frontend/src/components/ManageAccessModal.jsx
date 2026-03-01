import React, { useState, useEffect } from 'react';
import { X, UserPlus, Search, Shield, Mail, Trash2, CheckCircle2, User } from 'lucide-react';
import api from '../api';

export default function ManageAccessModal({ isOpen, onClose, boardId }) {
    const [email, setEmail] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        if (isOpen && boardId) {
            fetchPermissions();
            setStatus(null);
            setEmail('');
            setSearchResults([]);
        }
    }, [isOpen, boardId]);

    const fetchPermissions = async () => {
        try {
            const res = await api.get(`/boards/${boardId}/permissions`);
            setPermissions(res.data);
        } catch (err) {
            console.error("Failed to fetch permissions", err);
        }
    };

    const handleSearch = async (query) => {
        setEmail(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await api.get(`/users/search?q=${query}`);
            setSearchResults(res.data);
        } catch (err) {
            console.error("Search failed", err);
        }
    };

    const handleShare = async (userEmail) => {
        setLoading(true);
        setStatus(null);
        try {
            const res = await api.post(`/boards/${boardId}/share`, { email: userEmail, access_level: 'editor' });
            setStatus({ type: 'success', message: res.data.message });
            setEmail('');
            setSearchResults([]);
            fetchPermissions();
            // Clear success message after 3 seconds
            setTimeout(() => setStatus(null), 3000);
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.detail || "Sharing failed" });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="tw-modal-overlay" onClick={onClose}>
            <div className="tw-modal-content tw-modal-content-modern tw-max-w-md" onClick={e => e.stopPropagation()}>
                <div className="tw-modal-header">
                    <div className="tw-flex tw-items-center tw-gap-3">
                        <div className="tw-p-2 tw-rounded-lg tw-bg-blue-500/10">
                            <Shield className="tw-text-blue-400" size={20} />
                        </div>
                        <h2 className="tw-text-xl tw-font-bold tw-text-white">Manage Access</h2>
                    </div>
                    <button onClick={onClose} className="tw-modal-close" title="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="tw-space-y-6 tw-p-5">
                    {/* Add User Section */}
                    <div className="tw-space-y-3">
                        <label className="tw-text-sm tw-font-medium tw-text-gray-400">Add person or group</label>
                        <div className="tw-relative">
                            <input
                                type="email"
                                placeholder="Enter email address..."
                                className="tw-input tw-pl-10 tw-w-full"
                                value={email}
                                onChange={(e) => handleSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && email && handleShare(email)}
                            />
                            <Mail className="tw-absolute tw-left-3 tw-top-50 tw-translate-y-n50 tw-text-gray-500" size={18} />
                            <button
                                onClick={() => handleShare(email)}
                                disabled={!email || loading}
                                className="tw-btn-primary tw-absolute tw-right-2 tw-top-50 tw-translate-y-n50 tw-px-3 tw-py-1 tw-text-sm"
                            >
                                {loading ? '...' : 'Add'}
                            </button>
                        </div>

                        {/* Search Suggestions */}
                        {searchResults.length > 0 && (
                            <div className="tw-bg-gray-800 tw-rounded-lg tw-border tw-border-gray-700 tw-shadow-2xl tw-overflow-hidden tw-mt-1">
                                {searchResults.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleShare(user.email)}
                                        className="tw-w-full tw-text-left tw-px-4 tw-py-3 tw-hover:bg-gray-700/50 tw-transition-colors tw-flex tw-items-center tw-gap-3 tw-border-b tw-border-gray-700 last:tw-border-0"
                                    >
                                        <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-gradient-to-br tw-from-blue-500 tw-to-indigo-600 tw-flex tw-items-center tw-justify-center tw-text-white tw-font-bold tw-text-xs">
                                            {user.email[0].toUpperCase()}
                                        </div>
                                        <div className="tw-flex tw-flex-col">
                                            <span className="tw-text-sm tw-font-medium tw-text-white">{user.display_name || user.email.split('@')[0]}</span>
                                            <span className="tw-text-xs tw-text-gray-400">{user.email}</span>
                                        </div>
                                        <UserPlus size={16} className="tw-ml-auto tw-text-gray-500" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {status && (
                            <div className={`tw-p-3 tw-rounded-lg tw-flex tw-items-center tw-gap-2 tw-text-sm tw-animate-fadeIn ${status.type === 'success' ? 'tw-bg-green-500/10 tw-text-green-400' : 'tw-bg-red-500/10 tw-text-red-400'
                                }`}>
                                {status.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
                                {status.message}
                            </div>
                        )}
                    </div>

                    {/* Permissions List */}
                    <div className="tw-space-y-3">
                        <label className="tw-text-sm tw-font-medium tw-text-gray-400">People with access</label>
                        <div className="tw-bg-gray-900/40 tw-rounded-xl tw-border tw-border-white/5 tw-overflow-hidden">
                            {permissions.length === 0 ? (
                                <div className="tw-p-4 tw-text-center tw-text-gray-500 tw-text-sm italic">
                                    No one else has access yet.
                                </div>
                            ) : (
                                permissions.map(perm => (
                                    <div key={perm.user_id} className="tw-flex tw-items-center tw-justify-between tw-p-3 tw-hover:bg-white/5 tw-transition-colors tw-border-b tw-border-white/5 last:tw-border-0">
                                        <div className="tw-flex tw-items-center tw-gap-3">
                                            <div className="tw-w-9 tw-h-9 tw-rounded-full tw-bg-gray-800 tw-border tw-border-white/10 tw-flex tw-items-center tw-justify-center tw-text-gray-300 tw-text-xs">
                                                {perm.user_email ? perm.user_email[0].toUpperCase() : <User size={14} />}
                                            </div>
                                            <div className="tw-flex tw-flex-col">
                                                <span className="tw-text-sm tw-font-medium tw-text-white">{perm.user_email}</span>
                                                <div className="tw-flex tw-items-center tw-gap-1.5">
                                                    <span className={`tw-w-1.5 tw-h-1.5 tw-rounded-full ${perm.access_level === 'owner' ? 'tw-bg-purple-400' : 'tw-bg-blue-400'}`}></span>
                                                    <span className="tw-text-xs tw-text-gray-500 tw-capitalize">{perm.access_level}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="tw-modal-footer tw-modal-actions">
                    <button onClick={onClose} className="btn-primary">Done</button>
                </div>
            </div>
        </div>
    );
}
