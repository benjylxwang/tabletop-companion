import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchSession,
  fetchNpcs,
  fetchLocations,
  updateSession,
  deleteSession,
  addSessionNpc,
  removeSessionNpc,
  addSessionLocation,
  removeSessionLocation,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  AITextInput,
  AITextarea,
  Button,
  FormField,
  GenerateAllFieldsButton,
  TextInput,
  Select,
  Spinner,
  ErrorDisplay,
} from '../../components';
import type { SessionWithRefsResponse } from '@tabletop/shared';

// ─── Linked entity chip ───────────────────────────────────────────────────────

interface LinkedChipProps {
  name: string;
  to: string;
  isDm: boolean;
  onRemove: () => void;
  isRemoving?: boolean;
}

function LinkedChip({ name, to, isDm, onRemove, isRemoving }: LinkedChipProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
    >
      {name}
      {isDm && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isRemoving) onRemove();
          }}
          aria-label={`Remove ${name}`}
          className="ml-1 hover:text-red-400 transition-colors leading-none"
        >
          ×
        </button>
      )}
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SessionDetail() {
  const { id: campaignId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [editing, setEditing] = useState(false);

  // ─── Campaign query (for DM role) ─────────────────────────────────────────
  const campaignQuery = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });
  const isDm = campaignQuery.data?.campaign.my_role === 'dm';

  // ─── Session query ─────────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery<SessionWithRefsResponse>({
    queryKey: ['session', campaignId, sessionId, viewMode],
    queryFn: () => fetchSession(campaignId!, sessionId!, viewMode),
    enabled: !!campaignId && !!sessionId,
  });
  const session = data?.session;

  // ─── NPCs / Locations for add dropdowns (only fetched when DM) ────────────
  const npcsQuery = useQuery({
    queryKey: ['npcs', campaignId, viewMode],
    queryFn: () => fetchNpcs(campaignId!, viewMode),
    enabled: !!campaignId && isDm,
  });
  const locationsQuery = useQuery({
    queryKey: ['locations', campaignId, viewMode],
    queryFn: () => fetchLocations(campaignId!, viewMode),
    enabled: !!campaignId && isDm,
  });

  // ─── Add / remove dropdown state ──────────────────────────────────────────
  const [selectedNpcId, setSelectedNpcId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  // ─── Edit form state ───────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [datePlayed, setDatePlayed] = useState('');
  const [summary, setSummary] = useState('');
  const [highlightsRaw, setHighlightsRaw] = useState('');
  const [xpAwarded, setXpAwarded] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  function openEdit() {
    if (!session) return;
    setTitle(session.title);
    setDatePlayed(session.date_played);
    setSummary(session.summary ?? '');
    setHighlightsRaw((session.highlights ?? []).join('\n'));
    setXpAwarded(session.xp_awarded != null ? String(session.xp_awarded) : '');
    setDmNotes(session.dm_notes ?? '');
    setEditing(true);
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  function invalidateSession() {
    void queryClient.invalidateQueries({ queryKey: ['session', campaignId, sessionId] });
  }

  function invalidateSessions() {
    void queryClient.invalidateQueries({ queryKey: ['sessions', campaignId] });
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      const highlights = highlightsRaw
        .split(/[\n,]+/)
        .map((h) => h.trim())
        .filter(Boolean);
      return updateSession(campaignId!, sessionId!, {
        title,
        date_played: datePlayed,
        summary: summary || undefined,
        highlights: highlights.length > 0 ? highlights : undefined,
        xp_awarded: xpAwarded !== '' ? parseInt(xpAwarded, 10) : undefined,
        dm_notes: dmNotes || undefined,
      });
    },
    onSuccess: () => {
      invalidateSession();
      invalidateSessions();
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSession(campaignId!, sessionId!),
    onSuccess: () => {
      invalidateSessions();
      navigate(`/campaigns/${campaignId}/sessions`);
    },
  });

  const addNpcMutation = useMutation({
    mutationFn: (npcId: string) => addSessionNpc(campaignId!, sessionId!, npcId),
    onSuccess: () => {
      setSelectedNpcId('');
      invalidateSession();
    },
  });

  const removeNpcMutation = useMutation({
    mutationFn: (npcId: string) => removeSessionNpc(campaignId!, sessionId!, npcId),
    onSuccess: () => invalidateSession(),
  });

  const addLocationMutation = useMutation({
    mutationFn: (locationId: string) => addSessionLocation(campaignId!, sessionId!, locationId),
    onSuccess: () => {
      setSelectedLocationId('');
      invalidateSession();
    },
  });

  const removeLocationMutation = useMutation({
    mutationFn: (locationId: string) => removeSessionLocation(campaignId!, sessionId!, locationId),
    onSuccess: () => invalidateSession(),
  });

  // ─── Loading / error states ────────────────────────────────────────────────
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

  // ─── Edit mode ─────────────────────────────────────────────────────────────
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
            <AITextInput
              id="edit-session-title"
              campaignId={campaignId!}
              entityType="session"
              fieldName="title"
              entityDraft={{ title, date_played: datePlayed, summary, highlights: highlightsRaw }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Date played" htmlFor="edit-session-date">
            <TextInput
              id="edit-session-date"
              type="date"
              value={datePlayed}
              onChange={(e) => setDatePlayed(e.target.value)}
            />
          </FormField>

          <FormField label="Summary" htmlFor="edit-session-summary">
            <AITextarea
              id="edit-session-summary"
              campaignId={campaignId!}
              entityType="session"
              fieldName="summary"
              entityDraft={{ title, date_played: datePlayed, summary, highlights: highlightsRaw }}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
            />
          </FormField>

          <FormField
            label="Highlights"
            htmlFor="edit-session-highlights"
            hint="One per line (or comma-separated)"
          >
            <AITextarea
              id="edit-session-highlights"
              campaignId={campaignId!}
              entityType="session"
              fieldName="highlights"
              entityDraft={{ title, date_played: datePlayed, summary, highlights: highlightsRaw }}
              value={highlightsRaw}
              onChange={(e) => setHighlightsRaw(e.target.value)}
              rows={3}
            />
          </FormField>

          <GenerateAllFieldsButton
            campaignId={campaignId!}
            entityType="session"
            entityDraft={{ title, date_played: datePlayed, summary, highlights: highlightsRaw }}
            fields={[
              { fieldName: 'title', onChange: (v) => setTitle(v) },
              { fieldName: 'summary', onChange: (v) => setSummary(v) },
              { fieldName: 'highlights', onChange: (v) => setHighlightsRaw(v) },
              ...(!isPlayerView ? [{ fieldName: 'dm_notes', onChange: (v: string) => setDmNotes(v) }] : []),
            ]}
          />

          <FormField label="XP awarded" htmlFor="edit-session-xp">
            <TextInput
              id="edit-session-xp"
              type="number"
              value={xpAwarded}
              onChange={(e) => setXpAwarded(e.target.value)}
              placeholder="0"
            />
          </FormField>

          {!isPlayerView && (
            <FormField
              label="DM Notes"
              htmlFor="edit-session-dm-notes"
              hint="Visible to DMs only — never shown to players"
            >
              <AITextarea
                id="edit-session-dm-notes"
                campaignId={campaignId!}
                entityType="session"
                fieldName="dm_notes"
                entityDraft={{ title, date_played: datePlayed, summary, highlights: highlightsRaw }}
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

  // ─── Derived data for dropdowns ────────────────────────────────────────────
  const linkedNpcIds = new Set(session.linked_npcs.map((n) => n.id));
  const linkedLocationIds = new Set(session.linked_locations.map((l) => l.id));

  const availableNpcOptions = [
    { value: '', label: '— Select an NPC —' },
    ...(npcsQuery.data?.npcs ?? [])
      .filter((n) => !linkedNpcIds.has(n.id))
      .map((n) => ({ value: n.id, label: n.name })),
  ];

  const availableLocationOptions = [
    { value: '', label: '— Select a location —' },
    ...(locationsQuery.data?.locations ?? [])
      .filter((l) => !linkedLocationIds.has(l.id))
      .map((l) => ({ value: l.id, label: l.name })),
  ];

  // ─── Read mode ─────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Session {session.session_number} — {session.title}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{session.date_played}</p>
        </div>

        {isDm && (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={openEdit}>
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (window.confirm('Delete this session? This cannot be undone.')) {
                  deleteMutation.mutate();
                }
              }}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      {session.summary && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Summary
          </h2>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {session.summary}
          </p>
        </section>
      )}

      {/* Highlights */}
      {session.highlights && session.highlights.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Highlights
          </h2>
          <ul className="space-y-1 list-disc list-inside text-slate-300 text-sm">
            {session.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      {/* XP */}
      {session.xp_awarded != null && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            Experience
          </h2>
          <p className="text-sm text-slate-300">
            XP: <span className="text-amber-400 font-medium">{session.xp_awarded}</span>
          </p>
        </section>
      )}

      {/* NPCs Present */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          NPCs Present
        </h2>

        {session.linked_npcs.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {session.linked_npcs.map((npc) => (
              <LinkedChip
                key={npc.id}
                name={npc.name}
                to={`/campaigns/${campaignId}/npcs/${npc.id}`}
                isDm={isDm}
                onRemove={() => removeNpcMutation.mutate(npc.id)}
                isRemoving={removeNpcMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 mb-3">No NPCs linked yet.</p>
        )}

        {isDm && (
          <div className="flex items-center gap-2">
            <div className="flex-1 max-w-xs">
              <Select
                id="add-npc-select"
                options={availableNpcOptions}
                value={selectedNpcId}
                onChange={setSelectedNpcId}
                placeholder="— Select an NPC —"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!selectedNpcId}
              isLoading={addNpcMutation.isPending}
              onClick={() => {
                if (selectedNpcId) addNpcMutation.mutate(selectedNpcId);
              }}
            >
              Add
            </Button>
          </div>
        )}
        {addNpcMutation.error && (
          <p role="alert" className="text-xs text-red-400 mt-1">
            Failed to add NPC. Please try again.
          </p>
        )}
      </section>

      {/* Locations Visited */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Locations Visited
        </h2>

        {session.linked_locations.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {session.linked_locations.map((loc) => (
              <LinkedChip
                key={loc.id}
                name={loc.name}
                to={`/campaigns/${campaignId}/locations/${loc.id}`}
                isDm={isDm}
                onRemove={() => removeLocationMutation.mutate(loc.id)}
                isRemoving={removeLocationMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 mb-3">No locations linked yet.</p>
        )}

        {isDm && (
          <div className="flex items-center gap-2">
            <div className="flex-1 max-w-xs">
              <Select
                id="add-location-select"
                options={availableLocationOptions}
                value={selectedLocationId}
                onChange={setSelectedLocationId}
                placeholder="— Select a location —"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!selectedLocationId}
              isLoading={addLocationMutation.isPending}
              onClick={() => {
                if (selectedLocationId) addLocationMutation.mutate(selectedLocationId);
              }}
            >
              Add
            </Button>
          </div>
        )}
        {addLocationMutation.error && (
          <p role="alert" className="text-xs text-red-400 mt-1">
            Failed to add location. Please try again.
          </p>
        )}
      </section>

      {/* DM Notes */}
      {session.dm_notes && !isPlayerView && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{session.dm_notes}</p>
        </div>
      )}
    </div>
  );
}
