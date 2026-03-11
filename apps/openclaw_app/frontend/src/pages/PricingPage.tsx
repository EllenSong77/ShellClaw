import { useState, useEffect } from 'react';
import { Check, Loader2, Zap, Crown, Sparkles, AlertCircle, ShoppingCart, ArrowRight, X, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuthStore } from '../stores/auth';
import type { Plan, PlanFeatureResponse, SubscriptionResponse, CheckoutRequest, BillingOrderResponse } from '../types';

export function PricingPage() {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<Plan | null>(null);
  const [pendingOrder, setPendingOrder] = useState<BillingOrderResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

    setProcessingPlan(planFeature.plan);
    setError(null);
    setSuccess(null);

    try {
      const payload: CheckoutRequest = {
        plan: planFeature.plan,
        provider: 'mock',
        success_url: `${window.location.origin}/billing?success=true`,
        cancel_url: `${window.location.origin}/pricing?cancelled=true`,
      };

      const response = await api.createCheckout(payload);

      if (response.mock && response.order) {
        // Show mock payment simulation UI
        setPendingOrder(response.order);
      } else if (response.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (err) {
      let message = 'Failed to create order';
      if (err instanceof ApiError) {
        message = typeof err.detail === 'object' ? err.detail.message || message : err.detail;
      }
      setError(message);
    } finally {
      setProcessingPlan(null);
    }
  };

  const simulatePaymentAction = async (action: 'complete' | 'fail' | 'cancel') => {
    if (!pendingOrder) return;
    
    setIsSimulating(true);
    setError(null);

    try {
      if (action === 'complete') {
        await api.mockCompleteOrder(pendingOrder.id);
        setSuccess(`Successfully upgraded!`);
        await fetchSubscription();
        setPendingOrder(null);
      } else if (action === 'fail') {
        await api.mockFailOrder(pendingOrder.id);
        setError('Payment failed. Please try again.');
        setPendingOrder(null);
      } else if (action === 'cancel') {
        await api.mockCancelOrder(pendingOrder.id);
        setPendingOrder(null);
      }
    } catch {
      setError('Action failed');
    } finally {
      setIsSimulating(false);
    }
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
            <h1 className="text-xl font-semibold text-white tracking-tight">Pricing</h1>
            <p className="text-xs text-[#6B6B6B] mt-1 font-mono uppercase tracking-widest">Select your deployment tier</p>
          </div>
          {isAuthenticated && (
            <button 
              onClick={() => navigate('/billing')}
              className="text-xs font-bold text-[#6B6B6B] hover:text-[#22D3EE] border border-[#2A2A2A] px-3 py-1.5 rounded-lg transition-colors uppercase tracking-widest"
            >
              Order History
            </button>
          )}
        </div>
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

        {/* Success */}
        {success && (
          <div className="bg-[#4ADE80]/5 border border-[#4ADE80]/20 rounded-xl p-4 mb-8 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#4ADE80]/10 flex items-center justify-center text-[#4ADE80]">
                <Check size={18} />
              </div>
              <span className="text-sm font-bold text-[#4ADE80]">{success}</span>
            </div>
            <button 
              onClick={() => navigate('/account')}
              className="text-xs font-bold text-[#4ADE80] bg-[#4ADE80]/10 px-4 py-2 rounded-lg hover:bg-[#4ADE80]/20 transition-all uppercase tracking-wider"
            >
              Go to Account
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
                    Recommended
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
                    <span className="text-4xl font-black text-white">¥{plan.price_month_cny}</span>
                    <span className="text-[#404040] text-sm font-mono uppercase tracking-widest">/mo</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={processingPlan !== null || plan.plan === subscription?.plan || pendingOrder !== null}
                  className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-3 mb-8 ${
                    plan.plan === subscription?.plan
                      ? 'bg-[#1A1A1A] text-[#404040] border border-[#262626] cursor-default'
                      : plan.highlighted
                      ? 'bg-[#22D3EE] hover:bg-[#67E8F9] text-black shadow-[0_0_20px_rgba(34,211,238,0.2)] active:scale-[0.98]'
                      : 'bg-[#F5F5F5] hover:bg-white text-black active:scale-[0.98]'
                  } disabled:opacity-50 disabled:active:scale-100`}
                >
                  {processingPlan === plan.plan ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : plan.plan === subscription?.plan ? (
                    'Current Plan'
                  ) : (
                    <>
                      Upgrade <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <div className="space-y-5">
                  <p className="text-[10px] font-black text-[#404040] uppercase tracking-[0.2em]">Tier Features</p>
                  <ul className="space-y-4">
                    <FeatureItem label={plan.task_limit_daily ? `${plan.task_limit_daily} tasks / day` : 'Unlimited tasks'} />
                    <FeatureItem label={`${plan.max_concurrency} concurrency limit`} />
                    <FeatureItem label={`${plan.workspace_limit_mb}MB storage capacity`} />
                    <FeatureItem label={`${plan.sandbox_timeout_minutes}m session timeout`} />
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mock Payment Simulation Modal */}
        {pendingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="p-6 border-b border-[#2A2A2A] flex items-center justify-between bg-[#1A1A1A]">
                <div className="flex items-center gap-3">
                  <CreditCard className="text-[#22D3EE]" />
                  <h3 className="font-bold text-white tracking-tight uppercase">Payment Simulation</h3>
                </div>
                <button 
                  onClick={() => setPendingOrder(null)}
                  className="text-[#6B6B6B] hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-[#22D3EE]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#22D3EE]/20">
                  <ShoppingCart className="text-[#22D3EE]" size={32} />
                </div>
                <h4 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Pending Payment</h4>
                <p className="text-sm text-[#6B6B6B] mb-8">
                  Your order for <span className="text-white font-bold">{pendingOrder.plan}</span> is ready. 
                  Choose an action to simulate the payment result.
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => simulatePaymentAction('complete')}
                    disabled={isSimulating}
                    className="w-full bg-[#4ADE80] hover:bg-[#22C55E] text-black py-3 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSimulating ? <Loader2 className="animate-spin" size={18} /> : 'Simulate Success'}
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => simulatePaymentAction('fail')}
                      disabled={isSimulating}
                      className="bg-[#F87171]/10 hover:bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/20 py-3 rounded-xl font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      Simulate Fail
                    </button>
                    <button
                      onClick={() => simulatePaymentAction('cancel')}
                      disabled={isSimulating}
                      className="bg-[#1A1A1A] hover:bg-[#222] text-[#6B6B6B] border border-[#2A2A2A] py-3 rounded-xl font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#1A1A1A] px-6 py-4 flex items-center justify-between text-[10px] font-mono text-[#404040] border-t border-[#2A2A2A]">
                <span>ORDER ID: {pendingOrder.id}</span>
                <span className="uppercase tracking-[0.2em]">{pendingOrder.provider}</span>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] font-bold text-[#404040] mt-16 max-w-sm mx-auto leading-relaxed uppercase tracking-[0.2em]">
          Transactions are secured and encrypted. 
          <br />
          Contact support for enterprise custom quotes.
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
