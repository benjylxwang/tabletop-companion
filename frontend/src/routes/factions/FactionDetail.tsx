import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchFaction,
  fetchFactions,
  fetchNpcs,
  updateFaction,
  deleteFaction,
  addFactionMember,
  removeFactionMember,
  addFactionRelationship,
  removeFactionRelationship,
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
import type {
  FactionWithRefs,
  FactionMemberRef,
  FactionRelationshipRef,
  FactionRelationshipTypeEnum,
  AddFactionMember,
  AddFactionRelationship,
} from '@tabletop/shared';

// ─── Relationship badge ───────────────────────────────────────────────────────

const RELATIONSHIP_BADGE: Record<FactionRelationshipTypeEnum, string> = {
  ally: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  enemy: 'bg-red-500/10 text-red-400 border-red-500/30',
  rival: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  unknown: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const RELATIONSHIP_OPTIONS: { value: FactionRelationshipTypeEnum; label: string }[] = [
  { value: 'ally', label: 'Ally' },
  { value: 'enemy', label: 'Enemy' },
  { value: 'rival', label: 'Rival' },
  { value: 'unknown', label: 'Unknown' },
];

function RelationshipBadge({ type }: { type: FactionRelationshipTypeEnum }) {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RELATIONSHIP_BADGE[type]}`}
    >
      {label}
    </span>
  );
}

// ─── Field (read-only display) ────────────────────────────────────────────────

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

// ─── Members section ──────────────────────────────────────────────────────────

function MembersSection({
  campaignId,
  factionId,
  members,
  isDm,
}: {
  campaignId: string;
  factionId: string;
  members: FactionMemberRef[];
  isDm: boolean;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [selectedNpcId, setSelectedNpcId] = useState('');
  const [memberRole, setMemberRole] = useState('');

  const npcsQuery = useQuery({
    queryKey: ['npcs', campaignId, viewMode],
    queryFn: () => fetchNpcs(campaignId, viewMode),
    enabled: isDm,
  });

  const memberIds = new Set(members.map((m) => m.npc_id));
  const availableNpcs = (npcsQuery.data?.npcs ?? []).filter(
    (n) => !memberIds.has(n.id),
  );

  const npcOptions = availableNpcs.map((n) => ({
    value: n.id,
    label: n.name,
  }));

  const addMutation = useMutation({
    mutationFn: (data: AddFactionMember) =>
      addFactionMember(campaignId, factionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['faction', campaignId, factionId],
      });
      setSelectedNpcId('');
      setMemberRole('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (npcId: string) =>
      removeFactionMember(campaignId, factionId, npcId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['faction', campaignId, factionId],
      });
    },
  });

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
        Members
      </p>

      {members.length === 0 && (
        <p className="text-sm text-slate-500 italic">No members yet.</p>
      )}

      {members.length > 0 && (
        <ul className="space-y-2 mb-4">
          {members.map((m) => (
            <li
              key={m.npc_id}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/50 px-4 py-2.5"
            >
              <div>
                <Link
                  to={`/campaigns/${campaignId}/npcs/${m.npc_id}`}
                  className="text-sm font-medium text-amber-400 hover:text-amber-300"
                >
                  {m.npc_name}
                </Link>
                {m.role && (
                  <span className="ml-2 text-xs text-slate-500">{m.role}</span>
                )}
              </div>
              {isDm && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeMutation.mutate(m.npc_id)}
                  isLoading={removeMutation.isPending}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isDm && npcOptions.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <FormField label="Add member" htmlFor="add-member-npc">
              <Select
                id="add-member-npc"
                options={[{ value: '', label: 'Select an NPC…' }, ...npcOptions]}
                value={selectedNpcId}
                onChange={setSelectedNpcId}
              />
            </FormField>
          </div>
          <div className="w-36">
            <FormField label="Role (optional)" htmlFor="add-member-role">
              <TextInput
                id="add-member-role"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                placeholder="Captain, Spy…"
              />
            </FormField>
          </div>
          <div className="pb-0.5">
            <Button
              onClick={() => {
                if (!selectedNpcId) return;
                addMutation.mutate({
                  npc_id: selectedNpcId,
                  role: memberRole || undefined,
                });
              }}
              isLoading={addMutation.isPending}
              disabled={!selectedNpcId}
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {addMutation.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          Failed to add member. Please try again.
        </p>
      )}
    </div>
  );
}

// ─── Relationships section ────────────────────────────────────────────────────

function RelationshipsSection({
  campaignId,
  factionId,
  relationships,
  isDm,
}: {
  campaignId: string;
  factionId: string;
  relationships: FactionRelationshipRef[];
  isDm: boolean;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [selectedFactionId, setSelectedFactionId] = useState('');
  const [relationshipType, setRelationshipType] =
    useState<FactionRelationshipTypeEnum>('unknown');

  const factionsQuery = useQuery({
    queryKey: ['factions', campaignId, viewMode],
    queryFn: () => fetchFactions(campaignId, viewMode),
    enabled: isDm,
  });

  const relatedIds = new Set(relationships.map((r) => r.related_faction_id));
  relatedIds.add(factionId); // exclude self
  const availableFactions = (factionsQuery.data?.factions ?? []).filter(
    (f) => !relatedIds.has(f.id),
  );

  const factionOptions = availableFactions.map((f) => ({
    value: f.id,
    label: f.name,
  }));

  const addMutation = useMutation({
    mutationFn: (data: AddFactionRelationship) =>
      addFactionRelationship(campaignId, factionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['faction', campaignId, factionId],
      });
      setSelectedFactionId('');
      setRelationshipType('unknown');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (relatedFactionId: string) =>
      removeFactionRelationship(campaignId, factionId, relatedFactionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['faction', campaignId, factionId],
      });
    },
  });

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
        Relationships
      </p>

      {relationships.length === 0 && (
        <p className="text-sm text-slate-500 italic">No inter-faction relationships recorded.</p>
      )}

      {relationships.length > 0 && (
        <ul className="space-y-2 mb-4">
          {relationships.map((r) => (
            <li
              key={r.related_faction_id}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/50 px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <Link
                  to={`/campaigns/${campaignId}/factions/${r.related_faction_id}`}
                  className="text-sm font-medium text-amber-400 hover:text-amber-300"
                >
                  {r.related_faction_name}
                </Link>
                <RelationshipBadge type={r.relationship_type} />
              </div>
              {isDm && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeMutation.mutate(r.related_faction_id)}
                  isLoading={removeMutation.isPending}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isDm && factionOptions.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <FormField label="Add relationship" htmlFor="add-rel-faction">
              <Select
                id="add-rel-faction"
                options={[{ value: '', label: 'Select a faction…' }, ...factionOptions]}
                value={selectedFactionId}
                onChange={setSelectedFactionId}
              />
            </FormField>
          </div>
          <div className="w-36">
            <FormField label="Type" htmlFor="add-rel-type">
              <Select
                id="add-rel-type"
                options={RELATIONSHIP_OPTIONS}
                value={relationshipType}
                onChange={(v) =>
                  setRelationshipType(v as FactionRelationshipTypeEnum)
                }
              />
            </FormField>
          </div>
          <div className="pb-0.5">
            <Button
              onClick={() => {
                if (!selectedFactionId) return;
                addMutation.mutate({
                  related_faction_id: selectedFactionId,
                  relationship_type: relationshipType,
                });
              }}
              isLoading={addMutation.isPending}
              disabled={!selectedFactionId}
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {addMutation.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          Failed to add relationship. Please try again.
        </p>
      )}
    </div>
  );
}

// ─── FactionDetail ────────────────────────────────────────────────────────────

export default function FactionDetail() {
  const { id: campaignId, factionId } = useParams<{
    id: string;
    factionId: string;
  }>();
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
  const faction: FactionWithRefs | undefined = data?.faction;

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
      queryClient.setQueryData(
        ['faction', campaignId, factionId, viewMode],
        // merge updated scalar fields onto the existing refs data
        data
          ? { faction: { ...data.faction, ...updated.faction } }
          : updated,
      );
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

  // ─── Loading / error states ─────────────────────────────────────────────────
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
          <FormField label="Name" htmlFor="edit-faction-name" required>
            <TextInput
              id="edit-faction-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Description" htmlFor="edit-faction-description">
            <Textarea
              id="edit-faction-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </FormField>

          <FormField label="Goals" htmlFor="edit-faction-goals">
            <Textarea
              id="edit-faction-goals"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={2}
            />
          </FormField>

          <FormField label="Alignment / Tone" htmlFor="edit-faction-alignment-tone">
            <TextInput
              id="edit-faction-alignment-tone"
              value={alignmentTone}
              onChange={(e) => setAlignmentTone(e.target.value)}
            />
          </FormField>

          {!isPlayerView && (
            <FormField
              label="DM Notes"
              htmlFor="edit-faction-dm-notes"
              hint="Visible to DMs only — never shown to players"
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(false)}
            >
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

      <div className="mt-6 space-y-5">
        {faction.description && (
          <Field label="Description" value={faction.description} />
        )}
        {faction.goals && <Field label="Goals" value={faction.goals} />}

        <div className="border-t border-slate-800 pt-5">
          <MembersSection
            campaignId={campaignId!}
            factionId={factionId!}
            members={faction.members}
            isDm={isDm}
          />
        </div>

        <div className="border-t border-slate-800 pt-5">
          <RelationshipsSection
            campaignId={campaignId!}
            factionId={factionId!}
            relationships={faction.relationships}
            isDm={isDm}
          />
        </div>
      </div>

      {faction.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {faction.dm_notes}
          </p>
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
        error={
          deleteMutation.error ? 'Failed to delete faction. Please try again.' : null
        }
      />
    </div>
  );
}
