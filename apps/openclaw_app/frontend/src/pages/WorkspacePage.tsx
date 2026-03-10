import { useState, useEffect } from 'react';
import { Folder, File, Upload, Download, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import type { Workspace as WorkspaceType, WorkspaceEntry } from '../types';

export function WorkspacePage() {
  const [workspace, setWorkspace] = useState<WorkspaceType | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = async (path = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getWorkspace(path);
      setWorkspace(data);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      await api.uploadFile(file, currentPath);
      await fetchWorkspace(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
    e.target.value = '';
  };

  const handleDownload = (path: string) => {
    const url = api.getFileDownloadUrl(path);
    window.open(url, '_blank');
  };

  const handleNavigate = (entry: WorkspaceEntry) => {
    if (entry.is_dir) {
      fetchWorkspace(entry.path);
    } else {
      handleDownload(entry.path);
    }
  };

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    const parentPath = parts.join('/');
    fetchWorkspace(parentPath);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  };

  return (
    <div className="h-full overflow-y-auto p-4 pb-20 bg-[#0A0A0A]">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Folder className="text-[#22D3EE]" size={20} />
            <h1 className="text-lg font-semibold">Files</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchWorkspace(currentPath)}
              disabled={isLoading}
              className="p-2 bg-[#141414] hover:bg-[#1A1A1A] rounded-md transition-colors border border-[#2A2A2A]"
            >
              <RefreshCw className={`${isLoading ? 'animate-spin' : ''} text-[#6B6B6B]`} size={16} />
            </button>
            <label className="flex items-center gap-2 px-3 py-2 bg-[#22D3EE] hover:bg-[#06B6D4] text-black rounded-md cursor-pointer transition-all text-sm font-medium">
              {isUploading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Upload size={16} />
              )}
              <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#F87171]/5 border border-[#F87171]/20 text-[#F87171] px-4 py-2.5 rounded-md mb-4 text-sm font-mono">
            <span className="text-[#F87171]/60 mr-2">[error]</span>
            {error}
            <button onClick={() => setError(null)} className="ml-3 underline hover:text-[#FCA5A5] text-xs">
              dismiss
            </button>
          </div>
        )}

        {/* Path breadcrumb */}
        <div className="bg-[#141414] rounded-md px-3 py-2 mb-3 flex items-center gap-1 text-sm overflow-x-auto border border-[#2A2A2A] font-mono">
          <span className="text-[#22D3EE]">$</span>
          <span className="text-[#6B6B6B]">~/</span>
          <button
            onClick={() => fetchWorkspace('')}
            className="text-[#A1A1A1] hover:text-[#FAFAFA]"
          >
            workspace
          </button>
          {currentPath && currentPath.split('/').filter(Boolean).map((part, index, arr) => {
            const path = arr.slice(0, index + 1).join('/');
            return (
              <div key={path} className="flex items-center gap-1">
                <ChevronRight size={12} className="text-[#4A4A4A]" />
                <button
                  onClick={() => fetchWorkspace(path)}
                  className="text-[#A1A1A1] hover:text-[#FAFAFA] whitespace-nowrap"
                >
                  {part}
                </button>
              </div>
            );
          })}
        </div>

        {/* File list */}
        <div className="bg-[#141414] rounded-lg overflow-hidden border border-[#2A2A2A]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-[#22D3EE]" size={28} />
            </div>
          ) : !workspace?.entries?.length ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-[#1A1A1A] rounded-lg flex items-center justify-center mx-auto mb-3">
                <Folder className="text-[#4A4A4A]" size={24} />
              </div>
              <p className="text-[#6B6B6B] text-sm">Empty directory</p>
              <p className="text-xs text-[#4A4A4A] mt-1">Upload files to get started</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#2A2A2A]">
              {currentPath && (
                <li>
                  <button
                    onClick={handleBack}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1A1A1A]/50 transition-colors"
                  >
                    <Folder className="text-[#6B6B6B]" size={18} />
                    <span className="text-[#6B6B6B] text-sm font-mono">..</span>
                  </button>
                </li>
              )}
              {workspace.entries.map((entry) => (
                <li key={entry.path}>
                  <button
                    onClick={() => handleNavigate(entry)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1A1A1A]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {entry.is_dir ? (
                        <Folder className="text-[#22D3EE]" size={18} />
                      ) : (
                        <File className="text-[#6B6B6B]" size={18} />
                      )}
                      <span className="text-sm truncate font-mono">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#4A4A4A] font-mono">
                      <span>{formatSize(entry.size)}</span>
                      {!entry.is_dir && (
                        <Download size={14} className="text-[#6B6B6B]" />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
