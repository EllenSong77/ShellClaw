import { useEffect, useState } from 'react';
import { User, Crown, Database, LogOut, Zap, CreditCard, FileText, ShieldCheck, AlertCircle, Clock, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api, ApiError } from '../api/client';
import type { BillingSummaryResponse } from '../types';

const PLAN_NAMES: Record<string, string> = {
  trial: 'Alpha Trial',
  free: 'Alpha Free',
  paid_personal: 'Personal Alpha',
  paid_pro: 'Pro Alpha',
};

export function AccountPage() {
  const navigate = useNavigate();
  const [billingSummary, setBillingSummary] = useState<BillingSummaryResponse | null>(null);
  const [, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemStatus, setRedeemStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
    fetchBillingSummary();
  }, [refreshSandbox, refreshUsage, refreshUser]);

  const fetchBillingSummary = async () => {
    setLoading(true);
    try {
      const summary = await api.getBillingSummary();
      setBillingSummary(summary);
    } catch (err) {
      console.error('Failed to fetch billing summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim() || isRedeeming) return;

    setIsRedeeming(true);
    setRedeemStatus(null);

    try {
      const response = await api.redeemCode(redeemCode.trim());
      setRedeemStatus({ type: 'success', message: response.message || 'Code redeemed successfully!' });
      setRedeemCode('');
      // Refresh all data
      fetchBillingSummary();
      refreshUser();
      refreshUsage();
    } catch (err) {
      let message = 'Failed to redeem code';
      if (err instanceof ApiError) {
        message = typeof err.detail === 'object' ? err.detail.message || message : err.detail;
      }
      setRedeemStatus({ type: 'error', message });
    } finally {
      setIsRedeeming(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user) return null;

  const subscription = billingSummary?.subscription;
  const recentOrders = billingSummary?.recent_orders || [];
  const dailyUsed = usage?.daily_used ?? 0;
  const dailyLimit = usage?.daily_limit;
  
  const currentPlan = subscription?.plan || user.plan;
  const subStatus = subscription?.subscription_status || 'inactive';
  const isPaid = subscription?.is_paid || false;

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'paid_pro': return <Crown size={10} fill="currentColor" />;
      case 'paid_personal': return <Zap size={10} fill="currentColor" />;
      case 'trial': return <Clock size={10} fill="currentColor" />;
      default: return <User size={10} fill="currentColor" />;
    }
  };

  const getPlanTheme = (plan: string) => {
    switch (plan) {
      case 'paid_pro': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'paid_personal': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'trial': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const themeClass = getPlanTheme(currentPlan);

  return (
    <div className="h-full overflow-y-auto p-4 pb-20 bg-[#0A0A0A]">
      <div className="max-w-md mx-auto space-y-5">
        {/* Profile & Plan Header */}
        <div className={`relative overflow-hidden bg-[#141414] rounded-2xl p-6 border ${themeClass.split(' ').pop()} shadow-[0_20px_40px_rgba(0,0,0,0.2)]`}>
          <div className="relative flex items-center gap-5 mb-6">
            <div className={`w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner`}>
              <User className="text-white/20" size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate mb-1.5 uppercase tracking-tight">{user.email}</p>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border ${themeClass}`}>
                {getPlanIcon(currentPlan)}
                {PLAN_NAMES[currentPlan]}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 relative">
            <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#262626] flex flex-col items-center text-center">
              <p className="text-[#404040] text-[9px] uppercase tracking-widest font-black mb-2">Alpha Status</p>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${subStatus === 'active' ? 'bg-[#4ADE80]' : 'bg-red-500'}`} />
                <span className="text-xs font-black uppercase tracking-tight text-white">{subStatus === 'active' ? 'Activated' : 'Inactive'}</span>
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#262626] flex flex-col items-center text-center">
              <p className="text-[#404040] text-[9px] uppercase tracking-widest font-black mb-2">Quota Type</p>
              <div className="flex items-center gap-2">
                {isPaid ? <ShieldCheck size={12} className="text-[#4ADE80]" /> : <AlertCircle size={12} className="text-red-500" />}
                <span className="text-xs font-black uppercase tracking-tight text-white">{isPaid ? 'Premium' : 'Standard'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Redeem Code Card (Emphasized) */}
        <div className="bg-[#141414] rounded-2xl p-6 border border-[#22D3EE]/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
          <h3 className="text-[10px] font-black text-[#22D3EE] uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <Zap size={12} fill="currentColor" />
            Redeem Activation Code
          </h3>
          
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="PRO-XXXX-XXXX"
                className="w-full bg-[#1A1A1A] border border-[#262626] rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-[#404040] focus:outline-none focus:border-[#22D3EE]/50 transition-all"
              />
              <button
                type="submit"
                disabled={!redeemCode.trim() || isRedeeming}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#22D3EE] hover:bg-[#67E8F9] disabled:bg-[#262626] disabled:text-[#404040] text-black px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
              >
                {isRedeeming ? <Loader2 size={14} className="animate-spin" /> : 'Redeem'}
              </button>
            </div>
            
            {redeemStatus && (
              <div className={`text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 ${
                redeemStatus.type === 'success' ? 'bg-green-500/5 text-green-500 border border-green-500/10' : 'bg-red-500/5 text-red-500 border border-red-500/10'
              }`}>
                {redeemStatus.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {redeemStatus.message}
              </div>
            )}
          </form>
          <p className="mt-3 text-[#404040] text-[9px] uppercase tracking-widest leading-relaxed">
            Enter your Alpha access code to upgrade your account and unlock more resources.
          </p>
        </div>

        {/* Subscription Detail Card */}
        <div className="bg-[#141414] rounded-2xl p-6 border border-[#1F1F1F]">
          <h3 className="text-[10px] font-black text-[#404040] uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <CreditCard size={12} />
            Activation Details
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#404040] uppercase tracking-wider">Joined Alpha</span>
              <span className="text-[11px] font-black font-mono text-white">{formatDate(subscription?.subscription_started_at || null)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#404040] uppercase tracking-wider">Access Expires</span>
              <span className="text-[11px] font-black font-mono text-white">{formatDate(subscription?.current_period_ends_at || null)}</span>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <div className="bg-[#141414] rounded-2xl p-6 border border-[#1F1F1F]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-black text-[#404040] uppercase tracking-[0.2em] flex items-center gap-2">
                <FileText size={12} />
                Redemption History
              </h3>
            </div>
            <div className="space-y-3">
              {recentOrders.slice(0, 2).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-xl border border-[#262626]">
                  <div>
                    <p className="text-[11px] font-bold text-white uppercase tracking-tight">{PLAN_NAMES[order.plan]}</p>
                    <p className="text-[9px] text-[#404040] font-mono">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${order.status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Card */}
        <div className="bg-[#141414] rounded-2xl p-6 border border-[#1F1F1F]">
          <h3 className="text-[10px] font-black text-[#404040] uppercase tracking-[0.2em] mb-6">Resource Usage</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[11px] mb-2 font-bold">
                <span className="text-[#6B6B6B] uppercase tracking-wider">Tasks</span>
                <span className="text-white font-mono">{dailyUsed} / {dailyLimit || '∞'}</span>
              </div>
              <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden border border-[#262626] p-0.5">
                <div
                  className="h-full bg-[#22D3EE] rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                  style={{ width: `${dailyLimit ? Math.min(100, (dailyUsed / dailyLimit) * 100) : 10}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#1A1A1A] rounded-xl p-4 border border-[#262626]">
              <div className="flex items-center gap-4">
                <Database size={20} className="text-[#22D3EE]" />
                <div>
                  <p className="text-[10px] font-black text-[#404040] uppercase tracking-widest mb-0.5">Workspace</p>
                  <p className="text-sm font-black text-white font-mono">{sandbox?.workspace_size_mb || 0} MB</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#262626]" />
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-[#141414] hover:bg-red-500/5 text-[#404040] hover:text-red-500 rounded-2xl p-4 flex items-center justify-center gap-3 transition-all border border-[#1F1F1F] hover:border-red-500/20 text-xs font-black uppercase tracking-[0.2em] active:scale-[0.99]"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
