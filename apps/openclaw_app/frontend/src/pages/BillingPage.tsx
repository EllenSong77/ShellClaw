import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { FileText, Loader2, AlertCircle, Calendar, DollarSign, ChevronLeft, Hash, XCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { BillingOrderResponse, BillingOrderStatus } from '../types';

const STATUS_CONFIG: Record<BillingOrderStatus, { label: string; color: string; icon: ComponentType<LucideProps>; bg: string }> = {
  pending: { label: 'Processing', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: Clock },
  paid: { label: 'Activated', color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red-500', bg: 'bg-red-500/10', icon: XCircle },
  cancelled: { label: 'Voided', color: 'text-gray-500', bg: 'bg-gray-500/10', icon: XCircle },
  refunded: { label: 'Revoked', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: DollarSign },
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Alpha Trial Activation',
  free: 'Alpha Free Activation',
  paid_personal: 'Personal Alpha Activation',
  paid_pro: 'Pro Alpha Activation',
};

export function BillingPage() {
  const [orders, setOrders] = useState<BillingOrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getOrders();
      setOrders(response.items || []);
    } catch (err) {
      let message = 'Access Denied: Failed to fetch transaction ledger';
      if (err instanceof ApiError) {
        message = typeof err.detail === 'object' ? err.detail.message || message : err.detail;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-20">
      {/* Header */}
      <div className="bg-[#111111] border-b border-[#2A2A2A] px-4 py-4 sticky top-0 z-10 backdrop-blur-md bg-opacity-80">
        <div className="max-w-2xl mx-auto flex items-center gap-5">
          <button
            onClick={() => navigate('/account')}
            className="p-2 hover:bg-[#1F1F1F] rounded-xl transition-all active:scale-95 border border-transparent hover:border-[#2A2A2A]"
          >
            <ChevronLeft size={20} className="text-[#6B6B6B]" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight uppercase">Redemption Logs</h1>
            <p className="text-[9px] text-[#404040] uppercase font-black tracking-[0.2em]">Activation History</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Success message */}
        {isSuccess && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5 mb-10 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 shadow-[0_10px_30px_rgba(34,197,94,0.05)]">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-tight">Activation Successful</p>
              <p className="text-xs text-green-500/70 font-medium">Your account tier has been updated and propagated system-wide.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 mb-10 flex items-center justify-between shadow-[0_10px_30px_rgba(239,68,68,0.05)]">
            <div className="flex items-center gap-4">
              <AlertCircle size={24} className="text-red-500" />
              <span className="text-sm font-bold text-white uppercase tracking-tight">{error}</span>
            </div>
            <button 
              onClick={fetchOrders} 
              className="text-[10px] font-black text-red-500 bg-red-500/10 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-all uppercase tracking-[0.1em] border border-red-500/10"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="animate-spin text-[#22D3EE] mb-6" size={40} />
            <p className="text-[10px] font-black text-[#404040] uppercase tracking-[0.3em] animate-pulse">Syncing Blockchain Records</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 bg-[#111111] rounded-3xl border border-dashed border-[#1F1F1F] shadow-inner">
            <div className="w-24 h-24 bg-[#1A1A1A] rounded-3xl flex items-center justify-center mb-8 border border-[#1F1F1F] shadow-xl">
              <FileText size={40} className="text-[#262626]" />
            </div>
            <p className="text-white font-black text-lg uppercase tracking-tight mb-3">No Records Found</p>
            <p className="text-xs text-[#404040] mb-10 text-center max-w-[280px] font-medium leading-relaxed uppercase tracking-wider">The activation history for this account is currently empty. Redeem a code in the account page to see records here.</p>
            <button
              onClick={() => navigate('/account')}
              className="px-8 py-3 bg-[#22D3EE] hover:bg-[#67E8F9] text-black rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-[0_10px_20px_rgba(34,211,238,0.2)]"
            >
              Go to Account
            </button>
          </div>
        )}

        {/* Order list */}
        {!isLoading && !error && orders.length > 0 && (
          <div className="space-y-6">
            {orders.map((order) => {
              const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              return (
                <div
                  key={order.id}
                  className="bg-[#141414] rounded-2xl border border-[#1F1F1F] overflow-hidden hover:border-[#333] transition-all group shadow-sm hover:shadow-xl"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-8">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-black text-white tracking-tight uppercase text-sm">{PLAN_LABELS[order.plan] || order.plan}</h3>
                        </div>
                        <div className={`inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border border-transparent ${status.bg} ${status.color}`}>
                          <status.icon size={10} />
                          {status.label}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-6 border-t border-[#1F1F1F]">
                      <MetaItem label="Initiated At" value={formatDate(order.created_at)} icon={Calendar} />
                      <MetaItem 
                        label={order.status === 'paid' ? "Finalized At" : order.status === 'cancelled' ? 'Terminated At' : 'Target Date'} 
                        value={formatDate(order.paid_at || order.cancelled_at || null)} 
                        icon={order.status === 'paid' ? DollarSign : Clock}
                        active={!!(order.paid_at || order.cancelled_at)}
                      />
                    </div>
                  </div>

                  <div className="bg-[#1A1A1A] px-6 py-4 flex items-center justify-between border-t border-[#1F1F1F]">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-[#22D3EE]/5 flex items-center justify-center border border-[#22D3EE]/10 group-hover:border-[#22D3EE]/20 transition-all">
                        <Hash size={14} className="text-[#22D3EE]/40" />
                      </div>
                      <span className="text-[10px] text-[#404040] font-mono truncate tracking-tight">
                        ID: {order.external_order_id || order.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[9px] font-black text-[#404040] uppercase tracking-widest">
                      <Zap size={12} />
                      ALPHA ACCESS
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value, icon: Icon, active }: { label: string; value: string; icon: ComponentType<LucideProps>; active?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-black text-[#404040] uppercase tracking-[0.2em]">{label}</p>
      <div className={`flex items-center gap-2 text-[11px] ${active ? 'text-[#A1A1A1]' : 'text-[#404040]'} font-mono`}>
        <Icon size={12} className="shrink-0" />
        <span className="font-medium">{value}</span>
      </div>
    </div>
  );
}
