import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuthStore } from '../stores/auth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/chat';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" showText={true} />
          <p className="text-[#6B6B6B] mt-2 text-sm">终端 AI 助手</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#141414] rounded-lg p-6 border border-[#2A2A2A]">
          <h2 className="text-lg font-semibold mb-5">登录</h2>

          {error && (
            <div className="bg-[#F87171]/10 border border-[#F87171]/20 text-[#F87171] px-4 py-2.5 rounded-md mb-4 text-sm font-mono">
              <span className="text-[#F87171]/60 mr-2">[错误]</span>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#A1A1A1] mb-1.5 uppercase tracking-wide">
                邮箱
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
                密码
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-[#FAFAFA] placeholder-[#4A4A4A] focus:outline-none focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE]/30 transition-all text-sm"
                placeholder="请输入密码"
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
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </button>
          </div>

          <div className="mt-5 text-center text-[#6B6B6B] text-sm">
            没有账号?{' '}
            <Link to="/register" className="text-[#22D3EE] hover:text-[#06B6D4] font-medium">
              立即创建
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
