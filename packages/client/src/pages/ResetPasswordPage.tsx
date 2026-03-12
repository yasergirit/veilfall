import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Invalid reset link');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #1A2744 50%, #0a0e1a 100%)' }}>
        <div className="w-full max-w-md p-8 rounded-lg border border-[var(--ruin-grey)]/30 text-center" style={{ background: 'rgba(26, 39, 68, 0.8)', backdropFilter: 'blur(10px)' }}>
          <h1 className="text-3xl mb-2 tracking-wider">VEILFALL</h1>
          <p className="text-red-400 mb-4">Invalid or missing reset token</p>
          <button
            onClick={() => navigate('/login')}
            className="text-[var(--aether-glow)] hover:text-white transition-colors text-sm"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #1A2744 50%, #0a0e1a 100%)' }}>
      <div className="w-full max-w-md p-8 rounded-lg border border-[var(--ruin-grey)]/30" style={{ background: 'rgba(26, 39, 68, 0.8)', backdropFilter: 'blur(10px)' }}>
        <h1 className="text-3xl text-center mb-2 tracking-wider">VEILFALL</h1>
        <p className="text-center text-[var(--parchment-dim)] text-sm mb-8">Echoes of the Sky Rupture</p>

        {success ? (
          <div className="text-center space-y-4">
            <p className="text-green-400">Password has been reset successfully!</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, var(--aether-violet), var(--aether-glow))' }}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg text-center mb-6">Set New Password</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="New Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/40 text-[var(--parchment)] placeholder-[var(--ruin-grey)] focus:border-[var(--aether-violet)] focus:outline-none transition-colors"
              />

              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/40 text-[var(--parchment)] placeholder-[var(--ruin-grey)] focus:border-[var(--aether-violet)] focus:outline-none transition-colors"
              />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--aether-violet), var(--aether-glow))' }}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2 text-sm text-[var(--parchment-dim)] hover:text-white transition-colors"
              >
                Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
