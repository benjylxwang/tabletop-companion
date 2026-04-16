import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchCampaignOverview,
  updateCampaign,
  deleteCampaign,
  fetchCampaignMembers,
  fetchCampaignInvitations,
  inviteCampaignMember,
  removeCampaignMember,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import { useAuth } from '../../lib/auth';
import {
  Button,
  FormField,
  TextInput,
  Textarea,
  Select,
  Spinner,
  ErrorDisplay,
  EmptyState,
} from '../../components';
import type { CampaignStatusEnum, CampaignOverview } from '@tabletop/shared';

const STATUS_OPTIONS: { value: CampaignStatusEnum; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Hiatus', label: 'Hiatus' },
  { value: 'Complete', label: 'Complete' },
];

// ─── Campaign overview section ────────────────────────────────────────────────

function StatCard({ count, label }: { count: number; label: string }) {
  return (
    <div className="text-center rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-2xl font-bold text-amber-400">{count}</p>
      <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function OverviewSection({
  campaignId,
  overview,
}: {
  campaignId: string;
  overview: CampaignOverview;
}) {
  return (
    <div className="mt-6 space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard count={overview.stats.sessions} label="Sessions" />
        <StatCard count={overview.stats.characters} label="Characters" />
        <StatCard count={overview.stats.npcs} label="NPCs" />
        <StatCard count={overview.stats.locations} label="Locations" />
        <StatCard count={overview.stats.factions} label="Factions" />
        <StatCard count={overview.stats.lore} label="Lore" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Recent Sessions */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Recent Sessions</h3>
            <Link
              to={`/campaigns/${campaignId}/sessions`}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              View all →
            </Link>
          </div>
          {overview.recent_sessions.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No sessions yet.</p>
          ) : (
            overview.recent_sessions.map((s) => (
              <div key={s.id} className="py-1 border-b border-slate-800 last:border-0">
                <p className="text-sm text-slate-400">
                  Session {s.session_number} — {s.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{s.date_played}</p>
              </div>
            ))
          )}
        </div>

        {/* Key NPCs */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Key NPCs</h3>
            <Link
              to={`/campaigns/${campaignId}/npcs`}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              View all →
            </Link>
          </div>
          {overview.key_npcs.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No NPCs yet.</p>
          ) : (
            overview.key_npcs.map((n) => (
              <p
                key={n.id}
                className="text-sm text-slate-400 py-1 border-b border-slate-800 last:border-0"
              >
                {n.name}
              </p>
            ))
          )}
        </div>

        {/* Locations */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Locations</h3>
            <Link
              to={`/campaigns/${campaignId}/locations`}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              View all →
            </Link>
          </div>
          {overview.locations.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No locations yet.</p>
          ) : (
            overview.locations.map((l) => (
              <p
                key={l.id}
                className="text-sm text-slate-400 py-1 border-b border-slate-800 last:border-0"
              >
                {l.name}
              </p>
            ))
          )}
        </div>

        {/* Factions */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Factions</h3>
            <Link
              to={`/campaigns/${campaignId}/factions`}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              View all →
            </Link>
          </div>
          {overview.factions.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No factions yet.</p>
          ) : (
            overview.factions.map((f) => (
              <p
                key={f.id}
                className="text-sm text-slate-400 py-1 border-b border-slate-800 last:border-0"
              >
                {f.name}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [editing, setEditing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['campaign', id, viewMode],
    queryFn: () => fetchCampaign(id!, viewMode),
    enabled: !!id,
  });

  const campaign = data?.campaign;
  const isDm = campaign?.my_role === 'dm';

  // ─── Edit form state ────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [system, setSystem] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CampaignStatusEnum>('Active');
  const [dmNotes, setDmNotes] = useState('');

  function openEdit() {
    if (!campaign) return;
    setName(campaign.name);
    setSystem(campaign.system ?? '');
    setDescription(campaign.description ?? '');
    setStatus(campaign.status);
    setDmNotes(campaign.dm_notes ?? '');
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCampaign(id!, {
        name,
        system: system || undefined,
        description: description || undefined,
        status,
        dm_notes: dmNotes || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['campaign', id, viewMode], updated);
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCampaign(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/campaigns');
    },
  });

  function handleDelete() {
    if (window.confirm('Delete this campaign? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  }

  // ─── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading…
      </div>
    );
  }
  if (error || !campaign) {
    return <div className="p-8"><ErrorDisplay message="Failed to load campaign." /></div>;
  }

  // ─── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit Campaign</h1>
        <form
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
          className="space-y-4"
        >
          <FormField label="Name" htmlFor="edit-name" required>
            <TextInput
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="System" htmlFor="edit-system">
            <TextInput
              id="edit-system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="D&D 5e, Pathfinder 2e, …"
            />
          </FormField>

          <FormField label="Description" htmlFor="edit-description">
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </FormField>

          <FormField label="Status" htmlFor="edit-status">
            <Select
              id="edit-status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => setStatus(v as CampaignStatusEnum)}
            />
          </FormField>

          {!isPlayerView && (
            <FormField label="DM Notes" htmlFor="edit-dm-notes" hint="Visible to DMs only">
              <Textarea
                id="edit-dm-notes"
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={4}
                placeholder="Private notes about this campaign…"
              />
            </FormField>
          )}

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to update campaign. Please try again.
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
          <h1 className="text-2xl font-bold text-slate-100">{campaign.name}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {campaign.system && `${campaign.system} · `}
            <span className="text-amber-400">{campaign.status}</span>
          </p>
        </div>

        {isDm && (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={openEdit}>
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {campaign.description && (
        <p className="mt-4 text-slate-300 leading-relaxed">{campaign.description}</p>
      )}

      {campaign.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{campaign.dm_notes}</p>
        </div>
      )}

      <MembersSection campaignId={id!} isDm={isDm} />
    </div>
  );
}

// ─── Members section ──────────────────────────────────────────────────────────

function MembersSection({ campaignId, isDm }: { campaignId: string; isDm: boolean }) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['campaign', campaignId, 'members'],
    queryFn: () => fetchCampaignMembers(campaignId),
  });

  const { data: invitationsData } = useQuery({
    queryKey: ['campaign', campaignId, 'invitations'],
    queryFn: () => fetchCampaignInvitations(campaignId),
    enabled: isDm,
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => inviteCampaignMember(campaignId, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'invitations'] });
      setInviteEmail('');
      setInviteError(null);
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setInviteSuccess(false);
      setInviteError(
        err.message === 'user_not_found'
          ? 'No account found with that email.'
          : err.message === 'already_member'
            ? 'This person is already a member.'
            : err.message === 'already_invited'
              ? 'An invitation has already been sent to this person.'
              : 'Failed to send invitation. Please try again.',
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeCampaignMember(campaignId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', campaignId, 'members'] });
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(false);
    inviteMutation.mutate(inviteEmail);
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Members</h2>

      {isLoading && <p className="text-slate-400 text-sm">Loading members…</p>}

      {data && data.members.length === 0 && (
        <EmptyState title="No members yet" description="Invite players to join." />
      )}

      {data && data.members.length > 0 && (
        <ul className="space-y-2 mb-4">
          {data.members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-slate-200 font-mono">{m.user_id}</p>
                <p className="text-xs text-slate-400 mt-0.5">{m.role}</p>
              </div>
              {isDm && m.user_id !== user?.id && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeMutation.mutate(m.user_id)}
                  isLoading={removeMutation.isPending && removeMutation.variables === m.user_id}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isDm && invitationsData && invitationsData.invitations.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Pending Invitations
          </p>
          <ul className="space-y-1.5">
            {invitationsData.invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2"
              >
                <span className="text-sm font-mono text-slate-400">{inv.invited_user_id}</span>
                <span className="ml-auto text-xs text-amber-400/70">Pending</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isDm && (
        <form onSubmit={handleInvite} className="flex flex-col gap-2 max-w-md">
          <div className="flex gap-2">
            <TextInput
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="player@example.com"
              required
              error={!!inviteError}
            />
            <Button type="submit" isLoading={inviteMutation.isPending} className="shrink-0">
              Invite
            </Button>
          </div>
          {inviteError && (
            <p role="alert" className="text-sm text-red-400">
              {inviteError}
            </p>
          )}
          {inviteSuccess && (
            <p role="status" className="text-sm text-green-400">
              Invitation sent.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
