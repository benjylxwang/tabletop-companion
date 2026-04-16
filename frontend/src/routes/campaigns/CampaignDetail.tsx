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

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-400">Failed to load campaign.</div>;

  const campaign = data?.campaign;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-100">{campaign?.name}</h1>
      <p className="text-sm text-gray-400 mt-1">{campaign?.system} · {campaign?.status}</p>
      {campaign?.description && (
        <p className="mt-4 text-gray-300">{campaign.description}</p>
      )}
    </div>
  );
}
