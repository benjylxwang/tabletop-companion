import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import {
  fetchCampaign,
  fetchCampaignOverview,
  fetchLores,
  updateCampaign,
  deleteCampaign,
  uploadFile,
  createSession,
  createCharacter,
  createNpc,
  createLocation,
  createFaction,
  createLore,
} from '../../lib/api';
import { useSignedUrl } from '../../lib/useSignedUrl';
import { useViewMode } from '../../contexts/ViewModeContext';
import {
  AITextarea,
  Button,
  FileUpload,
  FormField,
  GenerateAllFieldsButton,
  GenerateImageButton,
  Modal,
  TextInput,
  Select,
  Spinner,
  ErrorDisplay,
} from '../../components';
import { EntityAvatar } from '../../components/ui/EntityAvatar';
import type {
  CampaignStatusEnum,
  NpcStatusEnum,
  LoreCategoryEnum,
  LoreVisibilityEnum,
  Location,
  CampaignResponse,
  SessionsResponse,
  CharactersResponse,
  NpcsResponse,
  LocationsResponse,
  FactionsResponse,
  LoreListResponse,
} from '@tabletop/shared';

const STATUS_OPTIONS: { value: CampaignStatusEnum; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Hiatus', label: 'Hiatus' },
  { value: 'Complete', label: 'Complete' },
];

const NPC_STATUS_OPTIONS: { value: NpcStatusEnum; label: string }[] = [
  { value: 'Alive', label: 'Alive' },
  { value: 'Dead', label: 'Dead' },
  { value: 'Unknown', label: 'Unknown' },
];

const LORE_CATEGORY_OPTIONS: { value: LoreCategoryEnum; label: string }[] = [
  { value: 'History', label: 'History' },
  { value: 'Magic', label: 'Magic' },
  { value: 'Religion', label: 'Religion' },
  { value: 'Politics', label: 'Politics' },
  { value: 'Other', label: 'Other' },
];

const LORE_VISIBILITY_OPTIONS: { value: LoreVisibilityEnum; label: string }[] = [
  { value: 'Public', label: 'Public' },
  { value: 'Private', label: 'Private' },
  { value: 'Revealed', label: 'Revealed' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Quick-add modals ─────────────────────────────────────────────────────────

function CreateSessionModal({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [sessionNumber, setSessionNumber] = useState('');
  const [title, setTitle] = useState('');
  const [datePlayed, setDatePlayed] = useState(todayIso);

  const mutation = useMutation({
    mutationFn: () =>
      createSession(campaignId, {
        campaign_id: campaignId,
        session_number: parseInt(sessionNumber, 10),
        title,
        date_played: datePlayed,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['sessions', campaignId] });
      const previous = queryClient.getQueryData<SessionsResponse>(['sessions', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<SessionsResponse>(['sessions', campaignId, viewMode], {
          ...previous,
          sessions: [
            ...previous.sessions,
            {
              id: crypto.randomUUID(),
              campaign_id: campaignId,
              session_number: parseInt(sessionNumber, 10),
              title,
              date_played: datePlayed,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      onClose();
      setSessionNumber('');
      setTitle('');
      setDatePlayed(todayIso());
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['sessions', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['campaign-overview', campaignId] });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New Session">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Session #" htmlFor="cs-num" required>
            <TextInput
              id="cs-num"
              type="number"
              value={sessionNumber}
              onChange={(e) => setSessionNumber(e.target.value)}
              required
              placeholder="1"
            />
          </FormField>
          <FormField label="Date Played" htmlFor="cs-date" required>
            <TextInput
              id="cs-date"
              type="date"
              value={datePlayed}
              onChange={(e) => setDatePlayed(e.target.value)}
              required
            />
          </FormField>
        </div>
        <FormField label="Title" htmlFor="cs-title" required>
          <TextInput
            id="cs-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="The Adventure Begins"
          />
        </FormField>
        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">Failed to create session.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={mutation.isPending}>Create Session</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateCharacterModal({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [charClass, setCharClass] = useState('');
  const [level, setLevel] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createCharacter(campaignId, {
        campaign_id: campaignId,
        name,
        player_name: playerName || undefined,
        class: charClass || undefined,
        level_tier: level ? parseInt(level, 10) : undefined,
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
              campaign_id: campaignId,
              name,
              player_name: playerName || undefined,
              class: charClass || undefined,
              level_tier: level ? parseInt(level, 10) : undefined,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      onClose();
      setName(''); setPlayerName(''); setCharClass(''); setLevel('');
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['characters', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['campaign-overview', campaignId] });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New Character">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-4"
      >
        <FormField label="Character Name" htmlFor="cc-name" required>
          <TextInput id="cc-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Aria Stormwind" />
        </FormField>
        <FormField label="Player Name" htmlFor="cc-player">
          <TextInput id="cc-player" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Player's real name" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Class" htmlFor="cc-class">
            <TextInput id="cc-class" value={charClass} onChange={(e) => setCharClass(e.target.value)} placeholder="Fighter" />
          </FormField>
          <FormField label="Level" htmlFor="cc-level">
            <TextInput id="cc-level" type="number" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="1" />
          </FormField>
        </div>
        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">Failed to create character.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={mutation.isPending}>Create Character</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateNpcModal({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [name, setName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [status, setStatus] = useState<NpcStatusEnum>('Alive');

  const mutation = useMutation({
    mutationFn: () =>
      createNpc(campaignId, { name, role_title: roleTitle || undefined, status }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['npcs', campaignId] });
      const previous = queryClient.getQueryData<NpcsResponse>(['npcs', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<NpcsResponse>(['npcs', campaignId, viewMode], {
          ...previous,
          npcs: [
            ...previous.npcs,
            {
              id: crypto.randomUUID(),
              campaign_id: campaignId,
              name,
              role_title: roleTitle || undefined,
              status,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      onClose();
      setName(''); setRoleTitle(''); setStatus('Alive');
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['npcs', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['npcs', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['campaign-overview', campaignId] });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New NPC">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-4"
      >
        <FormField label="Name" htmlFor="cn-name" required>
          <TextInput id="cn-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Tavern Keeper" />
        </FormField>
        <FormField label="Role / Title" htmlFor="cn-role">
          <TextInput id="cn-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Innkeeper of The Rusty Anchor" />
        </FormField>
        <FormField label="Status" htmlFor="cn-status">
          <Select id="cn-status" options={NPC_STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v as NpcStatusEnum)} />
        </FormField>
        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">Failed to create NPC.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={mutation.isPending}>Create NPC</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateLocationModal({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [name, setName] = useState('');
  const [type, setType] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createLocation(campaignId, { name, type: type || undefined }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['locations', campaignId] });
      const previous = queryClient.getQueryData<LocationsResponse>(['locations', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<LocationsResponse>(['locations', campaignId, viewMode], {
          ...previous,
          locations: [
            ...previous.locations,
            {
              id: crypto.randomUUID(),
              campaign_id: campaignId,
              name,
              type: type || undefined,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      onClose();
      setName(''); setType('');
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['locations', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['locations', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['campaign-overview', campaignId] });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New Location">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-4"
      >
        <FormField label="Name" htmlFor="cl-name" required>
          <TextInput id="cl-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="The Rusty Anchor Inn" />
        </FormField>
        <FormField label="Type" htmlFor="cl-type">
          <TextInput id="cl-type" value={type} onChange={(e) => setType(e.target.value)} placeholder="tavern, city, dungeon…" />
        </FormField>
        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">Failed to create location.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={mutation.isPending}>Create Location</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateFactionModal({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createFaction(campaignId, { campaign_id: campaignId, name }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['factions', campaignId] });
      const previous = queryClient.getQueryData<FactionsResponse>(['factions', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<FactionsResponse>(['factions', campaignId, viewMode], {
          ...previous,
          factions: [
            ...previous.factions,
            {
              id: crypto.randomUUID(),
              campaign_id: campaignId,
              name,
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
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['factions', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['factions', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['campaign-overview', campaignId] });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New Faction">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-4"
      >
        <FormField label="Name" htmlFor="cf-name" required>
          <TextInput id="cf-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="The Thieves' Guild" />
        </FormField>
        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">Failed to create faction.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={mutation.isPending}>Create Faction</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateLoreModal({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LoreCategoryEnum>('History');
  const [visibility, setVisibility] = useState<LoreVisibilityEnum>('Public');

  const mutation = useMutation({
    mutationFn: () =>
      createLore(campaignId, { campaign_id: campaignId, title, category, visibility }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['lores', campaignId] });
      const previous = queryClient.getQueryData<LoreListResponse>(['lores', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<LoreListResponse>(['lores', campaignId, viewMode], {
          ...previous,
          lore: [
            ...previous.lore,
            {
              id: crypto.randomUUID(),
              campaign_id: campaignId,
              title,
              category,
              visibility,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      onClose();
      setTitle(''); setCategory('History'); setVisibility('Public');
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['lores', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['lores', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['campaign-overview', campaignId] });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New Lore Entry">
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-4"
      >
        <FormField label="Title" htmlFor="clore-title" required>
          <TextInput id="clore-title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="The Fall of the Old Empire" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category" htmlFor="clore-cat">
            <Select id="clore-cat" options={LORE_CATEGORY_OPTIONS} value={category} onChange={(v) => setCategory(v as LoreCategoryEnum)} />
          </FormField>
          <FormField label="Visibility" htmlFor="clore-vis">
            <Select id="clore-vis" options={LORE_VISIBILITY_OPTIONS} value={visibility} onChange={(v) => setVisibility(v as LoreVisibilityEnum)} />
          </FormField>
        </div>
        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">Failed to create lore entry.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={mutation.isPending}>Create Lore Entry</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  viewAllHref,
  onAdd,
}: {
  title: string;
  count?: number;
  viewAllHref: string;
  onAdd?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {onAdd && (
          <Button size="sm" variant="secondary" onClick={onAdd}>
            + Add
          </Button>
        )}
        <Link to={viewAllHref} className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
          View all →
        </Link>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ count, label, href }: { count: number; label: string; href?: string }) {
  const inner = (
    <>
      <p className="text-2xl font-bold text-amber-400">{count}</p>
      <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{label}</p>
    </>
  );
  const cls =
    'text-center rounded-lg border border-slate-700 bg-slate-900 p-4 transition-colors';
  return href ? (
    <Link to={href} className={`${cls} hover:border-amber-500/50 block`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

// ─── Map preview ──────────────────────────────────────────────────────────────

function MapPreview({
  campaignId,
  worldMapUrl,
  locations,
}: {
  campaignId: string;
  worldMapUrl: string;
  locations: Location[];
}) {
  const { url } = useSignedUrl(worldMapUrl);
  const placed = locations.filter((l) => l.map_x != null && l.map_y != null);

  return (
    <Link
      to={`/campaigns/${campaignId}/map`}
      className="block group"
    >
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
        {url ? (
          <img src={url} alt="World map" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <MapPin size={32} className="text-slate-600" />
            <p className="text-xs text-slate-500">No map image set</p>
          </div>
        )}

        {/* Location dots */}
        {placed.map((l) => (
          <div
            key={l.id}
            className="absolute pointer-events-none flex flex-col items-center"
            style={{
              left: `${l.map_x! * 100}%`,
              top: `${l.map_y! * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-amber-600 shadow-sm" />
            <span className="mt-0.5 text-[10px] leading-tight font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">
              {l.name}
            </span>
          </div>
        ))}

        {/* Open map overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end p-3">
          <span className="text-xs text-white bg-black/60 px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            Open Map →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── NPC status badge ─────────────────────────────────────────────────────────

function NpcStatusBadge({ status }: { status: NpcStatusEnum }) {
  const cls: Record<NpcStatusEnum, string> = {
    Alive: 'bg-green-900/40 text-green-400 border-green-700/40',
    Dead: 'bg-red-900/40 text-red-400 border-red-700/40',
    Unknown: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls[status]}`}>
      {status}
    </span>
  );
}

// ─── Lore visibility badge ────────────────────────────────────────────────────

function LoreVisibilityBadge({ visibility }: { visibility: LoreVisibilityEnum }) {
  const cls: Record<LoreVisibilityEnum, string> = {
    Public: 'bg-blue-900/40 text-blue-400 border-blue-700/40',
    Private: 'bg-amber-900/40 text-amber-400 border-amber-700/40',
    Revealed: 'bg-purple-900/40 text-purple-400 border-purple-700/40',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${cls[visibility]}`}>
      {visibility}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, isPlayerView } = useViewMode();
  const [editing, setEditing] = useState(false);

  // Quick-add modal visibility
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateCharacter, setShowCreateCharacter] = useState(false);
  const [showCreateNpc, setShowCreateNpc] = useState(false);
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [showCreateFaction, setShowCreateFaction] = useState(false);
  const [showCreateLore, setShowCreateLore] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['campaign', id, viewMode],
    queryFn: () => fetchCampaign(id!, viewMode),
    enabled: !!id,
  });

  const { data: overviewData } = useQuery({
    queryKey: ['campaign-overview', id, viewMode],
    queryFn: () => fetchCampaignOverview(id!, viewMode),
    enabled: !!id,
  });

  const { data: loreData } = useQuery({
    queryKey: ['lores', id, viewMode],
    queryFn: () => fetchLores(id!, viewMode),
    enabled: !!id,
  });

  const campaign = data?.campaign;
  const isDm = campaign?.my_role === 'dm';
  const overview = overviewData?.overview;

  // ─── Edit form state ───────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [system, setSystem] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CampaignStatusEnum>('Active');
  const [dmNotes, setDmNotes] = useState('');
  const [coverPath, setCoverPath] = useState<string | null>(null);

  const coverSignedUrl = useSignedUrl(campaign?.cover_image_url);

  function openEdit() {
    if (!campaign) return;
    setName(campaign.name);
    setSystem(campaign.system ?? '');
    setDescription(campaign.description ?? '');
    setStatus(campaign.status);
    setDmNotes(campaign.dm_notes ?? '');
    setCoverPath(campaign.cover_image_url ?? null);
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCampaign(id!, {
        name,
        system: system || undefined,
        description: description || undefined,
        status,
        cover_image_url: coverPath,
        dm_notes: dmNotes || undefined,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['campaign', id, viewMode] });
      const previous = queryClient.getQueryData<CampaignResponse>(['campaign', id, viewMode]);
      if (previous) {
        queryClient.setQueryData<CampaignResponse>(['campaign', id, viewMode], {
          ...previous,
          campaign: {
            ...previous.campaign,
            name,
            system: system || undefined,
            description: description || undefined,
            status,
            cover_image_url: coverPath ?? undefined,
            dm_notes: dmNotes || undefined,
          },
        });
      }
      return { previous };
    },
    onSuccess: () => {
      setEditing(false);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['campaign', id, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCampaign(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/campaigns');
    },
  });

  function handleDelete() {
    if (window.confirm('Delete this campaign? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  }

  // ─── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-400">
        <Spinner size="sm" /> Loading…
      </div>
    );
  }
  if (error || !campaign) {
    return <div className="p-8"><ErrorDisplay message="Failed to load campaign." /></div>;
  }

  // ─── Edit mode ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Edit Campaign</h1>
        <form
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
          className="space-y-4"
        >
          <FormField label="Name" htmlFor="edit-name" required>
            <TextInput
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="System" htmlFor="edit-system">
            <TextInput
              id="edit-system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="D&D 5e, Pathfinder 2e, …"
            />
          </FormField>

          <FormField label="Description" htmlFor="edit-description">
            <AITextarea
              id="edit-description"
              campaignId={id!}
              entityType="campaign"
              fieldName="description"
              entityDraft={{ name, system, description, status }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </FormField>

          <GenerateAllFieldsButton
            campaignId={id!}
            entityType="campaign"
            entityDraft={{ name, system, description, status }}
            fields={[
              { fieldName: 'description', onChange: (v) => setDescription(v) },
              ...(!isPlayerView ? [{ fieldName: 'dm_notes', onChange: (v: string) => setDmNotes(v) }] : []),
            ]}
          />

          <FormField label="Status" htmlFor="edit-status">
            <Select
              id="edit-status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => setStatus(v as CampaignStatusEnum)}
            />
          </FormField>

          <FormField
            label="Cover Image"
            htmlFor="edit-cover"
            hint="Upload a file or generate with AI"
          >
            <div className="space-y-2">
              <FileUpload
                accept="image/png,image/jpeg"
                allowedMimeTypes={['image/png', 'image/jpeg']}
                currentPath={coverPath}
                currentUrl={coverSignedUrl.url}
                uploadFile={uploadFile}
                onUploaded={(result) => setCoverPath(result?.path ?? null)}
              />
              <GenerateImageButton
                campaignId={id!}
                entityType="campaign"
                entityId={id!}
                fieldName="cover_image_url"
                onGenerated={(path) => setCoverPath(path)}
              />
            </div>
          </FormField>

          {!isPlayerView && (
            <FormField label="DM Notes" htmlFor="edit-dm-notes" hint="Visible to DMs only">
              <AITextarea
                id="edit-dm-notes"
                campaignId={id!}
                entityType="campaign"
                fieldName="dm_notes"
                entityDraft={{ name, system, description, status }}
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                rows={4}
                placeholder="Private notes about this campaign…"
              />
            </FormField>
          )}

          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-400">
              Failed to update campaign. Please try again.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ─── Read mode ─────────────────────────────────────────────────────────────

  const dmActions = isDm && (
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
  );

  return (
    <div className="max-w-5xl">
      {/* ── Hero ── */}
      {campaign.cover_image_url && coverSignedUrl.url ? (
        <div className="relative overflow-hidden">
          <img
            src={coverSignedUrl.url}
            alt={`Cover for ${campaign.name}`}
            className="w-full max-h-72 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow">{campaign.name}</h1>
              <p className="text-sm text-slate-300 mt-1">
                {campaign.system && `${campaign.system} · `}
                <span className="text-amber-400">{campaign.status}</span>
              </p>
            </div>
            {dmActions}
          </div>
        </div>
      ) : (
        <div className="px-8 pt-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{campaign.name}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {campaign.system && `${campaign.system} · `}
              <span className="text-amber-400">{campaign.status}</span>
            </p>
          </div>
          {dmActions}
        </div>
      )}

      <div className="px-8 pb-12 space-y-8 mt-6">
        {/* ── Description + DM Notes ── */}
        {(campaign.description || (campaign.dm_notes && !isPlayerView)) && (
          <div className="space-y-4">
            {campaign.description && (
              <p className="text-slate-300 leading-relaxed">{campaign.description}</p>
            )}
            {campaign.dm_notes && !isPlayerView && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                  DM Notes
                </p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{campaign.dm_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Stats row ── */}
        {overview && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <StatCard count={overview.stats.sessions} label="Sessions" href={`/campaigns/${id}/sessions`} />
            <StatCard count={overview.stats.characters} label="Characters" href={`/campaigns/${id}/characters`} />
            <StatCard count={overview.stats.npcs} label="NPCs" href={`/campaigns/${id}/npcs`} />
            <StatCard count={overview.stats.locations} label="Locations" href={`/campaigns/${id}/locations`} />
            <StatCard count={overview.stats.factions} label="Factions" href={`/campaigns/${id}/factions`} />
            <StatCard count={overview.stats.lore} label="Lore" href={`/campaigns/${id}/lore`} />
          </div>
        )}

        {/* ── Sessions ── */}
        {overview && (
          <section>
            <SectionHeader
              title="Sessions"
              count={overview.stats.sessions}
              viewAllHref={`/campaigns/${id}/sessions`}
              onAdd={isDm ? () => setShowCreateSession(true) : undefined}
            />
            {overview.recent_sessions.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No sessions yet.</p>
            ) : (
              <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 overflow-hidden">
                {overview.recent_sessions.map((s) => (
                  <Link
                    key={s.id}
                    to={`/campaigns/${id}/sessions/${s.id}`}
                    className="flex items-start gap-3 p-3 bg-slate-900 hover:bg-slate-800 transition-colors"
                  >
                    <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded bg-slate-800 text-amber-400 text-xs font-bold">
                      {s.session_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">{s.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.date_played}</p>
                      {s.summary && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{s.summary}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Characters ── */}
        {overview && (
          <section>
            <SectionHeader
              title="Characters"
              count={overview.stats.characters}
              viewAllHref={`/campaigns/${id}/characters`}
              onAdd={isDm ? () => setShowCreateCharacter(true) : undefined}
            />
            {overview.characters.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No characters yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {overview.characters.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    to={`/campaigns/${id}/characters/${c.id}`}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-colors"
                  >
                    <EntityAvatar imageUrl={c.portrait_url} entityType="character" size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                      {(c.class || c.level_tier) && (
                        <p className="text-xs text-slate-500 truncate">
                          {c.class ?? ''}
                          {c.class && c.level_tier ? ' · ' : ''}
                          {c.level_tier ? `Lvl ${c.level_tier}` : ''}
                        </p>
                      )}
                      {c.player_name && (
                        <p className="text-xs text-slate-600 truncate">{c.player_name}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── NPCs ── */}
        {overview && (
          <section>
            <SectionHeader
              title="NPCs"
              count={overview.stats.npcs}
              viewAllHref={`/campaigns/${id}/npcs`}
              onAdd={isDm ? () => setShowCreateNpc(true) : undefined}
            />
            {overview.key_npcs.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No NPCs yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {overview.key_npcs.slice(0, 8).map((n) => (
                  <Link
                    key={n.id}
                    to={`/campaigns/${id}/npcs/${n.id}`}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-colors"
                  >
                    <EntityAvatar imageUrl={n.portrait_url} entityType="npc" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate">{n.name}</p>
                      {n.role_title && (
                        <p className="text-xs text-slate-500 truncate">{n.role_title}</p>
                      )}
                      <NpcStatusBadge status={n.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Locations ── */}
        {overview && (
          <section>
            <SectionHeader
              title="Locations"
              count={overview.stats.locations}
              viewAllHref={`/campaigns/${id}/locations`}
              onAdd={isDm ? () => setShowCreateLocation(true) : undefined}
            />
            {overview.locations.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No locations yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {overview.locations.slice(0, 6).map((l) => (
                  <Link
                    key={l.id}
                    to={`/campaigns/${id}/locations/${l.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-colors"
                  >
                    <EntityAvatar imageUrl={l.map_image_url} entityType="location" size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-medium text-slate-200 truncate">{l.name}</p>
                        {l.type && (
                          <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                            {l.type}
                          </span>
                        )}
                      </div>
                      {l.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">{l.description}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Factions ── */}
        {overview && (
          <section>
            <SectionHeader
              title="Factions"
              count={overview.stats.factions}
              viewAllHref={`/campaigns/${id}/factions`}
              onAdd={isDm ? () => setShowCreateFaction(true) : undefined}
            />
            {overview.factions.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No factions yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {overview.factions.map((f) => (
                  <Link
                    key={f.id}
                    to={`/campaigns/${id}/factions/${f.id}`}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-slate-200 mb-1">{f.name}</p>
                    {f.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{f.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Lore ── */}
        {loreData && (
          <section>
            <SectionHeader
              title="Lore"
              count={overview?.stats.lore}
              viewAllHref={`/campaigns/${id}/lore`}
              onAdd={isDm ? () => setShowCreateLore(true) : undefined}
            />
            {loreData.lore.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No lore entries yet.</p>
            ) : (
              <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 overflow-hidden">
                {loreData.lore.slice(0, 6).map((l) => (
                  <Link
                    key={l.id}
                    to={`/campaigns/${id}/lore/${l.id}`}
                    className="flex items-center gap-3 p-3 bg-slate-900 hover:bg-slate-800 transition-colors"
                  >
                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {l.category}
                    </span>
                    <p className="text-sm text-slate-200 flex-1 truncate">{l.title}</p>
                    <LoreVisibilityBadge visibility={l.visibility} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── World Map Preview ── */}
        {campaign.world_map_url && overview && (
          <section>
            <SectionHeader
              title="World Map"
              viewAllHref={`/campaigns/${id}/map`}
            />
            <MapPreview
              campaignId={id!}
              worldMapUrl={campaign.world_map_url}
              locations={overview.locations}
            />
          </section>
        )}
      </div>

      {/* ── Quick-add modals (DM only) ── */}
      {isDm && id && (
        <>
          <CreateSessionModal
            campaignId={id}
            open={showCreateSession}
            onClose={() => setShowCreateSession(false)}
          />
          <CreateCharacterModal
            campaignId={id}
            open={showCreateCharacter}
            onClose={() => setShowCreateCharacter(false)}
          />
          <CreateNpcModal
            campaignId={id}
            open={showCreateNpc}
            onClose={() => setShowCreateNpc(false)}
          />
          <CreateLocationModal
            campaignId={id}
            open={showCreateLocation}
            onClose={() => setShowCreateLocation(false)}
          />
          <CreateFactionModal
            campaignId={id}
            open={showCreateFaction}
            onClose={() => setShowCreateFaction(false)}
          />
          <CreateLoreModal
            campaignId={id}
            open={showCreateLore}
            onClose={() => setShowCreateLore(false)}
          />
        </>
      )}
    </div>
  );
}
