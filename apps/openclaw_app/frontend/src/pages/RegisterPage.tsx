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
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为 6 位');
      return;
    }

    if (accessConfig?.activation_required && !activationCode) {
      setError('请输入激活码');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, activationCode);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
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
          <p className="text-[#6B6B6B] mt-2 text-sm">终端 AI 助手</p>
        </div>

        {/* Banner */}
        {isActivationRequired ? (
          <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-md px-4 py-3 mb-4 text-center">
            <p className="text-[#22D3EE] text-sm font-medium">仅限内测访问</p>
            <p className="text-[#6B6B6B] text-xs mt-0.5">需要激活码即可注册</p>
          </div>
        ) : (
          <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-md px-4 py-3 mb-4 text-center">
            <p className="text-[#22D3EE] text-sm font-medium">内部 Alpha 测试</p>
            <p className="text-[#6B6B6B] text-xs mt-0.5">受邀用户的早期访问</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#141414] rounded-lg p-6 border border-[#2A2A2A]">
          <h2 className="text-lg font-semibold mb-5">创建账号</h2>

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
                minLength={6}
                className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-[#FAFAFA] placeholder-[#4A4A4A] focus:outline-none focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE]/30 transition-all text-sm"
                placeholder="至少 6 位字符"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-[#A1A1A1] mb-1.5 uppercase tracking-wide">
                确认密码
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-[#FAFAFA] placeholder-[#4A4A4A] focus:outline-none focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE]/30 transition-all text-sm"
                placeholder="请再次输入密码"
              />
            </div>

            <div>
              <label htmlFor="activationCode" className="block text-xs font-medium text-[#A1A1A1] mb-1.5 uppercase tracking-wide">
                {isActivationRequired ? '激活码' : '激活码 (可选)'}
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
                  账号创建中...
                </>
              ) : (
                '创建账号'
              )}
            </button>
          </div>

          <div className="mt-5 text-center text-[#6B6B6B] text-sm">
            已有账号?{' '}
            <Link to="/login" className="text-[#22D3EE] hover:text-[#06B6D4] font-medium">
              立即登录
            </Link>
          </div>
        </form>

        <p className="mt-4 text-center text-[#4A4A4A] text-xs">
          注册即表示您同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
