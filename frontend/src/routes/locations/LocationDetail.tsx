import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteLocation,
  fetchCampaign,
  fetchLocation,
  fetchLocations,
  updateLocation,
  uploadFile,
} from '../../lib/api';
import { useSignedUrl } from '../../lib/useSignedUrl';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  ErrorDisplay,
  FileUpload,
  FormField,
  Select,
  Spinner,
  TextInput,
  Textarea,
} from '../../components';

export default function LocationDetail() {
  const { id: campaignId, locationId } = useParams<{
    id: string;
    locationId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [editing, setEditing] = useState(false);

  const campaignQuery = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['location', campaignId, locationId, viewMode],
    queryFn: () => fetchLocation(campaignId!, locationId!, viewMode),
    enabled: !!campaignId && !!locationId,
  });

  // Needed both for the parent-picker in edit mode and for resolving the
  // parent's name in read mode.
  const locationsQuery = useQuery({
    queryKey: ['locations', campaignId, viewMode],
    queryFn: () => fetchLocations(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const location = data?.location;
  const isDm = campaignQuery.data?.campaign.my_role === 'dm';
  const parent = location?.parent_location_id
    ? locationsQuery.data?.locations.find((l) => l.id === location.parent_location_id)
    : undefined;

  // ─── Edit form state ────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState('');
  const [parentId, setParentId] = useState('');
  const [dmNotes, setDmNotes] = useState('');
  const [mapPath, setMapPath] = useState<string | null>(null);

  const mapSignedUrl = useSignedUrl(location?.map_image_url);

  function openEdit() {
    if (!location) return;
    setName(location.name);
    setType(location.type ?? '');
    setDescription(location.description ?? '');
    setHistory(location.history ?? '');
    setParentId(location.parent_location_id ?? '');
    setDmNotes(location.dm_notes ?? '');
    setMapPath(location.map_image_url ?? null);
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateLocation(campaignId!, locationId!, {
        name,
        // Send `null` (not `undefined`) for cleared optional fields so the API
        // actually clears the column. `undefined` would be dropped by
        // JSON.stringify and the partial update would silently keep the old value.
        type: type === '' ? null : type,
        description: description === '' ? null : description,
        history: history === '' ? null : history,
        map_image_url: mapPath,
        parent_location_id: parentId === '' ? null : parentId,
        dm_notes: dmNotes === '' ? null : dmNotes,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['location', campaignId, locationId, viewMode], updated);
      void queryClient.invalidateQueries({ queryKey: ['locations', campaignId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLocation(campaignId!, locationId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['locations', campaignId] });
      navigate(`/campaigns/${campaignId}/locations`);
    },
  });

  function handleDelete() {
    if (window.confirm('Delete this location? This cannot be undone.')) {
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
  if (error || !location) {
    return (
      <div className="p-8">
        <ErrorDisplay message="Failed to load location." />
      </div>
    );
  }

  // Parent dropdown: all locations except the one being edited (no self-parent).
  const parentOptions = [
    { value: '', label: '— None —' },
    ...(locationsQuery.data?.locations ?? [])
      .filter((l) => l.id !== locationId)
      .map((l) => ({ value: l.id, label: l.name })),
  ];

  // ─── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit Location</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Name" htmlFor="edit-loc-name" required>
            <TextInput
              id="edit-loc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Type" htmlFor="edit-loc-type">
            <TextInput
              id="edit-loc-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Town, Dungeon, Tavern, Region…"
            />
          </FormField>

          <FormField label="Parent Location" htmlFor="edit-loc-parent">
            <Select
              id="edit-loc-parent"
              options={parentOptions}
              value={parentId}
              onChange={setParentId}
              placeholder="— None —"
            />
          </FormField>

          <FormField label="Description" htmlFor="edit-loc-description">
            <Textarea
              id="edit-loc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </FormField>

          <FormField label="History" htmlFor="edit-loc-history">
            <Textarea
              id="edit-loc-history"
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              rows={3}
            />
          </FormField>

          <FormField
            label="Map Image"
            htmlFor="edit-loc-map"
            hint="PNG or JPG, up to 10 MB"
          >
            <FileUpload
              accept="image/png,image/jpeg"
              allowedMimeTypes={['image/png', 'image/jpeg']}
              currentPath={mapPath}
              currentUrl={mapSignedUrl.url}
              uploadFile={uploadFile}
              onUploaded={(result) => setMapPath(result?.path ?? null)}
            />
          </FormField>

          {!isPlayerView && (
            <FormField label="DM Notes" htmlFor="edit-loc-dm-notes" hint="Visible to DMs only">
              <Textarea
                id="edit-loc-dm-notes"
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={4}
              />
            </FormField>
          )}

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to update location. Please try again.
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
          <p className="text-xs text-slate-500 mb-1">
            <Link
              to={`/campaigns/${campaignId}/locations`}
              className="hover:text-amber-400 transition-colors"
            >
              Locations
            </Link>
            {parent && (
              <>
                {' / '}
                <Link
                  to={`/campaigns/${campaignId}/locations/${parent.id}`}
                  className="hover:text-amber-400 transition-colors"
                >
                  {parent.name}
                </Link>
              </>
            )}
          </p>
          <h1 className="text-2xl font-bold text-slate-100">{location.name}</h1>
          {location.type && (
            <p className="text-sm text-amber-400 mt-1 uppercase tracking-wide">
              {location.type}
            </p>
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
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {location.map_image_url && mapSignedUrl.url && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
          <img
            src={mapSignedUrl.url}
            alt={`Map of ${location.name}`}
            className="w-full max-h-96 object-contain"
          />
        </div>
      )}

      {location.description && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Description
          </h2>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {location.description}
          </p>
        </section>
      )}

      {location.history && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            History
          </h2>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {location.history}
          </p>
        </section>
      )}

      {parent && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Parent Location
          </h2>
          <Link
            to={`/campaigns/${campaignId}/locations/${parent.id}`}
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            {parent.name}
          </Link>
        </section>
      )}

      {location.dm_notes && !isPlayerView && (
        <section className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {location.dm_notes}
          </p>
        </section>
      )}
    </div>
  );
}
