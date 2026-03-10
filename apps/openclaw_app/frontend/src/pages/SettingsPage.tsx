import { RefreshCw, Play, Pause, Square } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/client';
import { useState } from 'react';

export function SettingsPage() {
  const sandbox = useAuthStore((state) => state.sandbox);
  const refreshSandbox = useAuthStore((state) => state.refreshSandbox);

  const [isStarting, setIsStarting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await api.startSandbox();
      await refreshSandbox();
    } catch (err) {
      console.error('Failed to start sandbox:', err);
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async () => {
    setIsPausing(true);
    try {
      await api.pauseSandbox();
      await refreshSandbox();
    } catch (err) {
      console.error('Failed to pause sandbox:', err);
    } finally {
      setIsPausing(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await api.stopSandbox();
      await refreshSandbox();
    } catch (err) {
      console.error('Failed to stop sandbox:', err);
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 pb-20 bg-[#0A0A0A]">
      <div className="max-w-md mx-auto space-y-3">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>

        {/* Sandbox Controls */}
        <div className="bg-[#141414] rounded-lg p-5 border border-[#2A2A2A]">
          <h3 className="text-sm font-semibold mb-4">Sandbox Controls</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Status</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-2 h-2 rounded-full ${
                    sandbox?.status === 'running' ? 'bg-[#4ADE80]' :
                    sandbox?.status === 'paused' ? 'bg-[#FACC15]' :
                    'bg-[#6B6B6B]'
                  }`} />
                  <p className="text-xs text-[#A1A1A1] font-mono capitalize">{sandbox?.status || 'unknown'}</p>
                </div>
              </div>
              <button
                onClick={refreshSandbox}
                className="p-2 hover:bg-[#1A1A1A] rounded-md transition-colors border border-[#2A2A2A]"
              >
                <RefreshCw size={16} className="text-[#6B6B6B]" />
              </button>
            </div>

            <div className="border-t border-[#2A2A2A] pt-4">
              <p className="text-xs text-[#6B6B6B] mb-3">
                Manage your sandbox container
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleStart}
                  disabled={isStarting || sandbox?.status === 'running'}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-md transition-all text-xs font-medium bg-[#4ADE80]/5 hover:bg-[#4ADE80]/10 disabled:bg-[#1A1A1A] text-[#4ADE80] disabled:text-[#4A4A4A] border border-[#4ADE80]/20 disabled:border-[#2A2A2A]"
                >
                  <Play size={16} />
                  {isStarting ? '...' : 'Start'}
                </button>
                <button
                  onClick={handlePause}
                  disabled={isPausing || sandbox?.status !== 'running'}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-md transition-all text-xs font-medium bg-[#FACC15]/5 hover:bg-[#FACC15]/10 disabled:bg-[#1A1A1A] text-[#FACC15] disabled:text-[#4A4A4A] border border-[#FACC15]/20 disabled:border-[#2A2A2A]"
                >
                  <Pause size={16} />
                  {isPausing ? '...' : 'Pause'}
                </button>
                <button
                  onClick={handleStop}
                  disabled={isStopping || sandbox?.status === 'stopped'}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-md transition-all text-xs font-medium bg-[#F87171]/5 hover:bg-[#F87171]/10 disabled:bg-[#1A1A1A] text-[#F87171] disabled:text-[#4A4A4A] border border-[#F87171]/20 disabled:border-[#2A2A2A]"
                >
                  <Square size={16} />
                  {isStopping ? '...' : 'Stop'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-[#141414] rounded-lg p-5 border border-[#2A2A2A]">
          <h3 className="text-sm font-semibold mb-3">About</h3>
          <div className="flex items-center gap-3 mb-3">
            <Logo size="sm" showText={true} />
            <span className="text-xs text-[#6B6B6B] font-mono">v1.0.0</span>
          </div>
          <p className="text-xs text-[#6B6B6B]">
            Terminal AI assistant with sandbox code execution.
          </p>
        </div>
      </div>
    </div>
  );
}
