import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchLoreEntry,
  updateLoreEntry,
  deleteLoreEntry,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  ConfirmModal,
  FormField,
  TextInput,
  Textarea,
  Select,
  Spinner,
  ErrorDisplay,
} from '../../components';
import type { LoreCategoryEnum, LoreVisibilityEnum } from '@tabletop/shared';
import { CategoryBadge, VisibilityBadge } from './LoreList';

const CATEGORY_OPTIONS: { value: LoreCategoryEnum; label: string }[] = [
  { value: 'History', label: 'History' },
  { value: 'Magic', label: 'Magic' },
  { value: 'Religion', label: 'Religion' },
  { value: 'Politics', label: 'Politics' },
];

const VISIBILITY_OPTIONS: { value: LoreVisibilityEnum; label: string }[] = [
  { value: 'Public', label: 'Public' },
  { value: 'Revealed', label: 'Revealed' },
  { value: 'Private', label: 'Private' },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function LoreDetail() {
  const { id: campaignId, loreId } = useParams<{ id: string; loreId: string }>();
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
    queryKey: ['lore-entry', campaignId, loreId, viewMode],
    queryFn: () => fetchLoreEntry(campaignId!, loreId!, viewMode),
    enabled: !!campaignId && !!loreId,
  });
  const entry = data?.lore;

  // ─── Edit form state ────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LoreCategoryEnum>('History');
  const [visibility, setVisibility] = useState<LoreVisibilityEnum>('Public');
  const [content, setContent] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  function openEdit() {
    if (!entry) return;
    setTitle(entry.title);
    setCategory(entry.category);
    setVisibility(entry.visibility);
    setContent(entry.content ?? '');
    setDmNotes(entry.dm_notes ?? '');
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateLoreEntry(campaignId!, loreId!, {
        title,
        category,
        visibility,
        content: content || undefined,
        dm_notes: dmNotes || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['lore-entry', campaignId, loreId, viewMode], updated);
      void queryClient.invalidateQueries({ queryKey: ['lore', campaignId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLoreEntry(campaignId!, loreId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lore', campaignId] });
      navigate(`/campaigns/${campaignId}/lore`);
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading…
      </div>
    );
  }

  // Private entries return 404 for players — show a graceful not-found state
  if (error) {
    return (
      <div className="p-8">
        <ErrorDisplay message="This lore entry could not be found or is not available." />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="p-8">
        <ErrorDisplay message="Lore entry not found." />
      </div>
    );
  }

  // ─── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit Lore Entry</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Title" htmlFor="edit-lore-title" required>
            <TextInput
              id="edit-lore-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category" htmlFor="edit-lore-category">
              <Select
                id="edit-lore-category"
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={(v) => setCategory(v as LoreCategoryEnum)}
              />
            </FormField>

            {!isPlayerView && (
              <FormField label="Visibility" htmlFor="edit-lore-visibility">
                <Select
                  id="edit-lore-visibility"
                  options={VISIBILITY_OPTIONS}
                  value={visibility}
                  onChange={(v) => setVisibility(v as LoreVisibilityEnum)}
                />
              </FormField>
            )}
          </div>

          <FormField label="Content" htmlFor="edit-lore-content">
            <Textarea
              id="edit-lore-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          </FormField>

          {!isPlayerView && (
            <FormField
              label="DM Notes"
              htmlFor="edit-lore-dm-notes"
              hint="Visible to DMs only"
            >
              <Textarea
                id="edit-lore-dm-notes"
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={3}
              />
            </FormField>
          )}

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to update lore entry. Please try again.
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
          <h1 className="text-2xl font-bold text-slate-100">{entry.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <CategoryBadge category={entry.category} />
            {!isPlayerView && <VisibilityBadge visibility={entry.visibility} />}
          </div>
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
        {entry.content && <Field label="Content" value={entry.content} />}
      </div>

      {entry.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{entry.dm_notes}</p>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmDelete(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Lore Entry"
        message={`Delete "${entry.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        error={deleteMutation.error ? 'Failed to delete lore entry. Please try again.' : null}
      />
    </div>
  );
}
