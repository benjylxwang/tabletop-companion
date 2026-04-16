import { useCallback, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GenerateCampaignMode } from '@tabletop/shared';
import { generateCampaignAi } from '../lib/api';
import { useAIProvider } from '../contexts/AIProviderContext';
import { Button, FormField, Modal, Textarea } from '.';
import { useDevGeneratorShortcut } from '../hooks/useDevGeneratorShortcut';

export function DevGeneratorModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<GenerateCampaignMode>('new');
  const [seed, setSeed] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const campaignMatch = useMatch('/campaigns/:id/*');
  const currentCampaignId = campaignMatch?.params.id ?? null;
  const { provider } = useAIProvider();

  const onShortcut = useCallback(() => {
    setOpen((v) => !v);
    // Default to populate when opened from within a campaign.
    setMode(currentCampaignId ? 'populate' : 'new');
  }, [currentCampaignId]);
  useDevGeneratorShortcut(onShortcut);

  const mutation = useMutation({
    mutationFn: () =>
      generateCampaignAi({
        mode,
        campaign_id: mode === 'populate' ? currentCampaignId ?? undefined : undefined,
        seed: seed.trim() || undefined,
        provider,
      }),
    onSuccess: ({ campaign_id }) => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      void queryClient.invalidateQueries({ queryKey: ['campaign', campaign_id] });
      setOpen(false);
      setSeed('');
      navigate(`/campaigns/${campaign_id}`);
    },
  });

  function close() {
    if (mutation.isPending) return;
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Dev: generate campaign"
      description="Secret shortcut — populate or bootstrap a campaign with AI."
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Mode</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="new"
                checked={mode === 'new'}
                onChange={() => setMode('new')}
                disabled={mutation.isPending}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-ink-900">Create a new campaign</p>
                <p className="text-xs text-ink-500">
                  Spin up a fresh campaign + cast. You'll be made DM automatically.
                </p>
              </div>
            </label>
            <label
              className={`flex items-start gap-2 ${
                currentCampaignId ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="populate"
                checked={mode === 'populate'}
                onChange={() => setMode('populate')}
                disabled={!currentCampaignId || mutation.isPending}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-ink-900">Populate this campaign</p>
                <p className="text-xs text-ink-500">
                  {currentCampaignId
                    ? 'Adds sessions, NPCs, locations, factions, and lore to the campaign currently in view. Best on an empty campaign — existing rows are not deduped.'
                    : 'Navigate to a campaign first to enable this option.'}
                </p>
              </div>
            </label>
          </div>
        </div>

        <FormField
          label="Seed (optional)"
          htmlFor="dev-gen-seed"
          hint="A one-line vibe/setting. Leave blank to let the model choose."
        >
          <Textarea
            id="dev-gen-seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            rows={2}
            placeholder="e.g. a stormy pirate archipelago haunted by drowned gods"
            disabled={mutation.isPending}
          />
        </FormField>

        {mutation.error && (
          <p role="alert" className="text-sm text-crimson-600">
            Generation failed: {mutation.error.message}
          </p>
        )}

        {mutation.isPending && (
          <p className="text-xs text-ink-500">
            Generating… this typically takes 15–30 seconds.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            disabled={mode === 'populate' && !currentCampaignId}
          >
            Generate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
