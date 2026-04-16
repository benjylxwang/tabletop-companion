import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCampaign } from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { viewMode } = useViewMode();
  const { data, isLoading, error } = useQuery({
    queryKey: ['campaign', id, viewMode],
    queryFn: () => fetchCampaign(id!, viewMode),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-400">Failed to load campaign.</div>;

  const campaign = data?.campaign;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100">{campaign?.name}</h1>
      <p className="text-sm text-slate-400 mt-1">
        {campaign?.system} · <span className="text-amber-400">{campaign?.status}</span>
      </p>
      {campaign?.description && (
        <p className="mt-4 text-slate-300 leading-relaxed">{campaign.description}</p>
      )}
    </div>
  );
}
