import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { auth } from '../api';

export default function Registration() {
    const [searchParams] = useSearchParams();
    const [token, setToken] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setError('No invitation token found in URL.');
        }
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) {
            setError('Cannot register without an invite token');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await auth.register(email, password, token);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.detail || 'An error occurred during registration');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="tw-app">
                <div className="tw-auth-card">
                    <h1>Registration Successful!</h1>
                    <p>You can now login to your account.</p>
                    <div className="tw-alert success">Redirecting to login...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="tw-app">
            <div className="tw-auth-card">
                <img src="/logo.png" alt="Chalkboard" className="tw-logo" />
                <p>Complete your registration below.</p>

                {error && <div className="tw-alert error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {token && (
                        <div className="tw-alert success" style={{ marginBottom: '1rem' }}>
                            Invite token recognized!
                        </div>
                    )}

                    <div className="tw-form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className="tw-form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Create a strong password"
                            minLength={8}
                        />
                    </div>

                    <button type="submit" className="tw-btn" disabled={loading || !token}>
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>
            </div>
        </div>
    );
}
