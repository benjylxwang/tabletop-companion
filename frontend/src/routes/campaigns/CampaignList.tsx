import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchCampaigns } from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';

export default function CampaignList() {
  const { viewMode } = useViewMode();
  const { data, isLoading, error } = useQuery({
    queryKey: ['campaigns', viewMode],
    queryFn: () => fetchCampaigns(viewMode),
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Campaigns</h1>
      <p className="text-sm text-slate-400 mb-6">Your tabletop adventures</p>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <p className="text-red-400">Failed to load campaigns.</p>}
      {data && data.campaigns.length === 0 && (
        <p className="text-slate-400">No campaigns yet.</p>
      )}

      <ul className="space-y-3 max-w-2xl">
        {data?.campaigns.map((c) => (
          <li key={c.id}>
            <Link
              to={`/campaigns/${c.id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <p className="font-semibold text-slate-100">{c.name}</p>
              <p className="text-sm text-slate-400 mt-0.5">{c.system} · {c.status}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
