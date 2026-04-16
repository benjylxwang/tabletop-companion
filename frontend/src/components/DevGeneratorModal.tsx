import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GenerateCampaignMode } from '@tabletop/shared';
import { generateCampaignAi, pollGenerationJob } from '../lib/api';
import { useAIProvider } from '../contexts/AIProviderContext';
import { Button, FormField, Modal, Textarea } from '.';
import { useDevGeneratorShortcut } from '../hooks/useDevGeneratorShortcut';

export function DevGeneratorModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<GenerateCampaignMode>('new');
  const [seed, setSeed] = useState('');
  const [generateImages, setGenerateImages] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const campaignMatch = useMatch('/campaigns/:id/*');
  const currentCampaignId = campaignMatch?.params.id ?? null;
  const { provider, setProvider } = useAIProvider();

  // Elapsed-time ticker shown during polling
  useEffect(() => {
    if (!jobId) {
      setElapsed(0);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      return;
    }
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [jobId]);

  // Polling loop
  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      try {
        const job = await pollGenerationJob(jobId);
        if (job.status === 'completed') {
          stopPolling();
          void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
          if (job.campaign_id) {
            void queryClient.invalidateQueries({ queryKey: ['campaign', job.campaign_id] });
            navigate(`/campaigns/${job.campaign_id}`);
          }
          resetAndClose();
        } else if (job.status === 'failed') {
          stopPolling();
          setJobId(null);
          setJobError(job.error ?? 'Generation failed');
        }
      } catch {
        // transient poll error — keep trying
      }
    };
    pollingRef.current = setInterval(() => void poll(), 3000);
    return stopPolling;
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  function resetAndClose() {
    setJobId(null);
    setJobError(null);
    setSeed('');
    setOpen(false);
  }

  const onShortcut = useCallback(() => {
    setOpen((v) => !v);
    setMode(currentCampaignId ? 'populate' : 'new');
  }, [currentCampaignId]);
  useDevGeneratorShortcut(onShortcut);

  const mutation = useMutation({
    mutationFn: () =>
      generateCampaignAi({
        mode,
        campaign_id: mode !== 'new' ? currentCampaignId ?? undefined : undefined,
        seed: mode !== 'generate_missing_images' ? seed.trim() || undefined : undefined,
        provider: mode !== 'generate_missing_images' ? provider : undefined,
        generate_images: mode === 'new' || mode === 'populate' ? generateImages || undefined : undefined,
      }),
    onSuccess: ({ job_id }) => {
      setJobError(null);
      setJobId(job_id);
    },
    onError: (err) => {
      setJobError(err.message);
    },
  });

  const isWorking = mutation.isPending || jobId !== null;

  function close() {
    if (isWorking) return;
    resetAndClose();
  }

  const needsCampaign = mode !== 'new';
  const submitDisabled = needsCampaign && !currentCampaignId;

  const statusMessage = () => {
    if (!jobId) return null;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const time = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    if (elapsed < 20) return 'Starting up…';
    return `Still working… ${time}`;
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Dev: generate campaign"
      description="Secret shortcut — populate or bootstrap a campaign with AI."
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {/* Mode */}
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
                disabled={isWorking}
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
                disabled={!currentCampaignId || isWorking}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-ink-900">Populate this campaign</p>
                <p className="text-xs text-ink-500">
                  {currentCampaignId
                    ? 'Adds sessions, NPCs, locations, factions, and lore to the campaign currently in view. Best on an empty campaign.'
                    : 'Navigate to a campaign first to enable this option.'}
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
                value="generate_missing_images"
                checked={mode === 'generate_missing_images'}
                onChange={() => setMode('generate_missing_images')}
                disabled={!currentCampaignId || isWorking}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-ink-900">Add missing images</p>
                <p className="text-xs text-ink-500">
                  {currentCampaignId
                    ? 'Generates cover art, NPC portraits, character portraits, and location art for any entity missing one. Uses DeepInfra FLUX.'
                    : 'Navigate to a campaign first to enable this option.'}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Provider toggle — not shown for image-only mode */}
        {mode !== 'generate_missing_images' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">AI Provider</p>
            <div
              className="flex rounded-md overflow-hidden border border-[#3d2a10] text-xs"
              role="group"
              aria-label="AI provider"
            >
              <button
                onClick={() => setProvider('anthropic')}
                aria-pressed={provider === 'anthropic'}
                disabled={isWorking}
                className={[
                  'flex flex-1 items-center justify-center py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500',
                  provider === 'anthropic'
                    ? 'bg-[rgba(212,160,23,0.12)] text-[#d4a017] font-semibold'
                    : 'bg-[#2a1a0a] text-[#b8860b] hover:text-[#f5f0e0]',
                ].join(' ')}
              >
                Claude (Anthropic)
              </button>
              <button
                onClick={() => setProvider('deepinfra')}
                aria-pressed={provider === 'deepinfra'}
                disabled={isWorking}
                className={[
                  'flex flex-1 items-center justify-center py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500',
                  provider === 'deepinfra'
                    ? 'bg-[rgba(212,160,23,0.12)] text-[#d4a017] font-semibold'
                    : 'bg-[#2a1a0a] text-[#b8860b] hover:text-[#f5f0e0]',
                ].join(' ')}
              >
                DeepInfra
              </button>
            </div>
          </div>
        )}

        {/* Seed — not shown for image-only mode */}
        {mode !== 'generate_missing_images' && (
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
              disabled={isWorking}
            />
          </FormField>
        )}

        {/* Generate images checkbox — not shown for image-only mode */}
        {mode !== 'generate_missing_images' && (
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={generateImages}
              onChange={(e) => setGenerateImages(e.target.checked)}
              disabled={isWorking}
              className="mt-0.5 accent-[#d4a017]"
            />
            <div>
              <p className="text-sm font-medium text-ink-900">Generate images</p>
              <p className="text-xs text-ink-500">
                Generates cover art, NPC portraits, character portraits, and location art via DeepInfra FLUX.
              </p>
            </div>
          </label>
        )}

        {/* Error display */}
        {jobError && (
          <p role="alert" className="text-sm text-crimson-600">
            {jobError}
          </p>
        )}
        {mutation.error && !jobError && (
          <p role="alert" className="text-sm text-crimson-600">
            {mutation.error.message}
          </p>
        )}

        {/* Status */}
        {jobId && (
          <p className="text-xs text-ink-500">{statusMessage()}</p>
        )}
        {mutation.isPending && !jobId && (
          <p className="text-xs text-ink-500">Submitting…</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={close} disabled={isWorking}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            isLoading={isWorking}
            disabled={submitDisabled || isWorking}
          >
            Generate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
