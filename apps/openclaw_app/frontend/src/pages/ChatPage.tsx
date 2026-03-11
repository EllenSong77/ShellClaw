import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle, CheckCircle, Clock, XCircle, Wifi, WifiOff, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuthStore } from '../stores/auth';
import { useTaskStore } from '../stores/task';
import { api, ApiError } from '../api/client';
import { useTaskPolling } from '../hooks/useTaskPolling';
import { useWebSocket } from '../hooks/useWebSocket';
import type { TaskStatus, ApiErrorDetail } from '../types';

function StatusIndicator({ status, isStreaming }: { status?: TaskStatus | 'pending'; isStreaming?: boolean }) {
  if (isStreaming || status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[#60A5FA]">
        <Loader2 className="animate-spin" size={12} />
        <span className="text-xs font-mono">running</span>
      </span>
    );
  }
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-[#FACC15]">
          <Clock size={12} />
          <span className="text-xs font-mono">pending</span>
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 text-[#4ADE80]">
          <CheckCircle size={12} />
          <span className="text-xs font-mono">done</span>
        </span>
      );
    case 'error':
    case 'timeout':
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 text-[#F87171]">
          <XCircle size={12} />
          <span className="text-xs font-mono">{status}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[#6B6B6B]">
          <Clock size={12} />
          <span className="text-xs font-mono">waiting</span>
        </span>
      );
  }
}

export function ChatPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const user = useAuthStore((state) => state.user);
  const usage = useAuthStore((state) => state.usage);
  const messages = useTaskStore((state) => state.messages);
  const addUserMessage = useTaskStore((state) => state.addUserMessage);
  const enqueuePendingTask = useTaskStore((state) => state.enqueuePendingTask);
  const isStreaming = useTaskStore((state) => state.isStreaming);
  const wsConnected = useTaskStore((state) => state.wsConnected);

  useWebSocket({ enabled: true });
  useTaskPolling({ enabled: true });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [errorDetail, setErrorDetail] = useState<ApiErrorDetail | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || isStreaming || !user) return;

    const message = input.trim();
    setInput('');
    setError(null);
    setErrorDetail(null);
    setIsSending(true);

    addUserMessage(message);

    try {
      const response = await api.createTask({ message });
      enqueuePendingTask(response.task_id);
    } catch (err) {
      let errorMessage = 'Failed to send message';
      if (err instanceof ApiError) {
        if (typeof err.detail === 'object') {
          setErrorDetail(err.detail);
          errorMessage = err.detail.message || errorMessage;
        } else {
          errorMessage = err.detail || errorMessage;
        }
      }
      setError(errorMessage);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const renderErrorBanner = () => {
    if (!error) return null;

    const isUpgradeRequired = errorDetail?.upgrade_required || 
                             errorDetail?.code === 'DAILY_LIMIT_REACHED' || 
                             errorDetail?.code === 'TRIAL_ENDED' ||
                             errorDetail?.code === 'PLAN_UPGRADE_REQUIRED';

    return (
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 ${
        isUpgradeRequired ? 'bg-[#FACC15]/10 border-[#FACC15]/20' : 'bg-[#F87171]/10 border-[#F87171]/20'
      }`}>
        <div className="flex items-center gap-2 flex-1">
          {isUpgradeRequired ? (
            <Zap size={16} className="text-[#FACC15] shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-[#F87171] shrink-0" />
          )}
          <div className="flex flex-col">
            <span className={`text-xs font-bold uppercase tracking-wider ${isUpgradeRequired ? 'text-[#FACC15]' : 'text-[#F87171]'}`}>
              {errorDetail?.code?.replace(/_/g, ' ') || 'SYSTEM ERROR'}
            </span>
            <span className="text-xs text-[#A1A1A1] mt-0.5">{error}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isUpgradeRequired && (
            <button
              onClick={() => navigate('/pricing')}
              className="bg-[#22D3EE] hover:bg-[#67E8F9] text-black text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
            >
              Upgrade Now
            </button>
          )}
          <button
            onClick={() => { setError(null); setErrorDetail(null); }}
            className="text-[#6B6B6B] hover:text-white p-1"
          >
            <XCircle size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Status bar */}
      <div className="bg-[#111111] border-b border-[#2A2A2A] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 ${wsConnected ? 'text-[#4ADE80]' : 'text-[#6B6B6B]'}`}>
            {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-xs font-mono">{wsConnected ? 'connected' : 'offline'}</span>
          </div>
          {isStreaming && (
            <span className="text-xs font-mono text-[#60A5FA] flex items-center gap-1">
              <Loader2 className="animate-spin" size={12} />
              processing...
            </span>
          )}
        </div>
        {usage && (
          <div className="text-xs font-mono text-[#6B6B6B]">
            {usage.daily_remaining !== null ? (
              <span>{usage.daily_remaining} left</span>
            ) : (
              <span className="text-[#4ADE80]">unlimited</span>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {renderErrorBanner()}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto mt-6">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center px-4 text-center">
            <Logo size="lg" showText={true} />
            <p className="text-sm text-[#6B6B6B] mt-3 mb-6">Your terminal AI assistant</p>

            <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 max-w-sm">
              <p className="text-xs text-[#6B6B6B] font-mono mb-2">$ shellclaw --help</p>
              <p className="text-sm text-[#A1A1A1]">Type a message below to start a task. I can help with code, debugging, and more.</p>
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] ${
                    msg.role === 'user'
                      ? 'message-user px-4 py-2.5 rounded-lg rounded-br-sm'
                      : 'message-assistant px-4 py-3 rounded-lg rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm font-medium whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div>
                      {/* Assistant header */}
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2A2A2A]">
                        <span className="text-[#22D3EE] font-mono text-xs">$</span>
                        <StatusIndicator status={msg.status} isStreaming={msg.isStreaming} />
                      </div>
                      {/* Content */}
                      <div className="prose prose-invert prose-sm max-w-none">
                        {msg.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        ) : msg.isStreaming ? (
                          <span className="text-[#6B6B6B] font-mono text-sm cursor-blink">thinking</span>
                        ) : (
                          <span className="text-[#6B6B6B] text-sm italic">No output</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-[#2A2A2A] p-3 bg-[#0A0A0A]">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#22D3EE] font-mono text-sm">$</span>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command..."
              rows={1}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg pl-7 pr-3 py-2.5 text-sm text-[#FAFAFA] placeholder-[#4A4A4A] focus:outline-none focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE]/20 transition-all font-mono resize-none"
              style={{ minHeight: '42px', maxHeight: '100px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isSending || isStreaming}
            className="px-4 bg-[#22D3EE] hover:bg-[#06B6D4] disabled:bg-[#1A1A1A] disabled:text-[#4A4A4A] text-black disabled:text-[#4A4A4A] rounded-lg transition-all flex items-center justify-center"
          >
            {isSending || isStreaming ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
        <p className="text-[10px] text-[#4A4A4A] mt-2 text-center font-mono">
          Enter to send / Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
