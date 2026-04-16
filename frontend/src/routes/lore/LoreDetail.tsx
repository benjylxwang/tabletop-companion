import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLoreEntry, updateLoreEntry, deleteLoreEntry } from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  ConfirmModal,
  FormField,
  Modal,
  Select,
  Spinner,
  Textarea,
  TextInput,
  ErrorDisplay,
} from '../../components';
import type { LoreCategoryEnum, LoreVisibilityEnum } from '@tabletop/shared';

const CATEGORY_OPTIONS: { value: LoreCategoryEnum; label: string }[] = [
  { value: 'History', label: 'History' },
  { value: 'Magic', label: 'Magic' },
  { value: 'Religion', label: 'Religion' },
  { value: 'Politics', label: 'Politics' },
];

const VISIBILITY_OPTIONS: { value: LoreVisibilityEnum; label: string }[] = [
  { value: 'Public', label: 'Public — visible to all players' },
  { value: 'Private', label: 'Private — DM only' },
];

const CATEGORY_COLORS: Record<LoreCategoryEnum, string> = {
  History: 'bg-amber-900/40 text-amber-300',
  Magic: 'bg-violet-900/40 text-violet-300',
  Religion: 'bg-sky-900/40 text-sky-300',
  Politics: 'bg-rose-900/40 text-rose-300',
};

export default function LoreDetail() {
  const { id: campaignId, loreId } = useParams<{ id: string; loreId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['lore-entry', campaignId, loreId, viewMode],
    queryFn: () => fetchLoreEntry(campaignId!, loreId!, viewMode),
    enabled: !!campaignId && !!loreId,
  });

  const entry = data?.lore;

  // ─── Edit form state ────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LoreCategoryEnum>('History');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<LoreVisibilityEnum>('Public');
  const [dmNotes, setDmNotes] = useState('');

  function openEdit() {
    if (!entry) return;
    setTitle(entry.title);
    setCategory(entry.category as LoreCategoryEnum);
    setContent(entry.content ?? '');
    setVisibility(entry.visibility as LoreVisibilityEnum);
    setDmNotes((entry as { dm_notes?: string }).dm_notes ?? '');
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateLoreEntry(campaignId!, loreId!, {
        title,
        category,
        content: content || undefined,
        visibility,
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

  // ─── Loading / error states ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading…
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="p-8">
        <Link
          to={`/campaigns/${campaignId}/lore`}
          className="text-sm text-amber-400 hover:text-amber-300 mb-4 inline-block"
        >
          ← Back to Lore
        </Link>
        <ErrorDisplay message="This lore entry could not be found." />
      </div>
    );
  }

  const entryWithDm = entry as typeof entry & { dm_notes?: string };

  return (
    <div className="p-8 max-w-3xl">
      {/* Back nav */}
      <Link
        to={`/campaigns/${campaignId}/lore`}
        className="text-sm text-amber-400 hover:text-amber-300 mb-6 inline-block"
      >
        ← Back to Lore
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                CATEGORY_COLORS[entry.category as LoreCategoryEnum] ?? 'bg-slate-800 text-slate-300'
              }`}
            >
              {entry.category}
            </span>
            {!isPlayerView && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  entry.visibility === 'Private'
                    ? 'bg-amber-900/40 text-amber-400'
                    : 'bg-emerald-900/40 text-emerald-400'
                }`}
              >
                {entry.visibility}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{entry.title}</h1>
        </div>

        {!isPlayerView && (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" onClick={openEdit}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => setShowDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {entry.content ? (
        <p className="text-slate-300 whitespace-pre-wrap leading-relaxed mb-8">{entry.content}</p>
      ) : (
        <p className="text-slate-500 italic mb-8">No content yet.</p>
      )}

      {/* DM Notes (DM only) */}
      {!isPlayerView && entryWithDm.dm_notes && (
        <div className="mt-6 p-4 rounded-lg border border-amber-800/40 bg-amber-900/10">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-2">
            DM Notes
          </h3>
          <p className="text-slate-300 text-sm whitespace-pre-wrap">{entryWithDm.dm_notes}</p>
        </div>
      )}

      {/* Edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Lore Entry">
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

          <FormField label="Category" htmlFor="edit-lore-category">
            <Select
              id="edit-lore-category"
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={(v) => setCategory(v as LoreCategoryEnum)}
            />
          </FormField>

          <FormField label="Content" htmlFor="edit-lore-content">
            <Textarea
              id="edit-lore-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          </FormField>

          <FormField label="Visibility" htmlFor="edit-lore-visibility">
            <Select
              id="edit-lore-visibility"
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={(v) => setVisibility(v as LoreVisibilityEnum)}
            />
          </FormField>

          <FormField label="DM Notes" htmlFor="edit-lore-dm-notes">
            <Textarea
              id="edit-lore-dm-notes"
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={3}
            />
          </FormField>

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to save changes. Please try again.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Lore Entry"
        message={`Delete "${entry.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
