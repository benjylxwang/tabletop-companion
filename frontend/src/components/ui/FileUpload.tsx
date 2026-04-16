import { useId, useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface FileUploadProps {
  accept?: string;
  onChange: (file: File | null) => void;
  currentFileName?: string;
  disabled?: boolean;
  error?: boolean;
}

export function FileUpload({
  accept,
  onChange,
  currentFileName,
  disabled = false,
  error = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleFileChange}
        className="sr-only"
      />

      {currentFileName ? (
        <div
          className={[
            'flex items-center gap-2 rounded border px-3 py-2 bg-parchment-200',
            error ? 'border-crimson-600' : 'border-parchment-300',
          ].join(' ')}
        >
          <span className="flex-1 min-w-0 text-sm text-ink-700 truncate">
            {currentFileName}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-ink-500 hover:text-crimson-600 transition-colors"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={[
            'flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed',
            'px-4 py-6 cursor-pointer transition-colors duration-150',
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-parchment-200',
            error ? 'border-crimson-600' : 'border-parchment-300',
          ].join(' ')}
        >
          <Upload className="h-6 w-6 text-ink-300" />
          <span className="text-sm text-ink-500">
            Click to upload{accept ? ` (${accept})` : ''}
          </span>
        </label>
      )}
    </div>
  );
}
