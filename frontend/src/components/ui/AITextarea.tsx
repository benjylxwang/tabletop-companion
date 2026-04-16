import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { GenerateFieldEntityType } from '@tabletop/shared';
import { generateFieldAi } from '../../lib/api';
import { Textarea } from './Textarea';
import { Spinner } from './Spinner';

type BaseProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'>;

interface AITextareaProps extends BaseProps {
  campaignId: string;
  entityType: GenerateFieldEntityType;
  fieldName: string;
  entityDraft?: Record<string, unknown>;
  userHint?: string;
  error?: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

function synthEvent(value: string): React.ChangeEvent<HTMLTextAreaElement> {
  return { target: { value } } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
}

export function AITextarea({
  campaignId,
  entityType,
  fieldName,
  entityDraft,
  userHint,
  onChange,
  disabled,
  className = '',
  ...rest
}: AITextareaProps) {
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setGenError(null);
    try {
      const { text } = await generateFieldAi({
        campaign_id: campaignId,
        entity_type: entityType,
        field_name: fieldName,
        entity_draft: entityDraft,
        user_hint: userHint,
      });
      onChange(synthEvent(text));
    } catch (err) {
      console.error('generateFieldAi failed', err);
      setGenError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Textarea
          {...rest}
          onChange={onChange}
          disabled={disabled || loading}
          className={`pr-10 ${className}`}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={disabled || loading}
          title={`Generate ${fieldName} with AI`}
          aria-label={`Generate ${fieldName} with AI`}
          className="absolute top-2 right-2 flex items-center text-amber-600 hover:text-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
        </button>
      </div>
      {genError && (
        <p role="alert" className="text-xs text-crimson-600">
          {genError}
        </p>
      )}
    </div>
  );
}
