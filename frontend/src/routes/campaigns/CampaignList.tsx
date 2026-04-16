import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCampaigns, createCampaign } from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
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
import type { CampaignCreate, CampaignStatusEnum } from '@tabletop/shared';

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

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <ErrorDisplay message="Failed to load campaigns." />}

      {data && data.campaigns.length === 0 && (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to get started."
          action={{ label: 'New Campaign', onClick: () => setShowCreate(true) }}
        />
      )}

      <ul className="space-y-3 max-w-2xl">
        {data?.campaigns.map((c) => (
          <li key={c.id}>
            <Link
              to={`/campaigns/${c.id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-100">{c.name}</p>
                <span className="text-xs text-amber-400 uppercase tracking-wide">{c.my_role}</span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {c.system && `${c.system} · `}{c.status}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <CreateCampaignModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
