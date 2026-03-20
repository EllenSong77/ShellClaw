import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/client';
import type { AccessConfig } from '../types';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessConfig, setAccessConfig] = useState<AccessConfig | null>(null);

  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);

  useEffect(() => {
    api.getAccessConfig().then(setAccessConfig).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (accessConfig?.activation_required && !activationCode) {
      setError('Activation code is required');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, activationCode);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const isActivationRequired = accessConfig?.activation_required ?? false;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" showText={true} />
          <p className="text-[#6B6B6B] mt-2 text-sm">Terminal AI Assistant</p>
        </div>

        {/* Banner */}
        {isActivationRequired ? (
          <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-md px-4 py-3 mb-4 text-center">
            <p className="text-[#22D3EE] text-sm font-medium">Alpha Access Only</p>
            <p className="text-[#6B6B6B] text-xs mt-0.5">Activation code required to register</p>
          </div>
        ) : (
          <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-md px-4 py-3 mb-4 text-center">
            <p className="text-[#22D3EE] text-sm font-medium">Internal Alpha Test</p>
            <p className="text-[#6B6B6B] text-xs mt-0.5">Early access for invited users</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#141414] rounded-lg p-6 border border-[#2A2A2A]">
          <h2 className="text-lg font-semibold mb-5">Create account</h2>

          {error && (
            <div className="bg-[#F87171]/10 border border-[#F87171]/20 text-[#F87171] px-4 py-2.5 rounded-md mb-4 text-sm font-mono">
              <span className="text-[#F87171]/60 mr-2">[error]</span>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#A1A1A1] mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-[#FAFAFA] placeholder-[#4A4A4A] focus:outline-none focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE]/30 transition-all text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[#A1A1A1] mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-[#FAFAFA] placeholder-[#4A4A4A] focus:outline-none focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE]/30 transition-all text-sm"
                placeholder="Min. 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-[#A1A1A1] mb-1.5 uppercase tracking-wide">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-[#FAFAFA] placeholder-[#4A4A4A] focus:outline-none focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE]/30 transition-all text-sm"
                placeholder="Confirm password"
              />
            </div>

            <div>
              <label htmlFor="activationCode" className="block text-xs font-medium text-[#A1A1A1] mb-1.5 uppercase tracking-wide">
                {isActivationRequired ? 'Activation Code' : 'Activation Code (Optional)'}
              </label>
              <input
                type="text"
                id="activationCode"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                required={isActivationRequired}
                className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-[#FAFAFA] placeholder-[#4A4A4A] focus:outline-none focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE]/30 transition-all text-sm font-mono"
                placeholder="PRO-XXXX-XXXX"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#22D3EE] hover:bg-[#06B6D4] disabled:bg-[#22D3EE]/30 disabled:text-[#000]/50 text-black font-semibold rounded-md transition-all flex items-center justify-center text-sm mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </div>

          <div className="mt-5 text-center text-[#6B6B6B] text-sm">
            Have an account?{' '}
            <Link to="/login" className="text-[#22D3EE] hover:text-[#06B6D4] font-medium">
              Sign in
            </Link>
          </div>
        </form>

        <p className="mt-4 text-center text-[#4A4A4A] text-xs">
          By registering, you agree to our Terms and Privacy Policy
        </p>
      </div>
    </div>
  );
}
