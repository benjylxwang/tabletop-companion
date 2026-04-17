import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createLocation,
  fetchCampaign,
  fetchLocations,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  AITextInput,
  AITextarea,
  Button,
  EmptyState,
  ErrorDisplay,
  FormField,
  GenerateAllFieldsButton,
  Modal,
  Select,
  TextInput,
} from '../../components';
import { Skeleton } from '../../components/ui/Skeleton';
import { EntityAvatar } from '../../components/ui/EntityAvatar';
import type { Location, LocationCreate, LocationsResponse } from '@tabletop/shared';

function CreateLocationModal({
  campaignId,
  open,
  onClose,
  locations,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
  locations: Location[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState('');
  const [parentId, setParentId] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  const { isPlayerView, viewMode } = useViewMode();

  function reset() {
    setName('');
    setType('');
    setDescription('');
    setHistory('');
    setParentId('');
    setDmNotes('');
  }

  const mutation = useMutation({
    mutationFn: (data: LocationCreate) => createLocation(campaignId, data),
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: ['locations', campaignId] });
      const previous = queryClient.getQueryData<LocationsResponse>(['locations', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<LocationsResponse>(['locations', campaignId, viewMode], {
          ...previous,
          locations: [
            ...previous.locations,
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
      reset();
      onClose();
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['locations', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['locations', campaignId] });
    },
  });

  // Parent stays mounted between opens; wipe field state and any prior error
  // on close so reopening starts clean.
  function handleClose() {
    reset();
    mutation.reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      name,
      type: type || undefined,
      description: description || undefined,
      history: history || undefined,
      parent_location_id: parentId || undefined,
      dm_notes: dmNotes || undefined,
    });
  }

  const parentOptions = [
    { value: '', label: '— None —' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <Modal open={open} onClose={handleClose} title="New Location" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" htmlFor="loc-name" required>
          <TextInput
            id="loc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Phandalin"
          />
        </FormField>

        <FormField label="Type" htmlFor="loc-type">
          <AITextInput
            id="loc-type"
            campaignId={campaignId}
            entityType="location"
            fieldName="type"
            entityDraft={{ name, type, description, history }}
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Town, Dungeon, Tavern, Region…"
          />
        </FormField>

        <FormField
          label="Parent Location"
          htmlFor="loc-parent"
          hint="Optional — place this inside another location"
        >
          <Select
            id="loc-parent"
            options={parentOptions}
            value={parentId}
            onChange={setParentId}
            placeholder="— None —"
          />
        </FormField>

        <FormField label="Description" htmlFor="loc-description">
          <AITextarea
            id="loc-description"
            campaignId={campaignId}
            entityType="location"
            fieldName="description"
            entityDraft={{ name, type, description, history }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What players observe — sights, sounds, smells…"
          />
        </FormField>

        <FormField label="History" htmlFor="loc-history">
          <AITextarea
            id="loc-history"
            campaignId={campaignId}
            entityType="location"
            fieldName="history"
            entityDraft={{ name, type, description, history }}
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            rows={3}
            placeholder="Background lore for this location…"
          />
        </FormField>

        <GenerateAllFieldsButton
          campaignId={campaignId}
          entityType="location"
          entityDraft={{ name, type, description, history }}
          fields={[
            { fieldName: 'type', onChange: (v) => setType(v) },
            { fieldName: 'description', onChange: (v) => setDescription(v) },
            { fieldName: 'history', onChange: (v) => setHistory(v) },
            ...(!isPlayerView ? [{ fieldName: 'dm_notes', onChange: (v: string) => setDmNotes(v) }] : []),
          ]}
        />

        {!isPlayerView && (
          <FormField label="DM Notes" htmlFor="loc-dm-notes" hint="Visible to DMs only">
            <AITextarea
              id="loc-dm-notes"
              campaignId={campaignId}
              entityType="location"
              fieldName="dm_notes"
              entityDraft={{ name, type, description, history }}
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={3}
              placeholder="Hidden areas, secret history, planned events…"
            />
          </FormField>
        )}

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            Failed to create location. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Create Location
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function LocationList() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { viewMode } = useViewMode();
  const [showCreate, setShowCreate] = useState(false);

  const campaignQuery = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['locations', campaignId, viewMode],
    queryFn: () => fetchLocations(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const isDm = campaignQuery.data?.campaign.my_role === 'dm';
  const locations = data?.locations ?? [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Locations</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Places in your campaign world
          </p>
        </div>
        {isDm && (
          <Button onClick={() => setShowCreate(true)}>New Location</Button>
        )}
      </div>

      {isLoading && (
        <ul className="space-y-3 max-w-2xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </ul>
      )}
      {error && <ErrorDisplay message="Failed to load locations." />}

      {data && locations.length === 0 && (
        <EmptyState
          title="No locations yet"
          description={
            isDm
              ? 'Add the places your party has visited or will visit.'
              : 'The DM hasn’t added any locations yet.'
          }
          action={isDm ? { label: 'New Location', onClick: () => setShowCreate(true) } : undefined}
        />
      )}

      {locations.length > 0 && (
        <ul className="space-y-3 max-w-2xl">
          {locations.map((l) => (
            <li key={l.id}>
              <Link
                to={`/campaigns/${campaignId}/locations/${l.id}`}
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <EntityAvatar imageUrl={l.map_image_url} entityType="location" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100 truncate">{l.name}</p>
                    {l.type && (
                      <span className="text-xs text-amber-400 uppercase tracking-wide shrink-0">
                        {l.type}
                      </span>
                    )}
                  </div>
                  {l.description && (
                    <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">
                      {l.description}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {campaignId && (
        <CreateLocationModal
          campaignId={campaignId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          locations={locations}
        />
      )}
    </div>
  );
}
