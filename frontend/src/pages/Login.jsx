import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await auth.login(email, password);
            if (response.data.access_token) {
                localStorage.setItem('token', response.data.access_token);
                navigate('/dashboard');
            }
        } catch (err) {
            let errorMessage = 'An error occurred during login';
            if (err.response?.data?.detail) {
                if (typeof err.response.data.detail === 'string') {
                    errorMessage = err.response.data.detail;
                } else if (Array.isArray(err.response.data.detail)) {
                    // Handle FastAPI 422 validation errors
                    errorMessage = err.response.data.detail.map(e => e.msg).join(', ');
                }
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tw-app">
            <div className="tw-auth-card">
                <img src="/logo.png" alt="Chalkboard" className="tw-logo" />
                <p>Welcome back! Please login to your account.</p>

                {error && <div className="tw-alert error">{error}</div>}

                <form onSubmit={handleSubmit}>
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
                            placeholder="••••••••"
                        />
                    </div>

                    <button type="submit" className="tw-btn" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
