import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaignMembers,
  fetchCampaignInvitations,
  inviteCampaignMember,
  removeCampaignMember,
  fetchCampaign,
} from '../../lib/api';
import type { CampaignMembersResponse } from '@tabletop/shared';
import { useViewMode } from '../../contexts/ViewModeContext';
import { useAuth } from '../../lib/auth';
import { Button, TextInput, Spinner, ErrorDisplay } from '../../components';

export default function CampaignMembers() {
  const { id } = useParams<{ id: string }>();
  const { viewMode } = useViewMode();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const { data: campaignData } = useQuery({
    queryKey: ['campaign', id, viewMode],
    queryFn: () => fetchCampaign(id!, viewMode),
    enabled: !!id,
  });

  const isDm = campaignData?.campaign.my_role === 'dm';

  const { data: membersData, isLoading: membersLoading, error: membersError } = useQuery({
    queryKey: ['campaign', id, 'members'],
    queryFn: () => fetchCampaignMembers(id!),
    enabled: !!id,
  });

  const { data: invitationsData } = useQuery({
    queryKey: ['campaign', id, 'invitations'],
    queryFn: () => fetchCampaignInvitations(id!),
    enabled: !!id && isDm,
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => inviteCampaignMember(id!, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', id, 'invitations'] });
      setInviteEmail('');
      setInviteError(null);
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setInviteSuccess(false);
      setInviteError(
        err.message === 'already_member'
          ? 'This person is already a member.'
          : err.message === 'already_invited'
            ? 'An invitation has already been sent to this person.'
            : 'Failed to send invitation. Please try again.',
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeCampaignMember(id!, userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['campaign', id, 'members'] });
      const previous = queryClient.getQueryData<CampaignMembersResponse>(['campaign', id, 'members']);
      if (previous) {
        queryClient.setQueryData<CampaignMembersResponse>(['campaign', id, 'members'], {
          ...previous,
          members: previous.members.filter((m) => m.user_id !== userId),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['campaign', id, 'members'], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', id, 'members'] });
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(false);
    inviteMutation.mutate(inviteEmail);
  }

  if (membersLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading members…
      </div>
    );
  }

  if (membersError) {
    return <div className="p-8"><ErrorDisplay message="Failed to load members." /></div>;
  }

  const members = membersData?.members ?? [];

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Members</h1>

      {/* ── Members list ── */}
      <section className="mb-8">
        {members.length === 0 ? (
          <p className="text-slate-400 text-sm">No members yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {m.display_name ?? m.email ?? m.user_id}
                  </p>
                  {m.display_name && m.email && (
                    <p className="text-xs text-slate-400 mt-0.5">{m.email}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{m.role}</p>
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
      </section>

      {/* ── Pending invitations ── */}
      {isDm && invitationsData && invitationsData.invitations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Pending Invitations
          </h2>
          <ul className="space-y-2">
            {invitationsData.invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm text-slate-300">
                    {inv.invited_user_display_name ?? inv.invited_user_email ?? inv.invited_user_id}
                  </p>
                  {inv.invited_user_display_name && inv.invited_user_email && (
                    <p className="text-xs text-slate-400 mt-0.5">{inv.invited_user_email}</p>
                  )}
                </div>
                <span className="text-xs text-amber-400/70">Pending</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Invite form (DM only) ── */}
      {isDm && (
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Invite Player
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            If they don't have an account yet, they'll receive an email to sign up.
          </p>
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
              <p role="alert" className="text-sm text-red-400">{inviteError}</p>
            )}
            {inviteSuccess && (
              <p role="status" className="text-sm text-green-400">Invitation sent.</p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
