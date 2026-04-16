import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchSession,
  updateSession,
  deleteSession,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  ConfirmModal,
  FormField,
  TextInput,
  Textarea,
  Spinner,
  ErrorDisplay,
} from '../../components';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function SessionDetail() {
  const { id: campaignId, sessionId } = useParams<{ id: string; sessionId: string }>();
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
    queryKey: ['session', campaignId, sessionId, viewMode],
    queryFn: () => fetchSession(campaignId!, sessionId!, viewMode),
    enabled: !!campaignId && !!sessionId,
  });
  const session = data?.session;

  // ─── Edit form state ────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [sessionNumber, setSessionNumber] = useState('');
  const [datePlayed, setDatePlayed] = useState('');
  const [summary, setSummary] = useState('');
  const [highlights, setHighlights] = useState('');
  const [xpAwarded, setXpAwarded] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  function openEdit() {
    if (!session) return;
    setTitle(session.title);
    setSessionNumber(String(session.session_number));
    setDatePlayed(session.date_played);
    setSummary(session.summary ?? '');
    setHighlights((session.highlights ?? []).join('\n'));
    setXpAwarded(session.xp_awarded != null ? String(session.xp_awarded) : '');
    setDmNotes(session.dm_notes ?? '');
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateSession(campaignId!, sessionId!, {
        title,
        session_number: parseInt(sessionNumber, 10),
        date_played: datePlayed,
        summary: summary || undefined,
        highlights: highlights
          ? highlights.split('\n').map((h) => h.trim()).filter(Boolean)
          : undefined,
        xp_awarded: xpAwarded ? parseInt(xpAwarded, 10) : undefined,
        dm_notes: dmNotes || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['session', campaignId, sessionId, viewMode], updated);
      void queryClient.invalidateQueries({ queryKey: ['sessions', campaignId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSession(campaignId!, sessionId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', campaignId] });
      navigate(`/campaigns/${campaignId}/sessions`);
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading…
      </div>
    );
  }
  if (error || !session) {
    return (
      <div className="p-8">
        <ErrorDisplay message="Failed to load session." />
      </div>
    );
  }

  // ─── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit Session</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Title" htmlFor="edit-session-title" required>
            <TextInput
              id="edit-session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Session Number" htmlFor="edit-session-number" required>
              <TextInput
                id="edit-session-number"
                type="number"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value)}
                required
                min="1"
              />
            </FormField>
            <FormField label="Date Played" htmlFor="edit-session-date" required>
              <TextInput
                id="edit-session-date"
                type="date"
                value={datePlayed}
                onChange={(e) => setDatePlayed(e.target.value)}
                required
              />
            </FormField>
          </div>

          <FormField label="Summary" htmlFor="edit-session-summary">
            <Textarea
              id="edit-session-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
            />
          </FormField>

          <FormField
            label="Highlights"
            htmlFor="edit-session-highlights"
            hint="One highlight per line"
          >
            <Textarea
              id="edit-session-highlights"
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              rows={3}
              placeholder="First blood drawn against the Cult&#10;The party found the lost artifact"
            />
          </FormField>

          <FormField label="XP Awarded" htmlFor="edit-session-xp">
            <TextInput
              id="edit-session-xp"
              type="number"
              value={xpAwarded}
              onChange={(e) => setXpAwarded(e.target.value)}
              min="0"
              placeholder="0"
            />
          </FormField>

          {!isPlayerView && (
            <FormField
              label="DM Notes"
              htmlFor="edit-session-dm-notes"
              hint="Visible to DMs only"
            >
              <Textarea
                id="edit-session-dm-notes"
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={4}
              />
            </FormField>
          )}

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to update session. Please try again.
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
            <span className="inline-flex items-center rounded-full bg-slate-800 border border-slate-700 px-3 py-0.5 text-sm font-bold text-amber-400">
              #{session.session_number}
            </span>
            <h1 className="text-2xl font-bold text-slate-100">{session.title}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">{session.date_played}</p>
        </div>

        {isDm && (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={openEdit}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-5">
        {session.summary && <Field label="Summary" value={session.summary} />}

        {session.highlights && session.highlights.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Highlights
            </p>
            <ul className="space-y-1">
              {session.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {session.xp_awarded != null && (
          <Field label="XP Awarded" value={String(session.xp_awarded)} />
        )}
      </div>

      {session.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{session.dm_notes}</p>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setConfirmDelete(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Session"
        message={`Delete session #${session.session_number} "${session.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        error={deleteMutation.error ? 'Failed to delete session. Please try again.' : null}
      />
    </div>
  );
}
