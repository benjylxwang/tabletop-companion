import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { GenerateFieldEntityType } from '@tabletop/shared';
import { generateEntityFieldsAi } from '../../lib/api';
import { useAIProvider } from '../../contexts/AIProviderContext';
import { Spinner } from './Spinner';

interface FieldSpec {
  fieldName: string;
  onChange: (value: string) => void;
}

interface GenerateAllFieldsButtonProps {
  campaignId: string;
  entityType: GenerateFieldEntityType;
  entityDraft?: Record<string, unknown>;
  fields: FieldSpec[];
  disabled?: boolean;
}

export function GenerateAllFieldsButton({
  campaignId,
  entityType,
  entityDraft,
  fields,
  disabled,
}: GenerateAllFieldsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const { provider } = useAIProvider();

  async function handleGenerate() {
    setLoading(true);
    setGenError(null);
    try {
      const result = await generateEntityFieldsAi({
        campaign_id: campaignId,
        entity_type: entityType,
        fields: fields.map((f) => f.fieldName),
        entity_draft: entityDraft,
        provider,
      });
      for (const { fieldName, onChange } of fields) {
        if (result.fields[fieldName] !== undefined) {
          onChange(result.fields[fieldName]);
        }
      }
    } catch (err) {
      console.error('generateEntityFieldsAi failed', err);
      setGenError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={disabled || loading || fields.length === 0}
        className="inline-flex items-center gap-2 self-start rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
        Fill all fields with AI
      </button>
      {genError && (
        <p role="alert" className="text-xs text-crimson-600">
          {genError}
        </p>
      )}
    </div>
  );
}
