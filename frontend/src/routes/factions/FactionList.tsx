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
  EmptyState,
  ErrorDisplay,
} from '../../components';

function CreateFactionModal({
  campaignId,
  open,
  onClose,
  isDm,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
  isDm: boolean;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [alignmentTone, setAlignmentTone] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createFaction(campaignId, {
        name,
        description: description || undefined,
        goals: goals || undefined,
        alignment_tone: alignmentTone || undefined,
        dm_notes: dmNotes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['factions', campaignId] });
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
    <Modal open={open} onClose={onClose} title="New Faction" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Name" htmlFor="faction-name" required>
            <TextInput
              id="faction-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="The Iron Pact"
            />
          </FormField>

          <FormField label="Alignment / Tone" htmlFor="faction-alignment">
            <TextInput
              id="faction-alignment"
              value={alignmentTone}
              onChange={(e) => setAlignmentTone(e.target.value)}
              placeholder="Lawful Neutral, Sinister, …"
            />
          </FormField>
        </div>

        <FormField label="Description" htmlFor="faction-description">
          <Textarea
            id="faction-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Who they are and what they stand for…"
          />
        </FormField>

        <FormField label="Goals" htmlFor="faction-goals">
          <Textarea
            id="faction-goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={2}
            placeholder="What they are trying to accomplish…"
          />
        </FormField>

        {isDm && viewMode === 'dm' && (
          <FormField
            label="DM Notes"
            htmlFor="faction-dm-notes"
            hint="Visible to DMs only — true motives, hidden agenda"
          >
            <Textarea
              id="faction-dm-notes"
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={3}
              placeholder="What they're really after…"
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
  const { id: campaignId } = useParams<{ id: string }>();
  const { viewMode } = useViewMode();
  const [showCreate, setShowCreate] = useState(false);

  const campaignQuery = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });
  const isDm = campaignQuery.data?.campaign.my_role === 'dm';

  const { data, isLoading, error } = useQuery({
    queryKey: ['factions', campaignId, viewMode],
    queryFn: () => fetchFactions(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Factions</h1>
          <p className="text-sm text-slate-400 mt-0.5">The powers that shape the world</p>
        </div>
        {isDm && <Button onClick={() => setShowCreate(true)}>New Faction</Button>}
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <ErrorDisplay message="Failed to load factions." />}

      {data && data.factions.length === 0 && (
        <EmptyState
          title="No factions yet"
          description={
            isDm
              ? 'Create your first faction to define the political landscape.'
              : 'No factions have been introduced yet.'
          }
          action={isDm ? { label: 'New Faction', onClick: () => setShowCreate(true) } : undefined}
        />
      )}

      {data && data.factions.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
          {data.factions.map((f) => (
            <li key={f.id}>
              <Link
                to={`/campaigns/${campaignId}/factions/${f.id}`}
                className="block h-full rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <p className="font-semibold text-slate-100">{f.name}</p>
                {f.alignment_tone && (
                  <p className="text-sm text-slate-400 mt-1">{f.alignment_tone}</p>
                )}
                {f.description && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{f.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {campaignId && (
        <CreateFactionModal
          campaignId={campaignId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          isDm={!!isDm}
        />
      )}
    </div>
  );
}
