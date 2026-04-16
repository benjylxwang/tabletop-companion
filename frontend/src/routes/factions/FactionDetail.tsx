import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchFaction,
  updateFaction,
  deleteFaction,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  FormField,
  TextInput,
  Textarea,
  Select,
  Spinner,
  ErrorDisplay,
} from '../../components';

const ALIGNMENT_OPTIONS = [
  { value: '', label: 'Unknown' },
  { value: 'Helpful', label: 'Helpful' },
  { value: 'Neutral', label: 'Neutral' },
  { value: 'Hostile', label: 'Hostile' },
  { value: 'Secretive', label: 'Secretive' },
];

export default function FactionDetail() {
  const { id, factionId } = useParams<{ id: string; factionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [editing, setEditing] = useState(false);

  const { data: campaignData } = useQuery({
    queryKey: ['campaign', id, viewMode],
    queryFn: () => fetchCampaign(id!, viewMode),
    enabled: !!id,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['faction', id, factionId, viewMode],
    queryFn: () => fetchFaction(id!, factionId!, viewMode),
    enabled: !!id && !!factionId,
  });

  const faction = data?.faction;
  const isDm = campaignData?.campaign.my_role === 'dm';

  // ─── Edit form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [alignmentTone, setAlignmentTone] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  function openEdit() {
    if (!faction) return;
    setName(faction.name);
    setDescription(faction.description ?? '');
    setGoals(faction.goals ?? '');
    setAlignmentTone(faction.alignment_tone ?? '');
    setDmNotes(faction.dm_notes ?? '');
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateFaction(id!, factionId!, {
        name,
        description: description || undefined,
        goals: goals || undefined,
        alignment_tone: alignmentTone || undefined,
        dm_notes: dmNotes || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['faction', id, factionId, viewMode], updated);
      void queryClient.invalidateQueries({ queryKey: ['factions', id, viewMode] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFaction(id!, factionId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['factions', id, viewMode] });
      navigate(`/campaigns/${id}/factions`);
    },
  });

  function handleDelete() {
    if (window.confirm('Delete this faction? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  }

  // ─── Loading / error states ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading…
      </div>
    );
  }
  if (error || !faction) {
    return <div className="p-8"><ErrorDisplay message="Failed to load faction." /></div>;
  }

  // ─── Edit mode ───────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit Faction</h1>
        <form
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
          className="space-y-4"
        >
          <FormField label="Name" htmlFor="edit-name" required>
            <TextInput
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Description" htmlFor="edit-description">
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </FormField>

          <FormField label="Goals" htmlFor="edit-goals">
            <Textarea
              id="edit-goals"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              placeholder="What does this faction want?"
            />
          </FormField>

          <FormField label="Alignment / Tone" htmlFor="edit-alignment">
            <Select
              id="edit-alignment"
              options={ALIGNMENT_OPTIONS}
              value={alignmentTone}
              onChange={(v) => setAlignmentTone(v)}
            />
          </FormField>

          {!isPlayerView && (
            <FormField label="DM Notes" htmlFor="edit-dm-notes" hint="Visible to DMs only">
              <Textarea
                id="edit-dm-notes"
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={4}
                placeholder="Secret plans, hidden leadership, true agenda…"
              />
            </FormField>
          )}

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to update faction. Please try again.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ─── Read mode ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{faction.name}</h1>
          {faction.alignment_tone && (
            <p className="text-sm text-amber-400 mt-1 uppercase tracking-wide font-medium">
              {faction.alignment_tone}
            </p>
          )}
        </div>

        {isDm && (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={openEdit}>
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {faction.description && (
        <p className="mt-4 text-slate-300 leading-relaxed">{faction.description}</p>
      )}

      {faction.goals && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Goals
          </h2>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{faction.goals}</p>
        </div>
      )}

      {faction.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{faction.dm_notes}</p>
        </div>
      )}
    </div>
  );
}
