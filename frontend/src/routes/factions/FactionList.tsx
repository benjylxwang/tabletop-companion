import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCampaign, fetchFactions, createFaction } from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  AITextInput,
  AITextarea,
  Button,
  GenerateAllFieldsButton,
  Modal,
  FormField,
  TextInput,
  EmptyState,
  ErrorDisplay,
} from '../../components';
import { EntityAvatar } from '../../components/ui/EntityAvatar';
import type { FactionCreate, FactionsResponse } from '@tabletop/shared';
import { Skeleton } from '../../components/ui/Skeleton';

function CreateFactionModal({
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
  const isPlayerView = viewMode === 'player';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [alignmentTone, setAlignmentTone] = useState('');
  const [dmNotes, setDmNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data: FactionCreate) => createFaction(campaignId, data),
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: ['factions', campaignId] });
      const previous = queryClient.getQueryData<FactionsResponse>(['factions', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<FactionsResponse>(['factions', campaignId, viewMode], {
          ...previous,
          factions: [
            ...previous.factions,
            {
              ...draft,
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      onClose();
      setName('');
      setDescription('');
      setGoals('');
      setAlignmentTone('');
      setDmNotes('');
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['factions', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['factions', campaignId] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      campaign_id: campaignId,
      name,
      description: description || undefined,
      goals: goals || undefined,
      alignment_tone: alignmentTone || undefined,
      dm_notes: dmNotes || undefined,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="New Faction" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" htmlFor="faction-name" required>
          <TextInput
            id="faction-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="The Iron Brotherhood"
          />
        </FormField>

        <FormField label="Description" htmlFor="faction-description">
          <AITextarea
            id="faction-description"
            campaignId={campaignId}
            entityType="faction"
            fieldName="description"
            entityDraft={{ name, description, goals, alignment_tone: alignmentTone }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this faction and what do they stand for?"
          />
        </FormField>

        <FormField label="Goals" htmlFor="faction-goals">
          <AITextarea
            id="faction-goals"
            campaignId={campaignId}
            entityType="faction"
            fieldName="goals"
            entityDraft={{ name, description, goals, alignment_tone: alignmentTone }}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={2}
            placeholder="Their objectives and ambitions…"
          />
        </FormField>

        <FormField label="Alignment / Tone" htmlFor="faction-alignment-tone">
          <AITextInput
            id="faction-alignment-tone"
            campaignId={campaignId}
            entityType="faction"
            fieldName="alignment_tone"
            entityDraft={{ name, description, goals, alignment_tone: alignmentTone }}
            value={alignmentTone}
            onChange={(e) => setAlignmentTone(e.target.value)}
            placeholder="Lawful Neutral, secretive, militaristic…"
          />
        </FormField>

        <GenerateAllFieldsButton
          campaignId={campaignId}
          entityType="faction"
          entityDraft={{ name, description, goals, alignment_tone: alignmentTone }}
          fields={[
            { fieldName: 'description', onChange: (v) => setDescription(v) },
            { fieldName: 'goals', onChange: (v) => setGoals(v) },
            { fieldName: 'alignment_tone', onChange: (v) => setAlignmentTone(v) },
            ...(!isPlayerView ? [{ fieldName: 'dm_notes', onChange: (v: string) => setDmNotes(v) }] : []),
          ]}
        />

        {!isPlayerView && (
          <FormField
            label="DM Notes"
            htmlFor="faction-dm-notes"
            hint="Visible to DMs only — hidden agendas, true leadership, planned role"
          >
            <AITextarea
              id="faction-dm-notes"
              campaignId={campaignId}
              entityType="faction"
              fieldName="dm_notes"
              entityDraft={{ name, description, goals, alignment_tone: alignmentTone }}
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              rows={4}
              placeholder="Secrets never shown to players."
            />
          </FormField>
        )}

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            Failed to create faction. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Create Faction
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FactionList() {
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
    queryKey: ['factions', campaignId, viewMode],
    queryFn: () => fetchFactions(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Factions</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            The organisations and powers shaping your world
          </p>
        </div>
        {isDm && (
          <Button onClick={() => setShowCreate(true)}>New Faction</Button>
        )}
      </div>

      {isLoading && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </ul>
      )}
      {error && <ErrorDisplay message="Failed to load factions." />}

      {data && data.factions.length === 0 && (
        <EmptyState
          title="No factions yet"
          description={
            isDm
              ? "Create your first faction to start building the world's power structures."
              : 'The DM has not introduced any factions yet.'
          }
          action={
            isDm ? { label: 'New Faction', onClick: () => setShowCreate(true) } : undefined
          }
        />
      )}

      {data && data.factions.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
          {data.factions.map((f) => (
            <li key={f.id}>
              <Link
                to={`/campaigns/${campaignId}/factions/${f.id}`}
                className="flex items-center gap-3 h-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:border-amber-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <EntityAvatar entityType="faction" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100 truncate">{f.name}</p>
                  {f.alignment_tone && (
                    <p className="text-sm text-slate-400 mt-0.5 truncate">{f.alignment_tone}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {campaignId && (
        <CreateFactionModal
          campaignId={campaignId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          isDm={isDm}
        />
      )}
    </div>
  );
}
