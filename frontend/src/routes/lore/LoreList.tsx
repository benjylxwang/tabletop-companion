import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLoreEntries, createLoreEntry } from '../../lib/api';
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

type FilterTab = 'All' | LoreCategoryEnum;
const FILTER_TABS: FilterTab[] = ['All', 'History', 'Magic', 'Religion', 'Politics'];

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
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LoreCategoryEnum>('History');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<LoreVisibilityEnum>('Public');
  const [dmNotes, setDmNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createLoreEntry(campaignId, {
        title,
        category,
        content: content || undefined,
        visibility,
        campaign_id: campaignId,
        dm_notes: dmNotes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lore', campaignId] });
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
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Lore Entry">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" htmlFor="lore-title" required>
          <TextInput
            id="lore-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="The Founding of the Empire"
          />
        </FormField>

        <FormField label="Category" htmlFor="lore-category">
          <Select
            id="lore-category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(v) => setCategory(v as LoreCategoryEnum)}
          />
        </FormField>

        <FormField label="Content" htmlFor="lore-content">
          <Textarea
            id="lore-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="Write the lore entry here…"
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

        <FormField label="DM Notes" htmlFor="lore-dm-notes">
          <Textarea
            id="lore-dm-notes"
            value={dmNotes}
            onChange={(e) => setDmNotes(e.target.value)}
            rows={2}
            placeholder="Private notes only the DM sees…"
          />
        </FormField>

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            Failed to create entry. Please try again.
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

export default function LoreList() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { viewMode, isPlayerView } = useViewMode();
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['lore', campaignId, viewMode],
    queryFn: () => fetchLoreEntries(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const entries = data?.lore ?? [];
  const filtered = activeTab === 'All' ? entries : entries.filter((e) => e.category === activeTab);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Lore</h1>
          <p className="text-sm text-slate-400 mt-0.5">World-building entries for this campaign</p>
        </div>
        {!isPlayerView && (
          <Button onClick={() => setShowCreate(true)}>New Entry</Button>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 pb-0">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              activeTab === tab
                ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <ErrorDisplay message="Failed to load lore entries." />}

      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          title={activeTab === 'All' ? 'No lore entries yet' : `No ${activeTab} entries`}
          description={
            isPlayerView
              ? 'No lore has been made available yet.'
              : 'Start building your world by adding a lore entry.'
          }
          action={
            !isPlayerView
              ? { label: 'New Entry', onClick: () => setShowCreate(true) }
              : undefined
          }
        />
      )}

      <ul className="space-y-3 max-w-3xl">
        {filtered.map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/campaigns/${campaignId}/lore/${entry.id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    CATEGORY_COLORS[entry.category as LoreCategoryEnum] ?? 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {entry.category}
                </span>
                {!isPlayerView && entry.visibility === 'Private' && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-400">
                    Private
                  </span>
                )}
              </div>
              <p className="font-semibold text-slate-100">{entry.title}</p>
              {entry.content && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{entry.content}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>

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
