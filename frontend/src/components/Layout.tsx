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
  MapPin,
  ScrollText,
  Shield,
  User,
} from 'lucide-react';
import { fetchCampaign } from '../lib/api';
import { useViewMode } from '../contexts/ViewModeContext';

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
          'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
          isActive
            ? 'border-l-2 border-amber-500 bg-amber-500/10 text-amber-400 pl-[6px]'
            : 'border-l-2 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100',
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
  if (collapsed) return <div className="my-1 h-px bg-slate-800 mx-2" />;
  return (
    <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
      {label}
    </p>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export default function Layout() {
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed);
  const { viewMode, setViewMode } = useViewMode();

  const campaignMatch = useMatch('/campaigns/:id/*') ?? useMatch('/campaigns/:id');
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
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* ── Sidebar ── */}
      <aside
        className={[
          'flex shrink-0 flex-col border-r border-slate-800 bg-slate-900',
          'transition-[width] duration-200 ease-in-out overflow-hidden',
          collapsed ? 'w-14' : 'w-60',
        ].join(' ')}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex h-14 items-center border-b border-slate-800 px-3">
          {/* Logo placeholder — replace with <img> once asset exists */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-400 font-bold text-sm select-none">
            TC
          </div>
          {!collapsed && (
            <span className="ml-3 font-semibold tracking-tight text-amber-400 truncate">
              Tabletop Companion
            </span>
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

        {/* DM / Player toggle — only shown for DMs inside a campaign */}
        {campaignId && isDm && (
          <div className="border-t border-slate-800 px-2 py-3">
            {!collapsed && (
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                View as
              </p>
            )}
            <div
              className="flex rounded-md overflow-hidden border border-slate-700 text-xs"
              role="group"
              aria-label="View mode toggle"
            >
              <button
                onClick={() => setViewMode('dm')}
                title="DM View"
                aria-pressed={viewMode === 'dm'}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  viewMode === 'dm'
                    ? 'bg-amber-500/20 text-amber-400 font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-100',
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
                  'flex flex-1 items-center justify-center gap-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  viewMode === 'player'
                    ? 'bg-amber-500/20 text-amber-400 font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-100',
                ].join(' ')}
              >
                <EyeOff size={14} />
                {!collapsed && <span>Player</span>}
              </button>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="border-t border-slate-800 px-2 py-2">
          <button
            onClick={toggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center justify-center rounded-md py-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
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
