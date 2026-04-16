import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCampaign } from '../lib/api';
import { useViewMode } from '../contexts/ViewModeContext';

const ENTITY_LINKS = [
  { to: 'sessions', label: 'Sessions' },
  { to: 'characters', label: 'Characters' },
  { to: 'npcs', label: 'NPCs' },
  { to: 'locations', label: 'Locations' },
  { to: 'factions', label: 'Factions' },
  { to: 'lore', label: 'Lore' },
] as const;

export default function CampaignLayout() {
  const { id } = useParams<{ id: string }>();
  const { viewMode, setViewMode } = useViewMode();

  const { data } = useQuery({
    queryKey: ['campaign', id, viewMode],
    queryFn: () => fetchCampaign(id!, viewMode),
    enabled: !!id,
  });

  const isDm = data?.campaign.my_role === 'dm';

  return (
    <div className="flex min-h-full">
      <aside className="w-48 shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col">
        <div className="px-3 py-3 border-b border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign</p>
          <p className="mt-1 text-sm font-medium text-gray-200 truncate">
            {data?.campaign.name ?? '…'}
          </p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          <NavLink
            to=""
            end
            className={({ isActive }) =>
              `flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            Overview
          </NavLink>
          {ENTITY_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {isDm && (
          <div className="px-3 py-3 border-t border-gray-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              View as
            </p>
            <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
              <button
                onClick={() => setViewMode('dm')}
                className={`flex-1 py-1.5 transition-colors ${
                  viewMode === 'dm'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                DM
              </button>
              <button
                onClick={() => setViewMode('player')}
                className={`flex-1 py-1.5 transition-colors ${
                  viewMode === 'player'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Player
              </button>
            </div>
            {viewMode === 'player' && (
              <p className="mt-1.5 text-xs text-amber-400">Player view active</p>
            )}
          </div>
        )}
      </aside>

      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
