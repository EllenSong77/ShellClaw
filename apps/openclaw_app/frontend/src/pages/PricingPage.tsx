import { useState, useEffect } from 'react';
import { Check, Loader2, Zap, Crown, Sparkles, AlertCircle, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import type { PlanFeatureResponse, SubscriptionResponse } from '../types';

export function PricingPage() {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const fetchSubscription = async () => {
    try {
      const data = await api.getSubscription();
      setSubscription(data);
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubscription();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleSelectPlan = async (planFeature: PlanFeatureResponse) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (planFeature.plan === subscription?.plan) {
      return;
    }

    // Direct checkout is disabled in Alpha Access Mode
    navigate('/account');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#22D3EE] animate-spin" />
      </div>
    );
  }

  const plans = subscription?.plans || [];

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-20">
      {/* Header */}
      <div className="bg-[#111111] border-b border-[#2A2A2A] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Alpha 权限等级</h1>
            <p className="text-xs text-[#6B6B6B] mt-1 font-mono uppercase tracking-widest">可用的部署资源</p>
          </div>
        </div>
      </div>

      {/* Alpha Access Notice */}
      <div className="bg-[#22D3EE]/10 border-b border-[#22D3EE]/20 px-4 py-3 text-center">
        <p className="text-[#22D3EE] text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3">
          <Zap size={14} fill="currentColor" />
          Alpha 访问模式：请在账户页面使用激活码进行升级
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Error */}
        {error && (
          <div className="bg-[#F87171]/5 border border-[#F87171]/20 rounded-xl p-4 mb-8 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-[#F87171]" />
              <span className="text-sm font-medium text-[#F87171]">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-[#F87171]/60 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        )}

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.plan}
              className={`relative bg-[#141414] rounded-2xl border transition-all duration-300 ${
                plan.highlighted ? 'border-[#22D3EE] shadow-[0_20px_40px_rgba(34,211,238,0.05)]' : 'border-[#2A2A2A]'
              } ${plan.plan === subscription?.plan ? 'ring-1 ring-[#22D3EE]/30' : 'hover:border-[#3A3A3A] hover:-translate-y-1'}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#22D3EE] text-black text-[10px] uppercase tracking-[0.2em] font-black px-4 py-1.5 rounded-full flex items-center gap-2">
                    <Zap size={12} fill="currentColor" />
                    推荐
                  </span>
                </div>
              )}

              <div className="p-8">
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    {plan.plan === 'paid_pro' && <Crown size={20} className="text-[#FACC15]" />}
                    {plan.plan === 'paid_personal' && <Sparkles size={20} className="text-[#22D3EE]" />}
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{plan.label}</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-black text-[#22D3EE] uppercase tracking-[0.2em]">Alpha 等级</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={plan.plan === subscription?.plan}
                  className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-3 mb-8 ${
                    plan.plan === subscription?.plan
                      ? 'bg-[#1A1A1A] text-[#404040] border border-[#262626] cursor-default'
                      : plan.highlighted
                      ? 'bg-[#22D3EE] hover:bg-[#67E8F9] text-black shadow-[0_0_20px_rgba(34,211,238,0.2)] active:scale-[0.98]'
                      : 'bg-[#F5F5F5] hover:bg-white text-black active:scale-[0.98]'
                  } disabled:opacity-50 disabled:active:scale-100`}
                >
                  {plan.plan === subscription?.plan ? (
                    '当前等级'
                  ) : (
                    <>
                      使用激活码升级 <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <div className="space-y-5">
                  <p className="text-[10px] font-black text-[#404040] uppercase tracking-[0.2em]">等级功能</p>
                  <ul className="space-y-4">
                    <FeatureItem label={plan.task_limit_daily ? `每日 ${plan.task_limit_daily} 个任务` : '无限任务'} />
                    <FeatureItem label={`${plan.max_concurrency} 个并发限制`} />
                    <FeatureItem label={`${plan.workspace_limit_mb}MB 存储容量`} />
                    <FeatureItem label={`${plan.sandbox_timeout_minutes} 分钟会话超时`} />
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] font-bold text-[#404040] mt-16 max-w-sm mx-auto leading-relaxed uppercase tracking-[0.2em]">
          Alpha 测试访问目前仅限受邀用户。
          <br />
          请联系支持人员获取内部激活码。
        </p>
      </div>
    </div>
  );
}

function FeatureItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-4 text-sm group">
      <div className="w-5 h-5 rounded-md bg-[#22D3EE]/5 flex items-center justify-center mt-0.5 border border-[#22D3EE]/10 group-hover:border-[#22D3EE]/30 transition-colors">
        <Check size={12} className="text-[#22D3EE]" />
      </div>
      <span className="text-[#808080] group-hover:text-[#A0A0A0] transition-colors">{label}</span>
    </li>
  );
}
