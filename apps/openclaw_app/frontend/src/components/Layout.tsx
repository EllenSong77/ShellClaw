import { Outlet, NavLink } from 'react-router-dom';
import { User, Settings, FolderOpen, MessageSquare } from 'lucide-react';
import { Logo } from './Logo';
import { useAuthStore } from '../stores/auth';

export function Layout() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="h-screen bg-[#0A0A0A] text-[#FAFAFA] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-[#111111] border-b border-[#2A2A2A] px-4 py-3 flex items-center justify-between z-10">
        <Logo size="sm" />
        {user && (
          <div className="text-sm text-[#6B6B6B] font-mono">
            {user.email}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="shrink-0 bg-[#111111] border-t border-[#2A2A2A] safe-area-pb z-10">
        <div className="max-w-md mx-auto flex justify-around py-1">
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-5 rounded-lg transition-all ${
                isActive
                  ? 'text-[#22D3EE] bg-[#22D3EE]/10'
                  : 'text-[#6B6B6B] hover:text-[#A1A1A1]'
              }`
            }
          >
            <MessageSquare size={22} />
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">对话</span>
          </NavLink>
          <NavLink
            to="/workspace"
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-5 rounded-lg transition-all ${
                isActive
                  ? 'text-[#22D3EE] bg-[#22D3EE]/10'
                  : 'text-[#6B6B6B] hover:text-[#A1A1A1]'
              }`
            }
          >
            <FolderOpen size={22} />
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">文件</span>
          </NavLink>
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-5 rounded-lg transition-all ${
                isActive
                  ? 'text-[#22D3EE] bg-[#22D3EE]/10'
                  : 'text-[#6B6B6B] hover:text-[#A1A1A1]'
              }`
            }
          >
            <User size={22} />
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">账户</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-5 rounded-lg transition-all ${
                isActive
                  ? 'text-[#22D3EE] bg-[#22D3EE]/10'
                  : 'text-[#6B6B6B] hover:text-[#A1A1A1]'
              }`
            }
          >
            <Settings size={22} />
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">设置</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
