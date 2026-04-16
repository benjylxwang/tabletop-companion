import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchNpc,
  fetchFactions,
  fetchSessions,
  updateNpc,
  deleteNpc,
} from '../../lib/api';
import { useSignedUrl } from '../../lib/useSignedUrl';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  ConfirmModal,
  FormField,
  GenerateImageButton,
  TextInput,
  Textarea,
  Select,
  Spinner,
  ErrorDisplay,
} from '../../components';
import type { NpcStatusEnum, NpcWithRefsResponse } from '@tabletop/shared';
import { StatusBadge } from './NpcList';

const STATUS_OPTIONS: { value: NpcStatusEnum; label: string }[] = [
  { value: 'Alive', label: 'Alive' },
  { value: 'Dead', label: 'Dead' },
  { value: 'Unknown', label: 'Unknown' },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function NpcDetail() {
  const { id: campaignId, npcId } = useParams<{ id: string; npcId: string }>();
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

  const { data, isLoading, error } = useQuery<NpcWithRefsResponse>({
    queryKey: ['npc', campaignId, npcId, viewMode],
    queryFn: () => fetchNpc(campaignId!, npcId!, viewMode),
    enabled: !!campaignId && !!npcId,
  });
  const npc = data?.npc;

  // ─── Faction / session queries (only loaded when editing) ───────────────────
  const factionsQuery = useQuery({
    queryKey: ['factions', campaignId, viewMode],
    queryFn: () => fetchFactions(campaignId!, viewMode),
    enabled: !!campaignId && editing,
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', campaignId, viewMode],
    queryFn: () => fetchSessions(campaignId!, viewMode),
    enabled: !!campaignId && editing,
  });

  // ─── Edit form state ────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [alignment, setAlignment] = useState('');
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [relationships, setRelationships] = useState('');
  const [status, setStatus] = useState<NpcStatusEnum>('Alive');
  const [dmNotes, setDmNotes] = useState('');
  const [factionId, setFactionId] = useState('');
  const [firstAppearedSessionId, setFirstAppearedSessionId] = useState('');
  const [portraitPath, setPortraitPath] = useState<string | null>(null);

  const portraitSignedUrl = useSignedUrl(npc?.portrait_url);

  function openEdit() {
    if (!npc) return;
    setName(npc.name);
    setRoleTitle(npc.role_title ?? '');
    setAlignment(npc.alignment ?? '');
    setAppearance(npc.appearance ?? '');
    setPersonality(npc.personality ?? '');
    setRelationships(npc.relationships ?? '');
    setStatus(npc.status);
    setDmNotes(npc.dm_notes ?? '');
    setFactionId(npc.faction?.id ?? '');
    setFirstAppearedSessionId(npc.first_appeared_session?.id ?? '');
    setPortraitPath(npc.portrait_url ?? null);
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateNpc(campaignId!, npcId!, {
        name,
        role_title: roleTitle || undefined,
        alignment: alignment || undefined,
        appearance: appearance || undefined,
        personality: personality || undefined,
        relationships: relationships || undefined,
        status,
        dm_notes: dmNotes || undefined,
        faction_id: factionId || null,
        first_appeared_session_id: firstAppearedSessionId || null,
        portrait_url: portraitPath ?? undefined,
      }),
    onSuccess: () => {
      // Invalidate rather than setQueryData — the update returns a plain Npc
      // without enriched refs (faction name, session title), so we need a fresh
      // GET to rebuild the NpcWithRefs shape.
      void queryClient.invalidateQueries({ queryKey: ['npc', campaignId, npcId] });
      void queryClient.invalidateQueries({ queryKey: ['npcs', campaignId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNpc(campaignId!, npcId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['npcs', campaignId] });
      navigate(`/campaigns/${campaignId}/npcs`);
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
  if (error || !npc) {
    return (
      <div className="p-8">
        <ErrorDisplay message="Failed to load NPC." />
      </div>
    );
  }

  // ─── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit NPC</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Name" htmlFor="edit-npc-name" required>
            <TextInput
              id="edit-npc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Role / Title" htmlFor="edit-npc-role-title">
              <TextInput
                id="edit-npc-role-title"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
              />
            </FormField>
            <FormField label="Alignment" htmlFor="edit-npc-alignment">
              <TextInput
                id="edit-npc-alignment"
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Appearance" htmlFor="edit-npc-appearance">
            <Textarea
              id="edit-npc-appearance"
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              rows={2}
            />
          </FormField>

          <FormField label="Public personality" htmlFor="edit-npc-personality">
            <Textarea
              id="edit-npc-personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={2}
            />
          </FormField>

          <FormField label="Relationships" htmlFor="edit-npc-relationships">
            <Textarea
              id="edit-npc-relationships"
              value={relationships}
              onChange={(e) => setRelationships(e.target.value)}
              rows={2}
            />
          </FormField>

          <FormField label="Status" htmlFor="edit-npc-status">
            <Select
              id="edit-npc-status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => setStatus(v as NpcStatusEnum)}
            />
          </FormField>

          <FormField label="Portrait" htmlFor="edit-npc-portrait" hint="AI-generated portrait image">
            <GenerateImageButton
              campaignId={campaignId!}
              entityType="npc"
              entityId={npcId!}
              fieldName="portrait_url"
              onGenerated={(path) => setPortraitPath(path)}
            />
            {portraitPath && (
              <p className="mt-1 text-xs text-slate-500 truncate">{portraitPath}</p>
            )}
          </FormField>

          {!isPlayerView && (
            <FormField
              label="DM Notes"
              htmlFor="edit-npc-dm-notes"
              hint="Visible to DMs only — never shown to players"
            >
              <Textarea
                id="edit-npc-dm-notes"
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={4}
              />
            </FormField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Faction" htmlFor="edit-npc-faction">
              <Select
                id="edit-npc-faction"
                options={[
                  { value: '', label: '— None —' },
                  ...(factionsQuery.data?.factions ?? []).map((f) => ({
                    value: f.id,
                    label: f.name,
                  })),
                ]}
                value={factionId}
                onChange={setFactionId}
              />
            </FormField>
            <FormField label="First appeared (session)" htmlFor="edit-npc-session">
              <Select
                id="edit-npc-session"
                options={[
                  { value: '', label: '— None —' },
                  ...(sessionsQuery.data?.sessions ?? []).map((s) => ({
                    value: s.id,
                    label: `Session ${s.session_number} — ${s.title}`,
                  })),
                ]}
                value={firstAppearedSessionId}
                onChange={setFirstAppearedSessionId}
              />
            </FormField>
          </div>

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to update NPC. Please try again.
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{npc.name}</h1>
            <StatusBadge status={npc.status} />
          </div>
          {npc.role_title && (
            <p className="text-sm text-slate-400 mt-1">{npc.role_title}</p>
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
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {npc.portrait_url && portraitSignedUrl.url && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
          <img
            src={portraitSignedUrl.url}
            alt={`Portrait of ${npc.name}`}
            className="w-full max-h-96 object-contain"
          />
        </div>
      )}

      <div className="mt-6 space-y-5">
        {npc.alignment && <Field label="Alignment" value={npc.alignment} />}
        {npc.appearance && <Field label="Appearance" value={npc.appearance} />}
        {npc.personality && (
          <Field label="Public personality" value={npc.personality} />
        )}
        {npc.relationships && (
          <Field label="Relationships" value={npc.relationships} />
        )}

        {(npc.faction ?? npc.first_appeared_session) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {npc.faction && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Faction
                </p>
                <Link
                  to={`/campaigns/${campaignId}/factions/${npc.faction.id}`}
                  className="mt-1 inline-block text-sm text-amber-400 hover:text-amber-300 underline"
                >
                  {npc.faction.name}
                </Link>
              </div>
            )}
            {npc.first_appeared_session && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  First appeared
                </p>
                <Link
                  to={`/campaigns/${campaignId}/sessions/${npc.first_appeared_session.id}`}
                  className="mt-1 inline-block text-sm text-amber-400 hover:text-amber-300 underline"
                >
                  Session {npc.first_appeared_session.session_number} — {npc.first_appeared_session.name}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {npc.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{npc.dm_notes}</p>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmDelete(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete NPC"
        message={`Delete "${npc.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        error={deleteMutation.error ? 'Failed to delete NPC. Please try again.' : null}
      />
    </div>
  );
}
