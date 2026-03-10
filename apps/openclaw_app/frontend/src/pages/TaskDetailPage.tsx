import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Cpu, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, ApiError } from '../api/client';
import type { Task } from '../types';

const STATUS_COLORS: Record<string, string> = {
  running: 'text-[#60A5FA] bg-[#60A5FA]/10 border-[#60A5FA]/20',
  completed: 'text-[#4ADE80] bg-[#4ADE80]/10 border-[#4ADE80]/20',
  timeout: 'text-[#FACC15] bg-[#FACC15]/10 border-[#FACC15]/20',
  error: 'text-[#F87171] bg-[#F87171]/10 border-[#F87171]/20',
  cancelled: 'text-[#A1A1A1] bg-[#A1A1A1]/10 border-[#A1A1A1]/20',
};

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stdout' | 'stderr' | 'error'>('stdout');

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getTask(taskId);
      setTask(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load task');
      }
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    fetchTask();
  }, [fetchTask, taskId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="animate-spin text-[#22D3EE]" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-[#0A0A0A]">
        <AlertTriangle className="text-[#F87171] mb-4" size={40} />
        <p className="text-[#F87171] text-sm mb-4 font-mono">{error}</p>
        <button
          onClick={() => navigate('/chat')}
          className="px-4 py-2 bg-[#141414] hover:bg-[#1A1A1A] rounded-md border border-[#2A2A2A] text-sm"
        >
          Back to Chat
        </button>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-[#111111] border-b border-[#2A2A2A] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/chat')}
          className="p-1.5 hover:bg-[#1A1A1A] rounded-md transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium">Task Details</h1>
          <p className="text-xs text-[#6B6B6B] font-mono truncate">{task.id}</p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-mono capitalize ${STATUS_COLORS[task.status || 'running']}`}>
          {task.status || 'running'}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-[#141414] rounded-md p-3 border border-[#2A2A2A]">
              <div className="flex items-center gap-1.5 text-[#6B6B6B] text-xs mb-1">
                <Clock size={12} />
                <span>Duration</span>
              </div>
              <p className="text-sm font-mono">{task.duration_sec ? `${task.duration_sec}s` : '—'}</p>
            </div>
            <div className="bg-[#141414] rounded-md p-3 border border-[#2A2A2A]">
              <div className="flex items-center gap-1.5 text-[#6B6B6B] text-xs mb-1">
                <Cpu size={12} />
                <span>LLM Calls</span>
              </div>
              <p className="text-sm font-mono">{task.llm_calls}</p>
            </div>
            <div className="bg-[#141414] rounded-md p-3 border border-[#2A2A2A]">
              <div className="flex items-center gap-1.5 text-[#6B6B6B] text-xs mb-1">
                <FileText size={12} />
                <span>Input</span>
              </div>
              <p className="text-sm font-mono">{task.input_tokens.toLocaleString()}</p>
            </div>
            <div className="bg-[#141414] rounded-md p-3 border border-[#2A2A2A]">
              <div className="flex items-center gap-1.5 text-[#6B6B6B] text-xs mb-1">
                <FileText size={12} />
                <span>Output</span>
              </div>
              <p className="text-sm font-mono">{task.output_tokens.toLocaleString()}</p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-[#141414] rounded-md p-3 border border-[#2A2A2A]">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#6B6B6B]">Started:</span>
                <span className="ml-2 font-mono">{formatDate(task.started_at)}</span>
              </div>
              {task.ended_at && (
                <div>
                  <span className="text-[#6B6B6B]">Ended:</span>
                  <span className="ml-2 font-mono">{formatDate(task.ended_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Output Tabs */}
          <div className="bg-[#141414] rounded-lg overflow-hidden border border-[#2A2A2A]">
            <div className="flex border-b border-[#2A2A2A]">
              {(['stdout', 'stderr', 'error'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2.5 text-xs font-mono uppercase transition-colors ${
                    activeTab === tab
                      ? 'bg-[#1A1A1A] text-[#FAFAFA]'
                      : 'text-[#6B6B6B] hover:text-[#A1A1A1] hover:bg-[#1A1A1A]/50'
                  }`}
                >
                  {tab}
                  {tab === 'error' && task.error_text && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-[#F87171] text-white text-[10px] rounded">
                      !
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {activeTab === 'stdout' && (
                task.stdout_text ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {task.stdout_text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[#4A4A4A] text-center py-8 text-sm font-mono">no output</p>
                )
              )}
              {activeTab === 'stderr' && (
                task.stderr_text ? (
                  <pre className="text-xs text-[#FACC15] whitespace-pre-wrap font-mono">
                    {task.stderr_text}
                  </pre>
                ) : (
                  <p className="text-[#4A4A4A] text-center py-8 text-sm font-mono">no stderr</p>
                )
              )}
              {activeTab === 'error' && (
                task.error_text ? (
                  <pre className="text-xs text-[#F87171] whitespace-pre-wrap font-mono">
                    {task.error_text}
                  </pre>
                ) : (
                  <p className="text-[#4A4A4A] text-center py-8 text-sm font-mono">no errors</p>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
