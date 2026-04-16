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
  ConfirmModal,
  FormField,
  TextInput,
  Textarea,
  Spinner,
  ErrorDisplay,
} from '../../components';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function FactionDetail() {
  const { id: campaignId, factionId } = useParams<{ id: string; factionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const campaignQuery = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });
  const isDm = campaignQuery.data?.campaign.my_role === 'dm';

  const { data, isLoading, error } = useQuery({
    queryKey: ['faction', campaignId, factionId, viewMode],
    queryFn: () => fetchFaction(campaignId!, factionId!, viewMode),
    enabled: !!campaignId && !!factionId,
  });
  const faction = data?.faction;

  // ─── Edit form state ────────────────────────────────────────────────────────
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
      updateFaction(campaignId!, factionId!, {
        name,
        description: description || undefined,
        goals: goals || undefined,
        alignment_tone: alignmentTone || undefined,
        dm_notes: dmNotes || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['faction', campaignId, factionId, viewMode], updated);
      void queryClient.invalidateQueries({ queryKey: ['factions', campaignId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFaction(campaignId!, factionId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['factions', campaignId] });
      navigate(`/campaigns/${campaignId}/factions`);
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading…
      </div>
    );
  }
  if (error || !faction) {
    return (
      <div className="p-8">
        <ErrorDisplay message="Failed to load faction." />
      </div>
    );
  }

  // ─── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit Faction</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" htmlFor="edit-faction-name" required>
              <TextInput
                id="edit-faction-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Alignment / Tone" htmlFor="edit-faction-alignment">
              <TextInput
                id="edit-faction-alignment"
                value={alignmentTone}
                onChange={(e) => setAlignmentTone(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Description" htmlFor="edit-faction-description">
            <Textarea
              id="edit-faction-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </FormField>

          <FormField label="Goals" htmlFor="edit-faction-goals">
            <Textarea
              id="edit-faction-goals"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
            />
          </FormField>

          {!isPlayerView && (
            <FormField
              label="DM Notes"
              htmlFor="edit-faction-dm-notes"
              hint="Visible to DMs only"
            >
              <Textarea
                id="edit-faction-dm-notes"
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={4}
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

  // ─── Read mode ──────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{faction.name}</h1>
          {faction.alignment_tone && (
            <p className="text-sm text-slate-400 mt-1">{faction.alignment_tone}</p>
          )}
        </div>

        {isDm && (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={openEdit}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-5">
        {faction.description && <Field label="Description" value={faction.description} />}
        {faction.goals && <Field label="Goals" value={faction.goals} />}
      </div>

      {faction.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{faction.dm_notes}</p>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmDelete(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Faction"
        message={`Delete "${faction.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        error={deleteMutation.error ? 'Failed to delete faction. Please try again.' : null}
      />
    </div>
  );
}
