import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaign,
  fetchCampaignOverview,
  updateCampaign,
  deleteCampaign,
  uploadFile,
} from '../../lib/api';
import { useSignedUrl } from '../../lib/useSignedUrl';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  AITextarea,
  Button,
  FileUpload,
  FormField,
  GenerateAllFieldsButton,
  GenerateImageButton,
  TextInput,
  Select,
  Spinner,
  ErrorDisplay,
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
  // Storage path (not a URL) — persisted in cover_image_url column.
  const [coverPath, setCoverPath] = useState<string | null>(null);

  // Live preview in read mode + initial preview in edit mode.
  const coverSignedUrl = useSignedUrl(campaign?.cover_image_url);

  function openEdit() {
    if (!campaign) return;
    setName(campaign.name);
    setSystem(campaign.system ?? '');
    setDescription(campaign.description ?? '');
    setStatus(campaign.status);
    setDmNotes(campaign.dm_notes ?? '');
    setCoverPath(campaign.cover_image_url ?? null);
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCampaign(id!, {
        name,
        system: system || undefined,
        description: description || undefined,
        status,
        // `null` (not `undefined`) so clearing the cover actually nulls the
        // column — `undefined` would be dropped by JSON.stringify and the
        // old path would silently stick.
        cover_image_url: coverPath,
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
            <AITextarea
              id="edit-description"
              campaignId={id!}
              entityType="campaign"
              fieldName="description"
              entityDraft={{ name, system, description, status }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </FormField>

          <GenerateAllFieldsButton
            campaignId={id!}
            entityType="campaign"
            entityDraft={{ name, system, description, status }}
            fields={[
              { fieldName: 'description', onChange: (v) => setDescription(v) },
              ...(!isPlayerView ? [{ fieldName: 'dm_notes', onChange: (v: string) => setDmNotes(v) }] : []),
            ]}
          />

          <FormField label="Status" htmlFor="edit-status">
            <Select
              id="edit-status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => setStatus(v as CampaignStatusEnum)}
            />
          </FormField>

          <FormField
            label="Cover Image"
            htmlFor="edit-cover"
            hint="Upload a file or generate with AI"
          >
            <div className="space-y-2">
              <FileUpload
                accept="image/png,image/jpeg"
                allowedMimeTypes={['image/png', 'image/jpeg']}
                currentPath={coverPath}
                currentUrl={coverSignedUrl.url}
                uploadFile={uploadFile}
                onUploaded={(result) => setCoverPath(result?.path ?? null)}
              />
              <GenerateImageButton
                campaignId={id!}
                entityType="campaign"
                entityId={id!}
                fieldName="cover_image_url"
                onGenerated={(path) => setCoverPath(path)}
              />
            </div>
          </FormField>

          {!isPlayerView && (
            <FormField label="DM Notes" htmlFor="edit-dm-notes" hint="Visible to DMs only">
              <AITextarea
                id="edit-dm-notes"
                campaignId={id!}
                entityType="campaign"
                fieldName="dm_notes"
                entityDraft={{ name, system, description, status }}
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

      {campaign.cover_image_url && coverSignedUrl.url && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
          <img
            src={coverSignedUrl.url}
            alt={`Cover for ${campaign.name}`}
            className="w-full max-h-96 object-contain"
          />
        </div>
      )}

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

    </div>
  );
}
