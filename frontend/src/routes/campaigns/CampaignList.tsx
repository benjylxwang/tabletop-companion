import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { fetchCampaigns, createCampaign, fetchMyInvitations, acceptInvitation, declineInvitation } from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import { useSignedUrl } from '../../lib/useSignedUrl';
import {
  Button,
  Modal,
  FormField,
  TextInput,
  Textarea,
  Select,
  EmptyState,
  ErrorDisplay,
} from '../../components';
import type { CampaignCreate, CampaignStatusEnum, CampaignWithRole } from '@tabletop/shared';

const STATUS_OPTIONS: { value: CampaignStatusEnum; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Hiatus', label: 'Hiatus' },
  { value: 'Complete', label: 'Complete' },
];

function CreateCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [system, setSystem] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CampaignStatusEnum>('Active');

  const mutation = useMutation({
    mutationFn: (data: CampaignCreate) => createCampaign(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      onClose();
      setName('');
      setSystem('');
      setDescription('');
      setStatus('Active');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ name, system: system || undefined, description: description || undefined, status });
  }

  return (
    <Modal open={open} onClose={onClose} title="New Campaign">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" htmlFor="campaign-name" required>
          <TextInput
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="The Lost Mines of Phandelver"
          />
        </FormField>

        <FormField label="System" htmlFor="campaign-system">
          <TextInput
            id="campaign-system"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            placeholder="D&D 5e, Pathfinder 2e, …"
          />
        </FormField>

        <FormField label="Description" htmlFor="campaign-description">
          <Textarea
            id="campaign-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="A short description of the campaign…"
          />
        </FormField>

        <FormField label="Status" htmlFor="campaign-status">
          <Select
            id="campaign-status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v as CampaignStatusEnum)}
          />
        </FormField>

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            Failed to create campaign. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Create Campaign
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PendingInvitations() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: fetchMyInvitations,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptInvitation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => declineInvitation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  if (isLoading || !data || data.invitations.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-slate-300 mb-3">Pending Invitations</h2>
      <ul className="space-y-2">
        {data.invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-slate-900 px-5 py-4"
          >
            <div>
              <p className="font-semibold text-slate-100">{inv.campaign_name}</p>
              <p className="text-sm text-slate-400 mt-0.5">
                {inv.campaign_system && `${inv.campaign_system} · `}{inv.campaign_status}
              </p>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <Button
                size="sm"
                onClick={() => acceptMutation.mutate(inv.id)}
                isLoading={acceptMutation.isPending && acceptMutation.variables === inv.id}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => declineMutation.mutate(inv.id)}
                isLoading={declineMutation.isPending && declineMutation.variables === inv.id}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignWithRole }) {
  const { url: coverUrl, isLoading } = useSignedUrl(campaign.cover_image_url);

  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-amber-500/50 hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      {/* Cover image banner */}
      <div className="aspect-video bg-slate-800 overflow-hidden shrink-0">
        {campaign.cover_image_url && isLoading ? (
          <div className="w-full h-full animate-pulse bg-slate-700" />
        ) : coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={36} className="text-slate-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-slate-100 leading-snug">{campaign.name}</p>
          <span className="text-xs text-amber-400 uppercase tracking-wide shrink-0 mt-0.5">
            {campaign.my_role}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          {campaign.system && `${campaign.system} · `}{campaign.status}
        </p>
        {campaign.description && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
            {campaign.description}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function CampaignList() {
  const { viewMode } = useViewMode();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['campaigns', viewMode],
    queryFn: () => fetchCampaigns(viewMode),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Campaigns</h1>
          <p className="text-sm text-slate-400 mt-0.5">Your tabletop adventures</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Campaign</Button>
      </div>

      <PendingInvitations />

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <ErrorDisplay message="Failed to load campaigns." />}

      {data && data.campaigns.length === 0 && (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to get started."
          action={{ label: 'New Campaign', onClick: () => setShowCreate(true) }}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>

      <CreateCampaignModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
