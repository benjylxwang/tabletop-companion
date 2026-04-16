import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { GenerateImageEntityType } from '@tabletop/shared';
import { generateImageAi } from '../../lib/api';
import { Spinner } from './Spinner';

interface GenerateImageButtonProps {
  campaignId: string;
  entityType: GenerateImageEntityType;
  entityId: string;
  fieldName: 'cover_image_url' | 'map_image_url' | 'portrait_url';
  promptHint?: string;
  onGenerated: (path: string) => void;
  disabled?: boolean;
}

export function GenerateImageButton({
  campaignId,
  entityType,
  entityId,
  fieldName,
  promptHint,
  onGenerated,
  disabled,
}: GenerateImageButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateImageAi({
        campaign_id: campaignId,
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
        prompt_hint: promptHint,
      });
      onGenerated(result.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={disabled || loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-600/40 bg-amber-600/10 px-2.5 py-1.5 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Spinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? 'Generating…' : 'Generate with AI'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
