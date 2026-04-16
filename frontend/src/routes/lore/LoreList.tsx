import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCampaign, fetchLores, createLore } from '../../lib/api';
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
import type { LoreCategoryEnum, LoreVisibilityEnum, LoreCreate } from '@tabletop/shared';

// ─── Option lists ─────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: LoreCategoryEnum; label: string }[] = [
  { value: 'History', label: 'History' },
  { value: 'Magic', label: 'Magic' },
  { value: 'Religion', label: 'Religion' },
  { value: 'Politics', label: 'Politics' },
];

const VISIBILITY_OPTIONS: { value: LoreVisibilityEnum; label: string }[] = [
  { value: 'Public', label: 'Public' },
  { value: 'Private', label: 'Private' },
  { value: 'Revealed', label: 'Revealed' },
];

// ─── Badge styles ─────────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<LoreCategoryEnum, string> = {
  History: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Magic: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Religion: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Politics: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

const VISIBILITY_BADGE: Record<LoreVisibilityEnum, string> = {
  Public: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Private: 'bg-red-500/10 text-red-400 border-red-500/30',
  Revealed: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

export function CategoryBadge({ category }: { category: LoreCategoryEnum }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[category]}`}
    >
      {category}
    </span>
  );
}

export function VisibilityBadge({ visibility }: { visibility: LoreVisibilityEnum }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_BADGE[visibility]}`}
    >
      {visibility}
    </span>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateLoreModal({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LoreCategoryEnum>('History');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<LoreVisibilityEnum>('Public');
  const [dmNotes, setDmNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data: LoreCreate) => createLore(campaignId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lores', campaignId] });
      onClose();
      setTitle('');
      setCategory('History');
      setContent('');
      setVisibility('Public');
      setDmNotes('');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      campaign_id: campaignId,
      title,
      category,
      content: content || undefined,
      visibility,
      dm_notes: dmNotes || undefined,
    });
  }

  const isPlayerView = viewMode === 'player';

  return (
    <Modal open={open} onClose={onClose} title="New Lore Entry" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" htmlFor="lore-title" required>
          <TextInput
            id="lore-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="The Fall of the Meridian Empire"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Category" htmlFor="lore-category">
            <Select
              id="lore-category"
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={(v) => setCategory(v as LoreCategoryEnum)}
            />
          </FormField>

          <FormField label="Visibility" htmlFor="lore-visibility">
            <Select
              id="lore-visibility"
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={(v) => setVisibility(v as LoreVisibilityEnum)}
            />
          </FormField>
        </div>

        <FormField label="Content" htmlFor="lore-content">
          <Textarea
            id="lore-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Details, history, lore…"
          />
        </FormField>

        {!isPlayerView && (
          <FormField
            label="DM Notes"
            htmlFor="lore-dm-notes"
            hint="Visible to DMs only — true secrets, plot hooks, hidden connections"
          >
            <Textarea
              id="lore-dm-notes"
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={3}
              placeholder="What only you know…"
            />
          </FormField>
        )}

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            Failed to create lore entry. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Create Entry
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoreList() {
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
    queryKey: ['lores', campaignId, viewMode],
    queryFn: () => fetchLores(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Lore</h1>
          <p className="text-sm text-slate-400 mt-0.5">World knowledge, history, and secrets</p>
        </div>
        {isDm && <Button onClick={() => setShowCreate(true)}>New Lore Entry</Button>}
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <ErrorDisplay message="Failed to load lore entries." />}

      {data && data.lore.length === 0 && (
        <EmptyState
          title="No lore yet"
          description={
            isDm
              ? 'Create your first lore entry to start building the world.'
              : 'The DM has not published any lore yet.'
          }
          action={isDm ? { label: 'New Lore Entry', onClick: () => setShowCreate(true) } : undefined}
        />
      )}

      {data && data.lore.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
          {data.lore.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/campaigns/${campaignId}/lore/${entry.id}`}
                className="block h-full rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <p className="font-semibold text-slate-100 mb-2">{entry.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <CategoryBadge category={entry.category} />
                  <VisibilityBadge visibility={entry.visibility} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {campaignId && (
        <CreateLoreModal
          campaignId={campaignId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
