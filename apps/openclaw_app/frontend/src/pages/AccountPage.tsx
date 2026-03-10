import { useEffect } from 'react';
import { User, Crown, Calendar, Database, LogOut, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

const PLAN_NAMES: Record<string, string> = {
  trial: 'Free Trial',
  free: 'Free',
  paid_personal: 'Personal',
  paid_pro: 'Professional',
};

const PLAN_COLORS: Record<string, string> = {
  trial: 'text-[#60A5FA] bg-[#60A5FA]/10 border-[#60A5FA]/20',
  free: 'text-[#A1A1A1] bg-[#A1A1A1]/10 border-[#A1A1A1]/20',
  paid_personal: 'text-[#C084FC] bg-[#C084FC]/10 border-[#C084FC]/20',
  paid_pro: 'text-[#FACC15] bg-[#FACC15]/10 border-[#FACC15]/20',
};

export function AccountPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const usage = useAuthStore((state) => state.usage);
  const sandbox = useAuthStore((state) => state.sandbox);
  const logout = useAuthStore((state) => state.logout);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const refreshUsage = useAuthStore((state) => state.refreshUsage);
  const refreshSandbox = useAuthStore((state) => state.refreshSandbox);

  useEffect(() => {
    refreshUser();
    refreshUsage();
    refreshSandbox();
  }, [refreshSandbox, refreshUsage, refreshUser]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getTrialDaysRemaining = () => {
    const endsAt = usage?.trial_ends_at || user?.trial_ends_at;
    if (!endsAt) return 0;
    const ends = new Date(endsAt);
    const now = new Date();
    const diff = ends.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getPlanExpiry = () => {
    const paidUntil = usage?.paid_until ?? user?.paid_until;
    if (!paidUntil) return null;
    return new Date(paidUntil).toLocaleDateString();
  };

  if (!user) {
    return null;
  }

  const trialDaysRemaining = getTrialDaysRemaining();
  const dailyUsed = usage?.daily_used ?? 0;
  const dailyLimit = usage?.daily_limit;
  const dailyRemaining = usage?.daily_remaining;

  return (
    <div className="h-full overflow-y-auto p-4 pb-20 bg-[#0A0A0A]">
      <div className="max-w-md mx-auto space-y-3">
        {/* Profile Card */}
        <div className="bg-[#141414] rounded-lg p-5 border border-[#2A2A2A]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-[#22D3EE]/10 rounded-lg flex items-center justify-center">
              <User className="text-[#22D3EE]" size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-[#A1A1A1] truncate">{user.email}</p>
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium mt-1 border ${PLAN_COLORS[user.plan]}`}>
                <Crown size={12} />
                {PLAN_NAMES[user.plan]}
              </div>
            </div>
          </div>

          {/* Trial countdown */}
          {user.plan === 'trial' && trialDaysRemaining > 0 && (
            <div className="bg-[#60A5FA]/5 border border-[#60A5FA]/20 rounded-md p-3 mb-3">
              <div className="flex items-center gap-2 text-[#60A5FA] text-sm">
                <Calendar size={14} />
                <span className="font-medium">{trialDaysRemaining} days remaining in trial</span>
              </div>
              <p className="text-xs text-[#6B6B6B] mt-1 ml-5">
                Upgrade to keep using ShellClaw after your trial ends
              </p>
            </div>
          )}

          {/* Plan expiry */}
          {user.plan !== 'trial' && user.plan !== 'free' && getPlanExpiry() && (
            <div className="bg-[#1A1A1A] rounded-md p-3 text-sm">
              <div className="flex items-center gap-2 text-[#A1A1A1]">
                <Calendar size={14} />
                <span>Valid until: <span className="text-[#FAFAFA]">{getPlanExpiry()}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* Usage Card */}
        <div className="bg-[#141414] rounded-lg p-5 border border-[#2A2A2A]">
          <h3 className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wide mb-3">Today's Usage</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1A1A1A] rounded-md p-3">
              <p className="text-[#6B6B6B] text-xs mb-1">Tasks</p>
              <p className="text-xl font-semibold font-mono">
                {dailyUsed}
                {dailyLimit && <span className="text-[#6B6B6B] text-base">/{dailyLimit}</span>}
              </p>
              {dailyRemaining !== null && dailyRemaining !== undefined && (
                <p className="text-xs text-[#4ADE80] mt-0.5">{dailyRemaining} left</p>
              )}
            </div>
            <div className="bg-[#1A1A1A] rounded-md p-3">
              <p className="text-[#6B6B6B] text-xs mb-1">Sandbox</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${
                  sandbox?.status === 'running' ? 'bg-[#4ADE80]' :
                  sandbox?.status === 'paused' ? 'bg-[#FACC15]' :
                  'bg-[#6B6B6B]'
                }`} />
                <span className="text-sm font-medium capitalize font-mono">
                  {sandbox?.status || 'unknown'}
                </span>
              </div>
            </div>
          </div>

          {user.plan === 'free' && dailyLimit && dailyUsed >= dailyLimit && (
            <div className="mt-3 bg-[#FACC15]/5 border border-[#FACC15]/20 rounded-md p-2.5 text-[#FACC15] text-xs flex items-center gap-2">
              <Zap size={14} />
              <span>Daily limit reached. Upgrade for unlimited tasks.</span>
            </div>
          )}
        </div>

        {/* Storage Card */}
        <div className="bg-[#141414] rounded-lg p-5 border border-[#2A2A2A]">
          <h3 className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wide mb-3">Workspace Storage</h3>
          <div className="flex items-center gap-3">
            <Database className="text-[#6B6B6B]" size={20} />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#6B6B6B]">Used</span>
                <span className="font-mono">{sandbox?.workspace_size_mb || 0} MB</span>
              </div>
              <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#22D3EE] rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((sandbox?.workspace_size_mb || 0) / 50) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-[#141414] hover:bg-[#1A1A1A] text-[#F87171] rounded-lg p-3 flex items-center justify-center gap-2 transition-colors border border-[#2A2A2A] text-sm font-medium"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
