import { useState } from 'react';
import api from '../api';

export default function AdminInviteForm() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            await api.post('/auth/invites', { email });
            setStatus({ type: 'success', message: `Invitation successfully sent to ${email}` });
            setEmail('');
        } catch (err) {
            setStatus({
                type: 'error',
                message: err.response?.data?.detail || 'Failed to send invitation.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tw-admin-card">
            <h3>Admin Tools: Send Invite</h3>
            <p>Generate a secure registration token and email it to a new team member.</p>

            {status.message && (
                <div className={`tw-alert ${status.type}`}>
                    {status.message}
                </div>
            )}

            <form onSubmit={handleInvite} className="tw-inline-form">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    required
                    className="tw-input"
                />
                <button type="submit" disabled={loading} className="tw-btn">
                    {loading ? 'Sending...' : 'Send Invite'}
                </button>
            </form>
        </div>
    );
}
