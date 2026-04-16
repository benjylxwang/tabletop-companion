import { useState } from 'react';
import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Ghost,
  LayoutDashboard,
  LogOut,
  MapPin,
  ScrollText,
  Shield,
  User,
} from 'lucide-react';
import { fetchCampaign } from '../lib/api';
import { useViewMode } from '../contexts/ViewModeContext';
import { useAIProvider } from '../contexts/AIProviderContext';
import logoIcon from '../assets/logo-icon.svg';
import logoWordmark from '../assets/logo-wordmark.svg';
import { useAuth } from '../lib/auth';

// ─── Persistence ──────────────────────────────────────────────────────────────

const COLLAPSE_KEY = 'tabletop-sidebar-collapsed';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

// ─── Nav item helpers ─────────────────────────────────────────────────────────

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  end?: boolean;
}

function NavItem({ to, icon, label, collapsed, end = false }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500',
          isActive
            ? 'border-l-2 border-red-800 bg-[rgba(212,160,23,0.12)] text-[#d4a017] pl-[6px]'
            : 'border-l-2 border-transparent text-[#b8860b] hover:bg-[#2a1a0a] hover:text-[#f5f0e0]',
        ].join(' ')
      }
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-1 h-px bg-[#3d2a10] mx-2" />;
  return (
    <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#b8860b]">
      {label}
    </p>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export default function Layout() {
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed);
  const { viewMode, setViewMode } = useViewMode();
  const { provider, setProvider } = useAIProvider();
  const { user, signOut } = useAuth();

  const campaignMatch = useMatch('/campaigns/:id/*');
  const campaignId = campaignMatch?.params.id;

  const { data: campaignData } = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const isDm = campaignData?.campaign.my_role === 'dm';

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  }

  const iconSize = 18;

  return (
    <div className="flex min-h-screen bg-[#0a0706] text-[#f5f0e0]">
      {/* ── Sidebar ── */}
      <aside
        className={[
          'flex shrink-0 flex-col border-r border-[#3d2a10] bg-[#1a1008]',
          'transition-[width] duration-200 ease-in-out overflow-hidden',
          collapsed ? 'w-14' : 'w-60',
        ].join(' ')}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex h-14 items-center border-b border-[#3d2a10] px-3">
          {collapsed ? (
            <button
              onClick={toggleCollapse}
              aria-expanded={false}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="flex shrink-0 items-center justify-center rounded-md transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
            >
              <img src={logoIcon} alt="Tabletop Companion" className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <img src={logoIcon} alt="Tabletop Companion" className="h-8 w-8 shrink-0" />
          )}
          {!collapsed && (
            <>
              <img src={logoWordmark} alt="Tabletop Companion" className="ml-3 h-5 min-w-0" />
              <div className="flex-1" />
            </>
          )}
          {!collapsed && (
            <button
              onClick={toggleCollapse}
              aria-expanded={!collapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="flex shrink-0 items-center justify-center rounded-md p-1 text-[#b8860b] transition-colors hover:bg-[#2a1a0a] hover:text-[#f5f0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          <SectionLabel label="Library" collapsed={collapsed} />
          <NavItem
            to="/campaigns"
            icon={<BookOpen size={iconSize} />}
            label="Campaigns"
            collapsed={collapsed}
          />

          {campaignId && (
            <>
              <SectionLabel label="Campaign" collapsed={collapsed} />
              <NavItem
                to={`/campaigns/${campaignId}`}
                icon={<LayoutDashboard size={iconSize} />}
                label="Overview"
                collapsed={collapsed}
                end
              />
              <NavItem
                to={`/campaigns/${campaignId}/sessions`}
                icon={<ScrollText size={iconSize} />}
                label="Sessions"
                collapsed={collapsed}
              />
              <NavItem
                to={`/campaigns/${campaignId}/characters`}
                icon={<User size={iconSize} />}
                label="Characters"
                collapsed={collapsed}
              />
              <NavItem
                to={`/campaigns/${campaignId}/npcs`}
                icon={<Ghost size={iconSize} />}
                label="NPCs"
                collapsed={collapsed}
              />
              <NavItem
                to={`/campaigns/${campaignId}/locations`}
                icon={<MapPin size={iconSize} />}
                label="Locations"
                collapsed={collapsed}
              />
              <NavItem
                to={`/campaigns/${campaignId}/factions`}
                icon={<Shield size={iconSize} />}
                label="Factions"
                collapsed={collapsed}
              />
              <NavItem
                to={`/campaigns/${campaignId}/lore`}
                icon={<BookMarked size={iconSize} />}
                label="Lore"
                collapsed={collapsed}
              />
            </>
          )}
        </nav>

        {/* AI provider toggle — only shown for DMs inside a campaign */}
        {campaignId && isDm && (
          <div className="border-t border-[#3d2a10] px-2 py-3">
            {!collapsed && (
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b8860b]">
                AI Provider
              </p>
            )}
            <div
              className="flex rounded-md overflow-hidden border border-[#3d2a10] text-xs"
              role="group"
              aria-label="AI provider toggle"
            >
              <button
                onClick={() => setProvider('anthropic')}
                title="Claude (Anthropic)"
                aria-pressed={provider === 'anthropic'}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500',
                  provider === 'anthropic'
                    ? 'bg-[rgba(212,160,23,0.12)] text-[#d4a017] font-semibold'
                    : 'bg-[#2a1a0a] text-[#b8860b] hover:text-[#f5f0e0]',
                ].join(' ')}
              >
                {!collapsed && <span>Claude</span>}
                {collapsed && <span title="Claude">C</span>}
              </button>
              <button
                onClick={() => setProvider('deepinfra')}
                title="DeepInfra"
                aria-pressed={provider === 'deepinfra'}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500',
                  provider === 'deepinfra'
                    ? 'bg-[rgba(212,160,23,0.12)] text-[#d4a017] font-semibold'
                    : 'bg-[#2a1a0a] text-[#b8860b] hover:text-[#f5f0e0]',
                ].join(' ')}
              >
                {!collapsed && <span>DeepInfra</span>}
                {collapsed && <span title="DeepInfra">D</span>}
              </button>
            </div>
          </div>
        )}

        {/* DM / Player toggle — only shown for DMs inside a campaign */}
        {campaignId && isDm && (
          <div className="border-t border-[#3d2a10] px-2 py-3">
            {!collapsed && (
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b8860b]">
                View as
              </p>
            )}
            <div
              className="flex rounded-md overflow-hidden border border-[#3d2a10] text-xs"
              role="group"
              aria-label="View mode toggle"
            >
              <button
                onClick={() => setViewMode('dm')}
                title="DM View"
                aria-pressed={viewMode === 'dm'}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500',
                  viewMode === 'dm'
                    ? 'bg-[rgba(212,160,23,0.12)] text-[#d4a017] font-semibold'
                    : 'bg-[#2a1a0a] text-[#b8860b] hover:text-[#f5f0e0]',
                ].join(' ')}
              >
                <Eye size={14} />
                {!collapsed && <span>DM</span>}
              </button>
              <button
                onClick={() => setViewMode('player')}
                title="Player View"
                aria-pressed={viewMode === 'player'}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500',
                  viewMode === 'player'
                    ? 'bg-[rgba(212,160,23,0.12)] text-[#d4a017] font-semibold'
                    : 'bg-[#2a1a0a] text-[#b8860b] hover:text-[#f5f0e0]',
                ].join(' ')}
              >
                <EyeOff size={14} />
                {!collapsed && <span>Player</span>}
              </button>
            </div>
          </div>
        )}

        {/* Account / sign out */}
        <div className="border-t border-[#3d2a10] px-2 py-2">
          {!collapsed && user?.email && (
            <p
              className="mb-1 truncate px-2 text-[11px] text-[#b8860b]"
              title={user.email}
            >
              {user.email}
            </p>
          )}
          <button
            onClick={() => signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-[#b8860b] transition-colors hover:bg-[#2a1a0a] hover:text-[#f5f0e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
          >
            <LogOut size={iconSize} className="shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
