import { useCallback, useId, useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { UPLOAD_MAX_BYTES, UPLOAD_MIME_TYPES } from '@tabletop/shared';

export interface UploadedFile {
  path: string;
  url: string;
  contentType: string;
}

export interface FileUploadProps {
  accept?: string;
  disabled?: boolean;
  maxBytes?: number;
  allowedMimeTypes?: readonly string[];

  // Existing uploaded file (path stored on the parent row, URL for preview).
  currentPath?: string | null;
  currentUrl?: string | null;
  currentFileName?: string;

  // The caller supplies an upload function — typically `uploadFile` from
  // lib/api.ts. Extracting it as a prop keeps this component easy to test and
  // reuse in Storybook-style previews with a stubbed uploader.
  uploadFile?: (
    file: File,
    onProgress?: (pct: number) => void,
  ) => Promise<UploadedFile>;

  // Fires with `null` when the current file is cleared.
  onUploaded?: (result: UploadedFile | null) => void;

  // Back-compat: lets callers use this as a plain file picker without upload.
  onChange?: (file: File | null) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  accept,
  disabled = false,
  maxBytes = UPLOAD_MAX_BYTES,
  allowedMimeTypes = UPLOAD_MIME_TYPES,
  currentPath,
  currentUrl,
  currentFileName,
  uploadFile,
  onUploaded,
  onChange,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<{
    name: string;
    url: string;
    contentType: string;
  } | null>(null);

  function validate(file: File): string | null {
    if (!allowedMimeTypes.includes(file.type)) {
      return 'Unsupported file type — use PNG, JPG, or PDF.';
    }
    if (file.size > maxBytes) {
      return `File is too large (${formatBytes(file.size)}). Max is ${formatBytes(maxBytes)}.`;
    }
    return null;
  }

  const handleFile = useCallback(
    async (file: File | null) => {
      setError(null);

      if (!file) {
        setLocalFile(null);
        setProgress(null);
        onChange?.(null);
        onUploaded?.(null);
        return;
      }

      const validationError = validate(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      onChange?.(file);

      if (!uploadFile) return;

      try {
        setProgress(0);
        const result = await uploadFile(file, setProgress);
        setLocalFile({
          name: file.name,
          url: result.url,
          contentType: result.contentType,
        });
        onUploaded?.(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setProgress(null);
      }
    },
    // The validation callback depends on props; React's exhaustive-deps rule
    // would want them here, but inlining the check keeps the dependency list
    // stable across renders — props rarely change identity for this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadFile, onChange, onUploaded],
  );

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFile(e.target.files?.[0] ?? null);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    void handleFile(e.dataTransfer.files?.[0] ?? null);
  }

  function onDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (!disabled) setDragActive(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
  }

  function clear(e: React.MouseEvent) {
    e.preventDefault();
    if (inputRef.current) inputRef.current.value = '';
    setLocalFile(null);
    setProgress(null);
    setError(null);
    onChange?.(null);
    onUploaded?.(null);
  }

  // ─── What should we show as the "current" state? ─────────────────────────
  // Priority: freshly-uploaded local file → persisted path from props.
  const displayName = localFile?.name ?? currentFileName ?? currentPath ?? null;
  const displayUrl = localFile?.url ?? currentUrl ?? null;
  const displayContentType = localFile?.contentType ?? null;
  const isImage =
    displayContentType?.startsWith('image/') ??
    Boolean(displayUrl && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(displayUrl));
  const hasFile = Boolean(displayName || displayUrl);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled || progress !== null}
        onChange={onInputChange}
        className="sr-only"
      />

      {hasFile ? (
        <div className="rounded border border-slate-700 bg-slate-900 p-3 space-y-2">
          {displayUrl && isImage && (
            <img
              src={displayUrl}
              alt={displayName ?? 'Uploaded file'}
              className="max-h-40 w-full rounded object-contain bg-slate-950"
            />
          )}
          {displayUrl && !isImage && (
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <FileText className="h-5 w-5 shrink-0 text-slate-400" />
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 truncate text-amber-400 hover:text-amber-300 transition-colors"
              >
                {displayName ?? 'Open file'}
              </a>
            </div>
          )}
          {displayUrl && isImage && displayName && (
            <p className="text-xs text-slate-400 truncate">{displayName}</p>
          )}
          {!disabled && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={[
            'flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed',
            'px-4 py-6 transition-colors duration-150 text-center',
            disabled
              ? 'opacity-50 cursor-not-allowed border-slate-700'
              : 'cursor-pointer hover:bg-slate-800/50',
            error
              ? 'border-red-500'
              : dragActive
                ? 'border-amber-500 bg-slate-800/60'
                : 'border-slate-700',
          ].join(' ')}
        >
          <Upload className="h-6 w-6 text-slate-500" />
          <span className="text-sm text-slate-400">
            {dragActive
              ? 'Drop to upload'
              : `Click or drag to upload${accept ? ` (${accept})` : ''}`}
          </span>
        </label>
      )}

      {progress !== null && (
        <div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-amber-500 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400" role="status">
            Uploading… {Math.round(progress)}%
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
