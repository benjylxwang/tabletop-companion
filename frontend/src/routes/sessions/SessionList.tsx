import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCampaign, fetchSessions, createSession } from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  Modal,
  FormField,
  TextInput,
  Textarea,
  EmptyState,
  ErrorDisplay,
} from '../../components';
import type { SessionCreate } from '@tabletop/shared';

function CreateSessionModal({
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
  const [title, setTitle] = useState('');
  const [sessionNumber, setSessionNumber] = useState('');
  const [datePlayed, setDatePlayed] = useState('');
  const [summary, setSummary] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data: SessionCreate) => createSession(campaignId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', campaignId] });
      onClose();
      setTitle('');
      setSessionNumber('');
      setDatePlayed('');
      setSummary('');
      setDmNotes('');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      campaign_id: campaignId,
      title,
      session_number: parseInt(sessionNumber, 10),
      date_played: datePlayed,
      summary: summary || undefined,
      dm_notes: dmNotes || undefined,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="New Session" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Title" htmlFor="session-title" required>
            <TextInput
              id="session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="The Ruins of Ashenmere"
            />
          </FormField>

          <FormField label="Session Number" htmlFor="session-number" required>
            <TextInput
              id="session-number"
              type="number"
              value={sessionNumber}
              onChange={(e) => setSessionNumber(e.target.value)}
              required
              placeholder="1"
              min="1"
            />
          </FormField>
        </div>

        <FormField label="Date Played" htmlFor="session-date" required>
          <TextInput
            id="session-date"
            type="date"
            value={datePlayed}
            onChange={(e) => setDatePlayed(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Summary" htmlFor="session-summary">
          <Textarea
            id="session-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="What happened this session…"
          />
        </FormField>

        {isDm && viewMode === 'dm' && (
          <FormField
            label="DM Notes"
            htmlFor="session-dm-notes"
            hint="Visible to DMs only"
          >
            <Textarea
              id="session-dm-notes"
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={3}
              placeholder="Plans, foreshadowing, player feedback…"
            />
          </FormField>
        )}

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            Failed to create session. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Create Session
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function SessionList() {
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
    queryKey: ['sessions', campaignId, viewMode],
    queryFn: () => fetchSessions(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Sessions</h1>
          <p className="text-sm text-slate-400 mt-0.5">The story so far</p>
        </div>
        {isDm && <Button onClick={() => setShowCreate(true)}>New Session</Button>}
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && <ErrorDisplay message="Failed to load sessions." />}

      {data && data.sessions.length === 0 && (
        <EmptyState
          title="No sessions yet"
          description={
            isDm
              ? 'Log your first session to start building the story.'
              : 'The DM has not logged any sessions yet.'
          }
          action={isDm ? { label: 'New Session', onClick: () => setShowCreate(true) } : undefined}
        />
      )}

      {data && data.sessions.length > 0 && (
        <ul className="space-y-2 max-w-3xl">
          {data.sessions.map((s) => (
            <li key={s.id}>
              <Link
                to={`/campaigns/${campaignId}/sessions/${s.id}`}
                className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span className="shrink-0 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
                  #{s.session_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100 truncate">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.date_played}</p>
                </div>
                {s.summary && (
                  <p className="hidden sm:block text-sm text-slate-400 line-clamp-1 max-w-xs">
                    {s.summary}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {campaignId && (
        <CreateSessionModal
          campaignId={campaignId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          isDm={!!isDm}
        />
      )}
    </div>
  );
}
