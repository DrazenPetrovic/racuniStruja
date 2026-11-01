import { useState } from 'react';
import { Zap } from 'lucide-react';
import { signIn } from '../utils/api';
import { theme } from '../theme';

interface LoginPanelProps {
  onLoginSuccess: () => void;
}

export function LoginPanel({ onLoginSuccess }: LoginPanelProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(username.trim(), password.trim());
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri prijavi');
      setLoading(false);
    }
  };

  const poljeKlase =
    'w-full px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#785E9E] transition';

  return (
    <div className="min-h-screen login-soft-bg flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-6 py-7">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ backgroundColor: theme.primary }}
        >
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-center text-2xl font-bold text-gray-800 mb-5">Računi Struja</h1>

        <form onSubmit={handleLogin} autoComplete="on" className="space-y-3">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Korisničko ime
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={poljeKlase}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Lozinka
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={poljeKlase}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-semibold py-3 text-lg rounded-xl transition-all disabled:opacity-50 shadow-lg active:opacity-80"
            style={{ backgroundColor: theme.primary }}
          >
            {loading ? 'Prijava u toku...' : 'Prijava'}
          </button>
        </form>
      </div>
    </div>
  );
}
