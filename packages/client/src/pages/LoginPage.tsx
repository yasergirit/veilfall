import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store.js';
import type { Faction } from '@veilfall/shared';
import { FACTION_CONFIGS } from '@veilfall/shared';

const factions = Object.values(FACTION_CONFIGS);

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [faction, setFaction] = useState<Faction>('ironveil');
  const [settlementName, setSettlementName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register'
        ? { username, email, password, faction, settlementName }
        : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.details
          ? data.details.join('\n')
          : data.error || 'Request failed';
        throw new Error(msg);
      }

      login(data.player, data.token, data.refreshToken);
      navigate('/game');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #1A2744 50%, #0a0e1a 100%)' }}>
      <div className="w-full max-w-md p-8 rounded-lg border border-[var(--ruin-grey)]/30" style={{ background: 'rgba(26, 39, 68, 0.8)', backdropFilter: 'blur(10px)' }}>
        {/* Title */}
        <h1 className="text-3xl text-center mb-2 tracking-wider">VEILFALL</h1>
        <p className="text-center text-[var(--parchment-dim)] text-sm mb-8">Echoes of the Sky Rupture</p>

        {/* Mode Toggle */}
        <div className="flex mb-6 border border-[var(--ruin-grey)]/30 rounded overflow-hidden">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-[var(--aether-violet)] text-white' : 'text-[var(--parchment-dim)] hover:text-white'}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-[var(--aether-violet)] text-white' : 'text-[var(--parchment-dim)] hover:text-white'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Commander Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/40 text-[var(--parchment)] placeholder-[var(--ruin-grey)] focus:border-[var(--aether-violet)] focus:outline-none transition-colors"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/40 text-[var(--parchment)] placeholder-[var(--ruin-grey)] focus:border-[var(--aether-violet)] focus:outline-none transition-colors"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/40 text-[var(--parchment)] placeholder-[var(--ruin-grey)] focus:border-[var(--aether-violet)] focus:outline-none transition-colors"
          />

          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="Settlement Name"
                value={settlementName}
                onChange={(e) => setSettlementName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/40 text-[var(--parchment)] placeholder-[var(--ruin-grey)] focus:border-[var(--aether-violet)] focus:outline-none transition-colors"
              />

              {/* Faction Selector */}
              <div>
                <p className="text-sm text-[var(--parchment-dim)] mb-2">Choose your faction:</p>
                <div className="grid grid-cols-2 gap-2">
                  {factions.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFaction(f.id)}
                      className={`p-3 rounded border text-left transition-all ${
                        faction === f.id
                          ? 'border-[var(--aether-violet)] bg-[var(--aether-violet)]/10'
                          : 'border-[var(--ruin-grey)]/30 hover:border-[var(--ruin-grey)]'
                      }`}
                    >
                      <span
                        className="block w-3 h-3 rounded-full mb-1"
                        style={{ background: f.color }}
                      />
                      <span className="text-sm font-medium" style={{ fontFamily: 'Cinzel, serif' }}>
                        {f.name.replace('The ', '')}
                      </span>
                      <span className="block text-xs text-[var(--ruin-grey)] mt-1 leading-tight">
                        {f.description.split('.')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-red-400 text-sm whitespace-pre-line">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, var(--aether-violet), var(--aether-glow))' }}
          >
            {mode === 'register' ? 'Begin Your Legacy' : 'Enter Aetherra'}
          </button>
        </form>
      </div>
    </div>
  );
}
