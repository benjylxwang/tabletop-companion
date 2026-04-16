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
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Campaigns</h1>
      {isLoading && <p className="text-gray-400">Loading…</p>}
      {error && <p className="text-red-400">Failed to load campaigns.</p>}
      {data && data.campaigns.length === 0 && (
        <p className="text-gray-400">No campaigns yet.</p>
      )}
      <ul className="space-y-3">
        {data?.campaigns.map((c) => (
          <li key={c.id}>
            <Link
              to={`/campaigns/${c.id}`}
              className="block rounded-lg border border-gray-700 bg-gray-800 px-5 py-4 hover:border-indigo-500 transition-colors"
            >
              <p className="font-semibold text-gray-100">{c.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">{c.system} · {c.status}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
