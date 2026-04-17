import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCharacter,
  fetchCampaign,
  fetchCharacters,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  EmptyState,
  ErrorDisplay,
  FormField,
  TextInput,
} from '../../components';
import { EntityAvatar } from '../../components/ui/EntityAvatar';
import { Skeleton } from '../../components/ui/Skeleton';
import type { CharactersResponse } from '@tabletop/shared';

// Minimal list to support Phase 3 character-sheet uploads. Fuller character
// management (race, class, appearance, etc.) belongs in the Phase 2 Characters
// PR. Only `name` is required by the API; everything else can be filled in on
// the detail page.

export default function CharacterList() {
  const { id: campaignId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const campaignQuery = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['characters', campaignId, viewMode],
    queryFn: () => fetchCharacters(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const isDm = campaignQuery.data?.campaign.my_role === 'dm';

  const createMutation = useMutation({
    mutationFn: () =>
      createCharacter(campaignId!, {
        campaign_id: campaignId!,
        name: newName.trim(),
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['characters', campaignId] });
      const previous = queryClient.getQueryData<CharactersResponse>(['characters', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<CharactersResponse>(['characters', campaignId, viewMode], {
          ...previous,
          characters: [
            ...previous.characters,
            {
              id: crypto.randomUUID(),
              campaign_id: campaignId!,
              name: newName.trim(),
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      setCreating(false);
      setNewName('');
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['characters', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
    },
  });

  const characters = data?.characters ?? [];

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Characters</h1>
        {isDm && !creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New Character
          </Button>
        )}
      </div>

      {isLoading && (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </ul>
      )}

      {error && !isLoading && (
        <ErrorDisplay message="Failed to load characters." />
      )}

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createMutation.mutate();
          }}
          className="mb-6 space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
        >
          <FormField label="Name" htmlFor="new-char-name" required>
            <TextInput
              id="new-char-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
            />
          </FormField>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              isLoading={createMutation.isPending}
              disabled={!newName.trim()}
            >
              Create
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!isLoading && !error && characters.length === 0 && (
        <EmptyState
          title="No characters yet"
          description={isDm ? 'Create a character to track a PC.' : 'The DM has not added any characters.'}
        />
      )}

      {!isLoading && !error && characters.length > 0 && (
        <ul className="space-y-2">
          {characters.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <Link
                to={`/campaigns/${campaignId}/characters/${c.id}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <EntityAvatar imageUrl={c.portrait_url} entityType="character" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">{c.name}</p>
                  {c.player_name && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Played by {c.player_name}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
