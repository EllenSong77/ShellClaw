import { Outlet, NavLink } from 'react-router-dom';
import { User, Settings, FolderOpen, MessageSquare } from 'lucide-react';
import { Logo } from './Logo';
import { useAuthStore } from '../stores/auth';

export function Layout() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] flex flex-col">
      {/* Header */}
      <header className="bg-[#111111] border-b border-[#2A2A2A] px-4 py-3 flex items-center justify-between">
        <Logo size="sm" />
        {user && (
          <div className="text-sm text-[#6B6B6B] font-mono">
            {user.email}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="bg-[#111111] border-t border-[#2A2A2A] safe-area-pb">
        <div className="flex justify-around py-1">
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
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">Chat</span>
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
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">Files</span>
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
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">Account</span>
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
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">Settings</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
