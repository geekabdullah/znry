import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  HardHat,
  BarChart3,
  LogOut,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';
import { roleLabel } from '@/lib/constants';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, short: 'Home' },
  { to: '/activities', label: 'Activities & Requests', icon: FileText, short: 'Tasks' },
  { to: '/people', label: 'People & Offices', icon: Users, short: 'People' },
  { to: '/workers', label: 'Worker Registry', icon: HardHat, adminOnly: true, short: 'Workers' },
  { to: '/reports', label: 'Reports', icon: BarChart3, short: 'Reports' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'md';
  const visibleNav = nav.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen bg-sand-50">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-field-50 text-field-800'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-100 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar profile={profile} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink-900">
                {profile?.full_name}
              </div>
              <div className="truncate text-xs text-ink-500">
                {profile ? roleLabel(profile.role, profile.department) : ''}
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-sand-50/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-400">
              Operations workspace
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-ink-500 sm:inline">
              {new Date().toLocaleDateString('en-NG', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>
            <button className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </button>
            <Avatar profile={profile} size="sm" className="lg:hidden" />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">{children}</main>

        <nav className="pb-safe fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-ink-100 bg-white px-1 pt-1.5 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] lg:hidden">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-field-700' : 'text-ink-400'
                }`
              }
            >
              <item.icon className="h-[22px] w-[22px] shrink-0" />
              {item.short}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
