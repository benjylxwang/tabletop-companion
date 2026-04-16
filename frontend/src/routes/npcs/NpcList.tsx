import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCampaign, fetchNpcs, createNpc } from '../../lib/api';
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
import type { NpcCreate, NpcStatusEnum } from '@tabletop/shared';

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['npcs', campaignId] });
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
            <TextInput
              id="npc-role-title"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Innkeeper, Cult Leader, …"
            />
          </FormField>

          <FormField label="Alignment" htmlFor="npc-alignment">
            <TextInput
              id="npc-alignment"
              value={alignment}
              onChange={(e) => setAlignment(e.target.value)}
              placeholder="Neutral Good"
            />
          </FormField>
        </div>

        <FormField label="Appearance" htmlFor="npc-appearance">
          <Textarea
            id="npc-appearance"
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            rows={2}
            placeholder="Physical description…"
          />
        </FormField>

        <FormField label="Public personality" htmlFor="npc-personality">
          <Textarea
            id="npc-personality"
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={2}
            placeholder="How they present themselves…"
          />
        </FormField>

        <FormField label="Relationships" htmlFor="npc-relationships">
          <Textarea
            id="npc-relationships"
            value={relationships}
            onChange={(e) => setRelationships(e.target.value)}
            rows={2}
            placeholder="Connections to other NPCs, factions, or PCs…"
          />
        </FormField>

        <FormField label="Status" htmlFor="npc-status">
          <Select
            id="npc-status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v as NpcStatusEnum)}
          />
        </FormField>

        {isDm && viewMode === 'dm' && (
          <FormField
            label="DM Notes"
            htmlFor="npc-dm-notes"
            hint="Visible to DMs only — true motivations, secrets, planned role"
          >
            <Textarea
              id="npc-dm-notes"
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

      {isLoading && <p className="text-slate-400">Loading…</p>}
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
                className="block h-full rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-100">{n.name}</p>
                  <StatusBadge status={n.status} />
                </div>
                {n.role_title && (
                  <p className="text-sm text-slate-400 mt-1">{n.role_title}</p>
                )}
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
