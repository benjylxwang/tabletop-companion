import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCampaign, fetchFactions, createFaction } from '../../lib/api';
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

const ALIGNMENT_OPTIONS = [
  { value: '', label: 'Unknown' },
  { value: 'Helpful', label: 'Helpful' },
  { value: 'Neutral', label: 'Neutral' },
  { value: 'Hostile', label: 'Hostile' },
  { value: 'Secretive', label: 'Secretive' },
];

function CreateFactionModal({
  open,
  onClose,
  campaignId,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
}) {
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [alignmentTone, setAlignmentTone] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createFaction(campaignId, {
        campaign_id: campaignId,
        name,
        description: description || undefined,
        goals: goals || undefined,
        alignment_tone: alignmentTone || undefined,
        dm_notes: dmNotes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['factions', campaignId, viewMode] });
      onClose();
      setName('');
      setDescription('');
      setGoals('');
      setAlignmentTone('');
      setDmNotes('');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Faction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" htmlFor="faction-name" required>
          <TextInput
            id="faction-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="The Iron Circle"
          />
        </FormField>

        <FormField label="Description" htmlFor="faction-description">
          <Textarea
            id="faction-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="A brief description of this faction…"
          />
        </FormField>

        <FormField label="Goals" htmlFor="faction-goals">
          <Textarea
            id="faction-goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={2}
            placeholder="What does this faction want?"
          />
        </FormField>

        <FormField label="Alignment / Tone" htmlFor="faction-alignment">
          <Select
            id="faction-alignment"
            options={ALIGNMENT_OPTIONS}
            value={alignmentTone}
            onChange={(v) => setAlignmentTone(v)}
          />
        </FormField>

        {!isPlayerView && (
          <FormField label="DM Notes" htmlFor="faction-dm-notes" hint="Visible to DMs only">
            <Textarea
              id="faction-dm-notes"
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={3}
              placeholder="Secret plans, hidden leadership, true agenda…"
            />
          </FormField>
        )}

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            Failed to create faction. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Create Faction
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FactionList() {
  const { id } = useParams<{ id: string }>();
  const { viewMode, isPlayerView } = useViewMode();
  const [showCreate, setShowCreate] = useState(false);

  const { data: campaignData } = useQuery({
    queryKey: ['campaign', id, viewMode],
    queryFn: () => fetchCampaign(id!, viewMode),
    enabled: !!id,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['factions', id, viewMode],
    queryFn: () => fetchFactions(id!, viewMode),
    enabled: !!id,
  });

  const isDm = campaignData?.campaign.my_role === 'dm';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Factions</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Organisations shaping the political and social landscape
          </p>
        </div>
        {isDm && !isPlayerView && (
          <Button onClick={() => setShowCreate(true)}>New Faction</Button>
        )}
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <ErrorDisplay message="Failed to load factions." />}

      {data && data.factions.length === 0 && (
        <EmptyState
          title="No factions yet"
          description={
            isDm && !isPlayerView
              ? 'Create the first faction.'
              : 'No factions have been added yet.'
          }
          action={
            isDm && !isPlayerView
              ? { label: 'New Faction', onClick: () => setShowCreate(true) }
              : undefined
          }
        />
      )}

      <ul className="space-y-3 max-w-2xl">
        {data?.factions.map((f) => (
          <li key={f.id}>
            <Link
              to={`/campaigns/${id}/factions/${f.id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-100">{f.name}</p>
                {f.alignment_tone && (
                  <span className="shrink-0 text-xs font-medium text-amber-400 uppercase tracking-wide">
                    {f.alignment_tone}
                  </span>
                )}
              </div>
              {f.goals && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{f.goals}</p>
              )}
              {!f.goals && f.description && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{f.description}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {id && (
        <CreateFactionModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          campaignId={id}
        />
      )}
    </div>
  );
}
