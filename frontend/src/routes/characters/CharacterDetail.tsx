import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteCharacter,
  fetchCampaign,
  fetchCharacter,
  updateCharacter,
  uploadFile,
} from '../../lib/api';
import { useSignedUrl } from '../../lib/useSignedUrl';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  Button,
  ErrorDisplay,
  FileUpload,
  FormField,
  Spinner,
  TextInput,
} from '../../components';

// Minimal detail page scoped to Phase 3 (file uploads). Only `name` and
// `character_sheet_url` are editable here — the full character form (race,
// class, appearance, etc.) belongs in the Phase 2 Characters PR.

export default function CharacterDetail() {
  const { id: campaignId, charId } = useParams<{ id: string; charId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [editing, setEditing] = useState(false);

  const campaignQuery = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['character', campaignId, charId, viewMode],
    queryFn: () => fetchCharacter(campaignId!, charId!, viewMode),
    enabled: !!campaignId && !!charId,
  });

  const character = data?.character;
  const isDm = campaignQuery.data?.campaign.my_role === 'dm';

  // ─── Edit form state ────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [sheetPath, setSheetPath] = useState<string | null>(null);

  const sheetSignedUrl = useSignedUrl(character?.character_sheet_url);

  function openEdit() {
    if (!character) return;
    setName(character.name);
    setSheetPath(character.character_sheet_url ?? null);
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCharacter(campaignId!, charId!, {
        name,
        character_sheet_url: sheetPath,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['character', campaignId, charId, viewMode], updated);
      void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCharacter(campaignId!, charId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
      navigate(`/campaigns/${campaignId}/characters`);
    },
  });

  function handleDelete() {
    if (window.confirm('Delete this character? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  }

  // ─── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading…
      </div>
    );
  }
  if (error || !character) {
    return <div className="p-8"><ErrorDisplay message="Failed to load character." /></div>;
  }

  // ─── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <p className="text-xs text-slate-500 mb-4">
          <Link
            to={`/campaigns/${campaignId}/characters`}
            className="hover:text-amber-400 transition-colors"
          >
            Characters
          </Link>
        </p>
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit Character</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Name" htmlFor="edit-char-name" required>
            <TextInput
              id="edit-char-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <FormField
            label="Character Sheet"
            htmlFor="edit-char-sheet"
            hint="PDF, PNG, or JPG — up to 10 MB"
          >
            <FileUpload
              accept=".pdf,image/png,image/jpeg"
              currentPath={sheetPath}
              currentUrl={sheetSignedUrl.url}
              uploadFile={uploadFile}
              onUploaded={(result) => setSheetPath(result?.path ?? null)}
            />
          </FormField>

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to update character. Please try again.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ─── Read mode ──────────────────────────────────────────────────────────────
  const signedUrl = sheetSignedUrl.url;
  const isPdf =
    character.character_sheet_url != null &&
    /\.pdf(\?|$)/i.test(signedUrl ?? character.character_sheet_url);
  const isImage = character.character_sheet_url != null && !isPdf && Boolean(signedUrl);

  return (
    <div className="p-8 max-w-3xl">
      <p className="text-xs text-slate-500 mb-1">
        <Link
          to={`/campaigns/${campaignId}/characters`}
          className="hover:text-amber-400 transition-colors"
        >
          Characters
        </Link>
      </p>

      <div className="flex items-start justify-between gap-4 mt-2">
        <h1 className="text-2xl font-bold text-slate-100">{character.name}</h1>

        {isDm && (
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={openEdit}>
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {character.character_sheet_url != null && !sheetSignedUrl.isLoading && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Character Sheet
            </h2>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                Open in new tab ↗
              </a>
            )}
          </div>

          {signedUrl && isPdf && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <iframe
                src={signedUrl}
                title="Character sheet"
                className="w-full h-[70vh]"
                aria-label={`Character sheet for ${character.name}`}
              />
            </div>
          )}

          {signedUrl && isImage && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <img
                src={signedUrl}
                alt={`Character sheet for ${character.name}`}
                className="w-full object-contain"
              />
            </div>
          )}
        </section>
      )}

      {character.dm_notes && !isPlayerView && (
        <section className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            DM Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {character.dm_notes}
          </p>
        </section>
      )}
    </div>
  );
}
