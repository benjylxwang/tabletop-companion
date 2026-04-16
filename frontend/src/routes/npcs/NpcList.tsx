import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCampaign, fetchNpcs, createNpc } from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  AITextInput,
  AITextarea,
  Button,
  GenerateAllFieldsButton,
  Modal,
  FormField,
  TextInput,
  Select,
  EmptyState,
  ErrorDisplay,
} from '../../components';
import { EntityAvatar } from '../../components/ui/EntityAvatar';
import type { NpcCreate, NpcStatusEnum, NpcsResponse } from '@tabletop/shared';
import { Skeleton } from '../../components/ui/Skeleton';

const STATUS_OPTIONS: { value: NpcStatusEnum; label: string }[] = [
  { value: 'Alive', label: 'Alive' },
  { value: 'Dead', label: 'Dead' },
  { value: 'Unknown', label: 'Unknown' },
];

const STATUS_BADGE: Record<NpcStatusEnum, string> = {
  Alive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Dead: 'bg-red-500/10 text-red-400 border-red-500/30',
  Unknown: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

export function StatusBadge({ status }: { status: NpcStatusEnum }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {status}
    </span>
  );
}

function CreateNpcModal({
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
  const isPlayerView = viewMode === 'player';
  const [name, setName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [alignment, setAlignment] = useState('');
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [relationships, setRelationships] = useState('');
  const [status, setStatus] = useState<NpcStatusEnum>('Alive');
  const [dmNotes, setDmNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data: NpcCreate) => createNpc(campaignId, data),
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: ['npcs', campaignId] });
      const previous = queryClient.getQueryData<NpcsResponse>(['npcs', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<NpcsResponse>(['npcs', campaignId, viewMode], {
          ...previous,
          npcs: [
            ...previous.npcs,
            {
              ...draft,
              id: crypto.randomUUID(),
              campaign_id: campaignId,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      onClose();
      setName('');
      setRoleTitle('');
      setAlignment('');
      setAppearance('');
      setPersonality('');
      setRelationships('');
      setStatus('Alive');
      setDmNotes('');
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['npcs', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['npcs', campaignId] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO(#28): faction/session dropdowns
    mutation.mutate({
      name,
      role_title: roleTitle || undefined,
      alignment: alignment || undefined,
      appearance: appearance || undefined,
      personality: personality || undefined,
      relationships: relationships || undefined,
      status,
      dm_notes: dmNotes || undefined,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="New NPC" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" htmlFor="npc-name" required>
          <TextInput
            id="npc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Seraphine the Innkeeper"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Role / Title" htmlFor="npc-role-title">
            <AITextInput
              id="npc-role-title"
              campaignId={campaignId}
              entityType="npc"
              fieldName="role_title"
              entityDraft={{ name, role_title: roleTitle, alignment, appearance, personality, relationships, status }}
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Innkeeper, Cult Leader, …"
            />
          </FormField>

          <FormField label="Alignment" htmlFor="npc-alignment">
            <AITextInput
              id="npc-alignment"
              campaignId={campaignId}
              entityType="npc"
              fieldName="alignment"
              entityDraft={{ name, role_title: roleTitle, alignment, appearance, personality, relationships, status }}
              value={alignment}
              onChange={(e) => setAlignment(e.target.value)}
              placeholder="Neutral Good"
            />
          </FormField>
        </div>

        <FormField label="Appearance" htmlFor="npc-appearance">
          <AITextarea
            id="npc-appearance"
            campaignId={campaignId}
            entityType="npc"
            fieldName="appearance"
            entityDraft={{ name, role_title: roleTitle, alignment, appearance, personality, relationships, status }}
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            rows={2}
            placeholder="Physical description…"
          />
        </FormField>

        <FormField label="Public personality" htmlFor="npc-personality">
          <AITextarea
            id="npc-personality"
            campaignId={campaignId}
            entityType="npc"
            fieldName="personality"
            entityDraft={{ name, role_title: roleTitle, alignment, appearance, personality, relationships, status }}
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={2}
            placeholder="How they present themselves…"
          />
        </FormField>

        <FormField label="Relationships" htmlFor="npc-relationships">
          <AITextarea
            id="npc-relationships"
            campaignId={campaignId}
            entityType="npc"
            fieldName="relationships"
            entityDraft={{ name, role_title: roleTitle, alignment, appearance, personality, relationships, status }}
            value={relationships}
            onChange={(e) => setRelationships(e.target.value)}
            rows={2}
            placeholder="Connections to other NPCs, factions, or PCs…"
          />
        </FormField>

        <GenerateAllFieldsButton
          campaignId={campaignId}
          entityType="npc"
          entityDraft={{ name, role_title: roleTitle, alignment, appearance, personality, relationships, status }}
          fields={[
            { fieldName: 'role_title', onChange: (v) => setRoleTitle(v) },
            { fieldName: 'alignment', onChange: (v) => setAlignment(v) },
            { fieldName: 'appearance', onChange: (v) => setAppearance(v) },
            { fieldName: 'personality', onChange: (v) => setPersonality(v) },
            { fieldName: 'relationships', onChange: (v) => setRelationships(v) },
            ...(!isPlayerView ? [{ fieldName: 'dm_notes', onChange: (v: string) => setDmNotes(v) }] : []),
          ]}
        />

        <FormField label="Status" htmlFor="npc-status">
          <Select
            id="npc-status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v as NpcStatusEnum)}
          />
        </FormField>

        {!isPlayerView && (
          <FormField
            label="DM Notes"
            htmlFor="npc-dm-notes"
            hint="Visible to DMs only — true motivations, secrets, planned role"
          >
            <AITextarea
              id="npc-dm-notes"
              campaignId={campaignId}
              entityType="npc"
              fieldName="dm_notes"
              entityDraft={{ name, role_title: roleTitle, alignment, appearance, personality, relationships, status }}
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={4}
              placeholder="Most sensitive content in the app — never shown to players."
            />
          </FormField>
        )}

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            Failed to create NPC. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Create NPC
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function NpcList() {
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
    queryKey: ['npcs', campaignId, viewMode],
    queryFn: () => fetchNpcs(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">NPCs</h1>
          <p className="text-sm text-slate-400 mt-0.5">The people and powers in your world</p>
        </div>
        {isDm && <Button onClick={() => setShowCreate(true)}>New NPC</Button>}
      </div>

      {isLoading && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </ul>
      )}
      {error && <ErrorDisplay message="Failed to load NPCs." />}

      {data && data.npcs.length === 0 && (
        <EmptyState
          title="No NPCs yet"
          description={
            isDm
              ? 'Create your first NPC to start populating the world.'
              : 'The DM has not introduced any NPCs yet.'
          }
          action={isDm ? { label: 'New NPC', onClick: () => setShowCreate(true) } : undefined}
        />
      )}

      {data && data.npcs.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
          {data.npcs.map((n) => (
            <li key={n.id}>
              <Link
                to={`/campaigns/${campaignId}/npcs/${n.id}`}
                className="flex items-center gap-3 h-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <EntityAvatar imageUrl={n.portrait_url} entityType="npc" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-100 truncate">{n.name}</p>
                    <StatusBadge status={n.status} />
                  </div>
                  {n.role_title && (
                    <p className="text-sm text-slate-400 mt-0.5 truncate">{n.role_title}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {campaignId && (
        <CreateNpcModal
          campaignId={campaignId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          isDm={isDm}
        />
      )}
    </div>
  );
}
