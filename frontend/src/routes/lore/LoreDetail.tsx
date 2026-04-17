import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchLore,
  updateLore,
  deleteLore,
  addLoreReference,
  removeLoreReference,
  fetchNpcs,
  fetchLocations,
  fetchFactions,
  fetchSessions,
  fetchLores,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  AITextInput,
  AITextarea,
  Button,
  ConfirmModal,
  FormField,
  GenerateAllFieldsButton,
  Select,
  Spinner,
  ErrorDisplay,
} from '../../components';
import type {
  LoreCategoryEnum,
  LoreVisibilityEnum,
  LoreReferenceEntityTypeEnum,
  LoreRef,
  LoreWithRefsResponse,
  LoreListResponse,
  NpcsResponse,
  LocationsResponse,
  FactionsResponse,
  SessionsResponse,
  CharactersResponse,
} from '@tabletop/shared';
import { CategoryBadge, VisibilityBadge } from './LoreList';

// ─── Option lists ─────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: LoreCategoryEnum; label: string }[] = [
  { value: 'History', label: 'History' },
  { value: 'Magic', label: 'Magic' },
  { value: 'Religion', label: 'Religion' },
  { value: 'Politics', label: 'Politics' },
  { value: 'Other', label: 'Other' },
];

const VISIBILITY_OPTIONS: { value: LoreVisibilityEnum; label: string }[] = [
  { value: 'Public', label: 'Public' },
  { value: 'Private', label: 'Private' },
  { value: 'Revealed', label: 'Revealed' },
];

const ENTITY_TYPE_OPTIONS: { value: LoreReferenceEntityTypeEnum; label: string }[] = [
  { value: 'session', label: 'Session' },
  { value: 'npc', label: 'NPC' },
  { value: 'location', label: 'Location' },
  { value: 'faction', label: 'Faction' },
  { value: 'lore', label: 'Lore' },
];

// ─── Entity type → route helper ───────────────────────────────────────────────

function entityPath(
  campaignId: string,
  entityType: LoreReferenceEntityTypeEnum,
  entityId: string,
): string {
  const routes: Record<LoreReferenceEntityTypeEnum, string> = {
    session: `/campaigns/${campaignId}/sessions/${entityId}`,
    npc: `/campaigns/${campaignId}/npcs/${entityId}`,
    location: `/campaigns/${campaignId}/locations/${entityId}`,
    faction: `/campaigns/${campaignId}/factions/${entityId}`,
    lore: `/campaigns/${campaignId}/lore/${entityId}`,
    character: `/campaigns/${campaignId}/characters/${entityId}`,
  };
  return routes[entityType];
}

// ─── Related references section ───────────────────────────────────────────────

function ReferencesSection({
  campaignId,
  loreId,
  references,
  isDm,
}: {
  campaignId: string;
  loreId: string;
  references: LoreRef[];
  isDm: boolean;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [refEntityType, setRefEntityType] = useState<LoreReferenceEntityTypeEnum>('npc');
  const [refEntityId, setRefEntityId] = useState('');

  // ─── Dynamic entity list per type ────────────────────────────────────────────

  const npcsQuery = useQuery({
    queryKey: ['npcs', campaignId, viewMode],
    queryFn: () => fetchNpcs(campaignId, viewMode),
    enabled: isDm && refEntityType === 'npc',
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', campaignId, viewMode],
    queryFn: () => fetchLocations(campaignId, viewMode),
    enabled: isDm && refEntityType === 'location',
  });

  const factionsQuery = useQuery({
    queryKey: ['factions', campaignId, viewMode],
    queryFn: () => fetchFactions(campaignId, viewMode),
    enabled: isDm && refEntityType === 'faction',
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', campaignId, viewMode],
    queryFn: () => fetchSessions(campaignId, viewMode),
    enabled: isDm && refEntityType === 'session',
  });

  const loresQuery = useQuery({
    queryKey: ['lores', campaignId, viewMode],
    queryFn: () => fetchLores(campaignId, viewMode),
    enabled: isDm && refEntityType === 'lore',
  });

  type EntityOption = { value: string; label: string };

  function getEntityOptions(): EntityOption[] {
    switch (refEntityType) {
      case 'npc':
        return (npcsQuery.data?.npcs ?? []).map((e) => ({ value: e.id, label: e.name }));
      case 'location':
        return (locationsQuery.data?.locations ?? []).map((e) => ({ value: e.id, label: e.name }));
      case 'faction':
        return (factionsQuery.data?.factions ?? []).map((e) => ({ value: e.id, label: e.name }));
      case 'session':
        return (sessionsQuery.data?.sessions ?? []).map((e) => ({
          value: e.id,
          label: `Session ${e.session_number} — ${e.title}`,
        }));
      case 'lore':
        return (loresQuery.data?.lore ?? [])
          .filter((e) => e.id !== loreId)
          .map((e) => ({ value: e.id, label: e.title }));
      default:
        return [];
    }
  }

  const entityOptions = getEntityOptions();

  const addMutation = useMutation({
    mutationFn: () =>
      addLoreReference(campaignId, loreId, {
        entity_type: refEntityType,
        entity_id: refEntityId,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['lore', campaignId, loreId, viewMode] });
      const previous = queryClient.getQueryData<LoreWithRefsResponse>(['lore', campaignId, loreId, viewMode]);
      if (previous) {
        // Look up entity name from appropriate cache
        let entityName = 'Unknown';
        switch (refEntityType) {
          case 'npc':
            entityName = queryClient.getQueryData<NpcsResponse>(['npcs', campaignId, viewMode])?.npcs.find((e) => e.id === refEntityId)?.name ?? 'Unknown';
            break;
          case 'location':
            entityName = queryClient.getQueryData<LocationsResponse>(['locations', campaignId, viewMode])?.locations.find((e) => e.id === refEntityId)?.name ?? 'Unknown';
            break;
          case 'faction':
            entityName = queryClient.getQueryData<FactionsResponse>(['factions', campaignId, viewMode])?.factions.find((e) => e.id === refEntityId)?.name ?? 'Unknown';
            break;
          case 'session': {
            const s = queryClient.getQueryData<SessionsResponse>(['sessions', campaignId, viewMode])?.sessions.find((e) => e.id === refEntityId);
            entityName = s ? `Session ${s.session_number} — ${s.title}` : 'Unknown';
            break;
          }
          case 'lore':
            entityName = queryClient.getQueryData<LoreListResponse>(['lores', campaignId, viewMode])?.lore.find((e) => e.id === refEntityId)?.title ?? 'Unknown';
            break;
          case 'character':
            entityName = queryClient.getQueryData<CharactersResponse>(['characters', campaignId, viewMode])?.characters.find((e) => e.id === refEntityId)?.name ?? 'Unknown';
            break;
        }
        queryClient.setQueryData<LoreWithRefsResponse>(['lore', campaignId, loreId, viewMode], {
          ...previous,
          lore: {
            ...previous.lore,
            references: [
              ...previous.lore.references,
              { entity_type: refEntityType, entity_id: refEntityId, entity_name: entityName },
            ],
          },
        });
      }
      return { previous };
    },
    onSuccess: () => {
      setRefEntityId('');
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['lore', campaignId, loreId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['lore', campaignId, loreId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({
      entityType,
      entityId,
    }: {
      entityType: LoreReferenceEntityTypeEnum;
      entityId: string;
    }) => removeLoreReference(campaignId, loreId, entityType, entityId),
    onMutate: async ({ entityId }) => {
      await queryClient.cancelQueries({ queryKey: ['lore', campaignId, loreId, viewMode] });
      const previous = queryClient.getQueryData<LoreWithRefsResponse>(['lore', campaignId, loreId, viewMode]);
      if (previous) {
        queryClient.setQueryData<LoreWithRefsResponse>(['lore', campaignId, loreId, viewMode], {
          ...previous,
          lore: {
            ...previous.lore,
            references: previous.lore.references.filter((r) => r.entity_id !== entityId),
          },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['lore', campaignId, loreId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['lore', campaignId, loreId] });
    },
  });

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
        Related
      </p>

      {references.length === 0 && (
        <p className="text-sm text-slate-500 italic">No references yet.</p>
      )}

      {references.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {references.map((ref) => (
            <div
              key={`${ref.entity_type}-${ref.entity_id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-3 py-1"
            >
              <Link
                to={entityPath(campaignId, ref.entity_type, ref.entity_id)}
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                {ref.entity_name}
              </Link>
              <span className="text-xs text-slate-500 capitalize">{ref.entity_type}</span>
              {isDm && (
                <button
                  type="button"
                  onClick={() =>
                    removeMutation.mutate({
                      entityType: ref.entity_type,
                      entityId: ref.entity_id,
                    })
                  }
                  className="ml-1 text-slate-500 hover:text-red-400 transition-colors text-xs leading-none"
                  aria-label={`Remove reference to ${ref.entity_name}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isDm && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-36">
            <Select
              id="ref-entity-type"
              options={ENTITY_TYPE_OPTIONS}
              value={refEntityType}
              onChange={(v) => {
                setRefEntityType(v as LoreReferenceEntityTypeEnum);
                setRefEntityId('');
              }}
            />
          </div>

          <div className="flex-1 min-w-40">
            <Select
              id="ref-entity-id"
              options={[
                { value: '', label: 'Select…' },
                ...entityOptions,
              ]}
              value={refEntityId}
              onChange={(v) => setRefEntityId(v)}
            />
          </div>

          <Button
            type="button"
            size="sm"
            disabled={!refEntityId}
            isLoading={addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            Add
          </Button>
        </div>
      )}

      {addMutation.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          Failed to add reference. Please try again.
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    queryKey: ['lore', campaignId, loreId, viewMode],
    queryFn: () => fetchLore(campaignId!, loreId!, viewMode),
    enabled: !!campaignId && !!loreId,
  });
  const lore = data?.lore;

  // ─── Edit form state ────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LoreCategoryEnum>('History');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<LoreVisibilityEnum>('Public');
  const [dmNotes, setDmNotes] = useState('');

  function openEdit() {
    if (!lore) return;
    setTitle(lore.title);
    setCategory(lore.category);
    setContent(lore.content ?? '');
    setVisibility(lore.visibility);
    setDmNotes(lore.dm_notes ?? '');
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateLore(campaignId!, loreId!, {
        title,
        category,
        content: content || undefined,
        visibility,
        dm_notes: dmNotes || undefined,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['lore', campaignId, loreId, viewMode] });
      const previous = queryClient.getQueryData<LoreWithRefsResponse>(['lore', campaignId, loreId, viewMode]);
      if (previous) {
        queryClient.setQueryData<LoreWithRefsResponse>(['lore', campaignId, loreId, viewMode], {
          ...previous,
          lore: {
            ...previous.lore,
            title,
            category,
            content: content || undefined,
            visibility,
            dm_notes: dmNotes || undefined,
          },
        });
      }
      return { previous };
    },
    onSuccess: () => {
      setEditing(false);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['lore', campaignId, loreId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['lore', campaignId, loreId] });
      void queryClient.invalidateQueries({ queryKey: ['lores', campaignId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLore(campaignId!, loreId!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['lores', campaignId] });
      const previous = queryClient.getQueryData<LoreListResponse>(['lores', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<LoreListResponse>(['lores', campaignId, viewMode], {
          ...previous,
          lore: previous.lore.filter((l) => l.id !== loreId),
        });
      }
      return { previous };
    },
    onSuccess: () => {
      navigate(`/campaigns/${campaignId}/lore`);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['lores', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['lores', campaignId] });
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
  if (error || !lore) {
    return (
      <div className="p-8">
        <ErrorDisplay message="Failed to load lore entry." />
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
            <AITextInput
              id="edit-lore-title"
              campaignId={campaignId!}
              entityType="lore"
              fieldName="title"
              entityDraft={{ title, category, content, visibility }}
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

            <FormField label="Visibility" htmlFor="edit-lore-visibility">
              <Select
                id="edit-lore-visibility"
                options={VISIBILITY_OPTIONS}
                value={visibility}
                onChange={(v) => setVisibility(v as LoreVisibilityEnum)}
              />
            </FormField>
          </div>

          <FormField label="Content" htmlFor="edit-lore-content">
            <AITextarea
              id="edit-lore-content"
              campaignId={campaignId!}
              entityType="lore"
              fieldName="content"
              entityDraft={{ title, category, content, visibility }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          </FormField>

          <GenerateAllFieldsButton
            campaignId={campaignId!}
            entityType="lore"
            entityDraft={{ title, category, content, visibility }}
            fields={[
              { fieldName: 'title', onChange: (v) => setTitle(v) },
              { fieldName: 'content', onChange: (v) => setContent(v) },
              ...(!isPlayerView ? [{ fieldName: 'dm_notes', onChange: (v: string) => setDmNotes(v) }] : []),
            ]}
          />

          {!isPlayerView && (
            <FormField
              label="DM Notes"
              htmlFor="edit-lore-dm-notes"
              hint="Visible to DMs only — never shown to players"
            >
              <AITextarea
                id="edit-lore-dm-notes"
                campaignId={campaignId!}
                entityType="lore"
                fieldName="dm_notes"
                entityDraft={{ title, category, content, visibility }}
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={4}
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{lore.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <CategoryBadge category={lore.category} />
            <VisibilityBadge visibility={lore.visibility} />
          </div>
        </div>

        {isDm && (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={openEdit}>
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {lore.content && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Content
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {lore.content}
          </p>
        </div>
      )}

      {/* References */}
      <div className="mt-8">
        <ReferencesSection
          campaignId={campaignId!}
          loreId={loreId!}
          references={lore.references}
          isDm={isDm}
        />
      </div>

      {/* DM Notes */}
      {lore.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{lore.dm_notes}</p>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmDelete(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Lore Entry"
        message={`Delete "${lore.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        error={deleteMutation.error ? 'Failed to delete lore entry. Please try again.' : null}
      />
    </div>
  );
}
