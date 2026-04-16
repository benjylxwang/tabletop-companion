import { z } from 'zod';

export const ViewMode = z.enum(['dm', 'player']);
export type ViewMode = z.infer<typeof ViewMode>;

export const HealthResponse = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime({ offset: true }),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const MeResponse = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email().nullable(),
  }),
});
export type MeResponse = z.infer<typeof MeResponse>;

// Public runtime config the frontend needs before it can talk to Supabase Auth.
// Served from the API so frontend Railway deploys don't need their own copy of
// these secrets — the anon key is public anyway.
export const ConfigResponse = z.object({
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string().min(1),
  }),
});
export type ConfigResponse = z.infer<typeof ConfigResponse>;

// ─── Enums ───────────────────────────────────────────────────────────────────

export const CampaignStatusEnum = z.enum(['Active', 'Hiatus', 'Complete']);
export type CampaignStatusEnum = z.infer<typeof CampaignStatusEnum>;

export const RoleEnum = z.enum(['dm', 'player']);
export type RoleEnum = z.infer<typeof RoleEnum>;

export const NpcStatusEnum = z.enum(['Alive', 'Dead', 'Unknown']);
export type NpcStatusEnum = z.infer<typeof NpcStatusEnum>;

export const LoreCategoryEnum = z.enum(['History', 'Magic', 'Religion', 'Politics', 'Other']);
export type LoreCategoryEnum = z.infer<typeof LoreCategoryEnum>;

export const LoreVisibilityEnum = z.enum(['Public', 'Private', 'Revealed']);
export type LoreVisibilityEnum = z.infer<typeof LoreVisibilityEnum>;

// ─── Campaign ────────────────────────────────────────────────────────────────

export const Campaign = z.object({
  id: z.string(),
  name: z.string(),
  system: z.string().optional(),
  description: z.string().optional(),
  cover_image_url: z.string().optional(),
  status: CampaignStatusEnum,
  created_at: z.string().datetime({ offset: true }),
  dm_notes: z.string().optional(),
});
export type Campaign = z.infer<typeof Campaign>;

export const CampaignPlayer = Campaign.omit({ dm_notes: true });
export type CampaignPlayer = z.infer<typeof CampaignPlayer>;

export const CampaignCreate = Campaign.omit({ id: true, created_at: true });
export type CampaignCreate = z.infer<typeof CampaignCreate>;

// `cover_image_url` uses `.nullish()` so clients can send `null` to clear an
// uploaded cover (partial updates drop `undefined`, so `null` is the only way
// to tell the server "set this to NULL"). Other fields remain optional to
// avoid broadening clear-semantics beyond what the rest of the form needs.
export const CampaignUpdate = CampaignCreate.partial().extend({
  cover_image_url: z.string().nullish(),
});
export type CampaignUpdate = z.infer<typeof CampaignUpdate>;

export const CampaignWithRole = Campaign.extend({ my_role: RoleEnum });
export type CampaignWithRole = z.infer<typeof CampaignWithRole>;

export const CampaignsResponse = z.object({ campaigns: z.array(CampaignWithRole) });
export type CampaignsResponse = z.infer<typeof CampaignsResponse>;

export const CampaignResponse = z.object({ campaign: CampaignWithRole });
export type CampaignResponse = z.infer<typeof CampaignResponse>;

// ─── CampaignMember ──────────────────────────────────────────────────────────

export const CampaignMember = z.object({
  campaign_id: z.string(),
  user_id: z.string(),
  role: RoleEnum,
  joined_at: z.string().datetime({ offset: true }),
});
export type CampaignMember = z.infer<typeof CampaignMember>;

export const CampaignMemberPlayer = CampaignMember;
export type CampaignMemberPlayer = z.infer<typeof CampaignMemberPlayer>;

export const CampaignMemberCreate = CampaignMember.omit({ joined_at: true });
export type CampaignMemberCreate = z.infer<typeof CampaignMemberCreate>;

export const CampaignMemberUpdate = CampaignMemberCreate.partial();
export type CampaignMemberUpdate = z.infer<typeof CampaignMemberUpdate>;

export const CampaignMembersResponse = z.object({ members: z.array(CampaignMember) });
export type CampaignMembersResponse = z.infer<typeof CampaignMembersResponse>;

export const CampaignMemberResponse = z.object({ member: CampaignMember });
export type CampaignMemberResponse = z.infer<typeof CampaignMemberResponse>;

// ─── CampaignInvitation ───────────────────────────────────────────────────────

export const InvitationStatusEnum = z.enum(['pending', 'accepted', 'declined']);
export type InvitationStatusEnum = z.infer<typeof InvitationStatusEnum>;

export const CampaignInvitation = z.object({
  id: z.string(),
  campaign_id: z.string(),
  invited_user_id: z.string(),
  invited_by_user_id: z.string(),
  status: InvitationStatusEnum,
  created_at: z.string().datetime({ offset: true }),
});
export type CampaignInvitation = z.infer<typeof CampaignInvitation>;

// Includes campaign info for the invitee's list view
export const CampaignInvitationWithCampaign = CampaignInvitation.extend({
  campaign_name: z.string(),
  campaign_system: z.string().optional(),
  campaign_status: CampaignStatusEnum,
});
export type CampaignInvitationWithCampaign = z.infer<typeof CampaignInvitationWithCampaign>;

export const CampaignInvitationResponse = z.object({ invitation: CampaignInvitation });
export type CampaignInvitationResponse = z.infer<typeof CampaignInvitationResponse>;

// For the invitee: pending invitations with campaign details
export const CampaignInvitationsResponse = z.object({ invitations: z.array(CampaignInvitationWithCampaign) });
export type CampaignInvitationsResponse = z.infer<typeof CampaignInvitationsResponse>;

// For the DM: pending invitations for a specific campaign (no campaign details needed)
export const CampaignPendingInvitationsResponse = z.object({ invitations: z.array(CampaignInvitation) });
export type CampaignPendingInvitationsResponse = z.infer<typeof CampaignPendingInvitationsResponse>;

// ─── Session ─────────────────────────────────────────────────────────────────

export const Session = z.object({
  id: z.string(),
  campaign_id: z.string(),
  session_number: z.number().int(),
  title: z.string(),
  date_played: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  xp_awarded: z.number().int().optional(),
  created_at: z.string().datetime({ offset: true }),
  dm_notes: z.string().optional(),
});
export type Session = z.infer<typeof Session>;

export const SessionPlayer = Session.omit({ dm_notes: true });
export type SessionPlayer = z.infer<typeof SessionPlayer>;

export const SessionCreate = Session.omit({ id: true, created_at: true });
export type SessionCreate = z.infer<typeof SessionCreate>;

export const SessionUpdate = SessionCreate.partial();
export type SessionUpdate = z.infer<typeof SessionUpdate>;

export const SessionsResponse = z.object({ sessions: z.array(Session) });
export type SessionsResponse = z.infer<typeof SessionsResponse>;

export const SessionResponse = z.object({ session: Session });
export type SessionResponse = z.infer<typeof SessionResponse>;

// ─── Character ───────────────────────────────────────────────────────────────

export const Character = z.object({
  id: z.string(),
  campaign_id: z.string(),
  name: z.string(),
  player_name: z.string().nullish(),
  race_species: z.string().nullish(),
  'class': z.string().nullish(),
  level_tier: z.number().int().nullish(),
  backstory: z.string().nullish(),
  appearance: z.string().nullish(),
  personality: z.string().nullish(),
  goals_bonds: z.string().nullish(),
  character_sheet_url: z.string().nullish(),
  portrait_url: z.string().nullish(),
  journal: z.string().nullish(),
  created_at: z.string().datetime({ offset: true }),
  dm_notes: z.string().nullish(),
});
export type Character = z.infer<typeof Character>;

export const CharacterPlayer = Character.omit({ dm_notes: true });
export type CharacterPlayer = z.infer<typeof CharacterPlayer>;

export const CharacterCreate = Character.omit({ id: true, created_at: true });
export type CharacterCreate = z.infer<typeof CharacterCreate>;

export const CharacterUpdate = CharacterCreate.partial();
export type CharacterUpdate = z.infer<typeof CharacterUpdate>;

export const CharactersResponse = z.object({ characters: z.array(Character) });
export type CharactersResponse = z.infer<typeof CharactersResponse>;

export const CharacterResponse = z.object({ character: Character });
export type CharacterResponse = z.infer<typeof CharacterResponse>;

// ─── Npc ─────────────────────────────────────────────────────────────────────

export const Npc = z.object({
  id: z.string(),
  campaign_id: z.string(),
  name: z.string(),
  role_title: z.string().optional(),
  alignment: z.string().optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  relationships: z.string().optional(),
  status: NpcStatusEnum,
  first_appeared_session_id: z.string().optional(),
  faction_id: z.string().optional(),
  portrait_url: z.string().optional(),
  created_at: z.string().datetime({ offset: true }),
  dm_notes: z.string().optional(),
});
export type Npc = z.infer<typeof Npc>;

export const NpcPlayer = Npc.omit({ dm_notes: true });
export type NpcPlayer = z.infer<typeof NpcPlayer>;

// campaign_id is omitted — the URL supplies it, and the server won't trust a
// client-sent value for placement.
export const NpcCreate = Npc.omit({
  id: true,
  created_at: true,
  campaign_id: true,
});
export type NpcCreate = z.infer<typeof NpcCreate>;

export const NpcUpdate = NpcCreate.partial();
export type NpcUpdate = z.infer<typeof NpcUpdate>;

export const NpcsResponse = z.object({ npcs: z.array(Npc) });
export type NpcsResponse = z.infer<typeof NpcsResponse>;

export const NpcResponse = z.object({ npc: Npc });
export type NpcResponse = z.infer<typeof NpcResponse>;

// ─── Location ────────────────────────────────────────────────────────────────

export const Location = z.object({
  id: z.string(),
  campaign_id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
  history: z.string().optional(),
  map_image_url: z.string().optional(),
  parent_location_id: z.string().optional(),
  created_at: z.string().datetime({ offset: true }),
  dm_notes: z.string().optional(),
});
export type Location = z.infer<typeof Location>;

export const LocationPlayer = Location.omit({ dm_notes: true });
export type LocationPlayer = z.infer<typeof LocationPlayer>;

// campaign_id is omitted — the URL supplies it, and the server won't trust a
// client-sent value for placement.
export const LocationCreate = Location.omit({
  id: true,
  created_at: true,
  campaign_id: true,
});
export type LocationCreate = z.infer<typeof LocationCreate>;

// Optional fields use `.nullish()` so a client can send `null` to explicitly
// clear a field (PATCH-style partial updates drop `undefined`, so `null` is
// the only way to tell the server "set this column to NULL").
export const LocationUpdate = z.object({
  name: z.string().optional(),
  type: z.string().nullish(),
  description: z.string().nullish(),
  history: z.string().nullish(),
  map_image_url: z.string().nullish(),
  parent_location_id: z.string().nullish(),
  dm_notes: z.string().nullish(),
});
export type LocationUpdate = z.infer<typeof LocationUpdate>;

export const LocationsResponse = z.object({ locations: z.array(Location) });
export type LocationsResponse = z.infer<typeof LocationsResponse>;

export const LocationResponse = z.object({ location: Location });
export type LocationResponse = z.infer<typeof LocationResponse>;

// ─── Faction ─────────────────────────────────────────────────────────────────

export const Faction = z.object({
  id: z.string(),
  campaign_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  goals: z.string().optional(),
  alignment_tone: z.string().optional(),
  created_at: z.string().datetime({ offset: true }),
  dm_notes: z.string().optional(),
});
export type Faction = z.infer<typeof Faction>;

export const FactionPlayer = Faction.omit({ dm_notes: true });
export type FactionPlayer = z.infer<typeof FactionPlayer>;

export const FactionCreate = Faction.omit({ id: true, created_at: true });
export type FactionCreate = z.infer<typeof FactionCreate>;

export const FactionUpdate = FactionCreate.partial();
export type FactionUpdate = z.infer<typeof FactionUpdate>;

export const FactionsResponse = z.object({ factions: z.array(Faction) });
export type FactionsResponse = z.infer<typeof FactionsResponse>;

export const FactionResponse = z.object({ faction: Faction });
export type FactionResponse = z.infer<typeof FactionResponse>;

// ─── Uploads ─────────────────────────────────────────────────────────────────
//
// Files live in a private Supabase Storage bucket. The API returns a short-lived
// signed URL for immediate display plus the opaque storage `path` that's safe to
// persist on domain rows (URLs expire; paths don't). Entity columns like
// `cover_image_url` / `character_sheet_url` / `map_image_url` therefore store the
// path — the frontend calls `/api/uploads/sign` to get a fresh signed URL when
// rendering.

export const UPLOAD_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const;
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const UploadResponse = z.object({
  path: z.string(),
  url: z.string().url(),
  expiresAt: z.string().datetime({ offset: true }),
  contentType: z.enum(UPLOAD_MIME_TYPES),
  size: z.number().int().nonnegative(),
});
export type UploadResponse = z.infer<typeof UploadResponse>;

export const SignedUrlRequest = z.object({ path: z.string().min(1) });
export type SignedUrlRequest = z.infer<typeof SignedUrlRequest>;

export const SignedUrlResponse = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime({ offset: true }),
});
export type SignedUrlResponse = z.infer<typeof SignedUrlResponse>;

// ─── Lore ────────────────────────────────────────────────────────────────────

export const Lore = z.object({
  id: z.string(),
  campaign_id: z.string(),
  title: z.string(),
  category: LoreCategoryEnum,
  content: z.string().optional(),
  visibility: LoreVisibilityEnum,
  created_at: z.string().datetime({ offset: true }),
  dm_notes: z.string().optional(),
});
export type Lore = z.infer<typeof Lore>;

export const LorePlayer = Lore.omit({ dm_notes: true });
export type LorePlayer = z.infer<typeof LorePlayer>;

export const LoreCreate = Lore.omit({ id: true, created_at: true });
export type LoreCreate = z.infer<typeof LoreCreate>;

export const LoreUpdate = LoreCreate.partial();
export type LoreUpdate = z.infer<typeof LoreUpdate>;

export const LoreListResponse = z.object({ lore: z.array(Lore) });
export type LoreListResponse = z.infer<typeof LoreListResponse>;

export const LoreResponse = z.object({ lore: Lore });
export type LoreResponse = z.infer<typeof LoreResponse>;

// ─── Cross-entity reference schemas (Phase 4) ────────────────────────────────

// Minimal stub for inline entity references (id + display name).
export const EntityRef = z.object({
  id: z.string(),
  name: z.string(),
});
export type EntityRef = z.infer<typeof EntityRef>;

// ── Session with linked NPCs / Locations ─────────────────────────────────────

export const SessionWithRefs = Session.extend({
  linked_npcs: z.array(EntityRef),
  linked_locations: z.array(EntityRef),
});
export type SessionWithRefs = z.infer<typeof SessionWithRefs>;

export const SessionWithRefsResponse = z.object({ session: SessionWithRefs });
export type SessionWithRefsResponse = z.infer<typeof SessionWithRefsResponse>;

// ── NPC with faction + first-appeared session ─────────────────────────────────

export const SessionRef = EntityRef.extend({ session_number: z.number().int() });
export type SessionRef = z.infer<typeof SessionRef>;

export const NpcWithRefs = Npc.extend({
  faction: EntityRef.optional(),
  first_appeared_session: SessionRef.optional(),
});
export type NpcWithRefs = z.infer<typeof NpcWithRefs>;

export const NpcWithRefsResponse = z.object({ npc: NpcWithRefs });
export type NpcWithRefsResponse = z.infer<typeof NpcWithRefsResponse>;

// ── Location with hierarchy ───────────────────────────────────────────────────

export const LocationRef = EntityRef.extend({ type: z.string().optional() });
export type LocationRef = z.infer<typeof LocationRef>;

export const LocationWithHierarchy = Location.extend({
  ancestors: z.array(EntityRef),
  sub_locations: z.array(LocationRef),
});
export type LocationWithHierarchy = z.infer<typeof LocationWithHierarchy>;

export const LocationWithHierarchyResponse = z.object({ location: LocationWithHierarchy });
export type LocationWithHierarchyResponse = z.infer<typeof LocationWithHierarchyResponse>;

// ── Faction with members + inter-faction relationships ────────────────────────

export const FactionRelationshipTypeEnum = z.enum(['ally', 'enemy', 'rival', 'unknown']);
export type FactionRelationshipTypeEnum = z.infer<typeof FactionRelationshipTypeEnum>;

export const FactionMemberRef = z.object({
  npc_id: z.string(),
  npc_name: z.string(),
  role: z.string().nullable(),
});
export type FactionMemberRef = z.infer<typeof FactionMemberRef>;

export const FactionRelationshipRef = z.object({
  related_faction_id: z.string(),
  related_faction_name: z.string(),
  relationship_type: FactionRelationshipTypeEnum,
});
export type FactionRelationshipRef = z.infer<typeof FactionRelationshipRef>;

export const AddFactionMember = z.object({
  npc_id: z.string(),
  role: z.string().optional(),
});
export type AddFactionMember = z.infer<typeof AddFactionMember>;

export const AddFactionRelationship = z.object({
  related_faction_id: z.string(),
  relationship_type: FactionRelationshipTypeEnum,
});
export type AddFactionRelationship = z.infer<typeof AddFactionRelationship>;

export const FactionWithRefs = Faction.extend({
  members: z.array(FactionMemberRef),
  relationships: z.array(FactionRelationshipRef),
});
export type FactionWithRefs = z.infer<typeof FactionWithRefs>;

export const FactionWithRefsResponse = z.object({ faction: FactionWithRefs });
export type FactionWithRefsResponse = z.infer<typeof FactionWithRefsResponse>;

// ── Lore with polymorphic entity references ───────────────────────────────────

export const LoreReferenceEntityTypeEnum = z.enum([
  'session',
  'character',
  'npc',
  'location',
  'faction',
  'lore',
]);
export type LoreReferenceEntityTypeEnum = z.infer<typeof LoreReferenceEntityTypeEnum>;

export const LoreRef = z.object({
  entity_type: LoreReferenceEntityTypeEnum,
  entity_id: z.string(),
  entity_name: z.string(),
});
export type LoreRef = z.infer<typeof LoreRef>;

export const AddLoreReference = z.object({
  entity_type: LoreReferenceEntityTypeEnum,
  entity_id: z.string(),
});
export type AddLoreReference = z.infer<typeof AddLoreReference>;

export const LoreWithRefs = Lore.extend({
  references: z.array(LoreRef),
});
export type LoreWithRefs = z.infer<typeof LoreWithRefs>;

export const LoreWithRefsResponse = z.object({ lore: LoreWithRefs });
export type LoreWithRefsResponse = z.infer<typeof LoreWithRefsResponse>;

// ── Campaign dashboard / overview ─────────────────────────────────────────────

export const CampaignStatsSummary = z.object({
  sessions: z.number().int(),
  characters: z.number().int(),
  npcs: z.number().int(),
  locations: z.number().int(),
  factions: z.number().int(),
  lore: z.number().int(),
});
export type CampaignStatsSummary = z.infer<typeof CampaignStatsSummary>;

export const CampaignOverview = z.object({
  recent_sessions: z.array(Session),
  characters: z.array(Character),
  key_npcs: z.array(Npc),
  locations: z.array(Location),
  factions: z.array(Faction),
  stats: CampaignStatsSummary,
});
export type CampaignOverview = z.infer<typeof CampaignOverview>;

export const CampaignOverviewResponse = z.object({ overview: CampaignOverview });
export type CampaignOverviewResponse = z.infer<typeof CampaignOverviewResponse>;

// ─── AI generator ────────────────────────────────────────────────────────────
// Used by the "secret" dev generator (Ctrl+Shift+G) and the per-field AI assist
// on AITextInput / AITextarea. DM-only at the API layer.

export const GenerateCampaignMode = z.enum(['new', 'populate', 'generate_missing_images']);
export type GenerateCampaignMode = z.infer<typeof GenerateCampaignMode>;

export const AIProvider = z.enum(['anthropic', 'deepinfra']);
export type AIProvider = z.infer<typeof AIProvider>;

export const GenerateCampaignRequest = z
  .object({
    mode: GenerateCampaignMode,
    campaign_id: z.string().optional(),
    seed: z.string().max(500).optional(),
    provider: AIProvider.optional(),
    generate_images: z.boolean().optional(),
  })
  .refine((v) => v.mode === 'new' || !!v.campaign_id, {
    message: 'campaign_id is required for this mode',
    path: ['campaign_id'],
  });
export type GenerateCampaignRequest = z.infer<typeof GenerateCampaignRequest>;

export const GenerateCampaignCounts = z.object({
  sessions: z.number().int(),
  npcs: z.number().int(),
  characters: z.number().int(),
  locations: z.number().int(),
  factions: z.number().int(),
  lore: z.number().int(),
});
export type GenerateCampaignCounts = z.infer<typeof GenerateCampaignCounts>;

// Immediate 202 response from POST /ai/generate-campaign
export const GenerateCampaignResponse = z.object({ job_id: z.string() });
export type GenerateCampaignResponse = z.infer<typeof GenerateCampaignResponse>;

// Polling response from GET /api/ai/jobs/:id
export const GenerationJobResponse = z.object({
  id: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  campaign_id: z.string().optional(),
  counts: GenerateCampaignCounts.optional(),
  error: z.string().optional(),
});
export type GenerationJobResponse = z.infer<typeof GenerationJobResponse>;

export const GenerateFieldEntityType = z.enum([
  'campaign',
  'session',
  'character',
  'npc',
  'location',
  'faction',
  'lore',
]);
export type GenerateFieldEntityType = z.infer<typeof GenerateFieldEntityType>;

export const GenerateFieldRequest = z.object({
  campaign_id: z.string(),
  entity_type: GenerateFieldEntityType,
  field_name: z.string().min(1).max(100),
  entity_draft: z.record(z.unknown()).optional(),
  user_hint: z.string().max(500).optional(),
  provider: AIProvider.optional(),
});
export type GenerateFieldRequest = z.infer<typeof GenerateFieldRequest>;

export const GenerateFieldResponse = z.object({ text: z.string() });
export type GenerateFieldResponse = z.infer<typeof GenerateFieldResponse>;

// ─── AI image generator ───────────────────────────────────────────────────────

export const GenerateImageEntityType = z.enum(['campaign', 'location', 'npc', 'character']);
export type GenerateImageEntityType = z.infer<typeof GenerateImageEntityType>;

export const GenerateImageFieldName = z.enum(['cover_image_url', 'map_image_url', 'portrait_url']);
export type GenerateImageFieldName = z.infer<typeof GenerateImageFieldName>;

export const GenerateImageRequest = z.object({
  campaign_id: z.string(),
  entity_type: GenerateImageEntityType,
  entity_id: z.string(),
  field_name: GenerateImageFieldName,
  prompt_hint: z.string().max(500).optional(),
});
export type GenerateImageRequest = z.infer<typeof GenerateImageRequest>;

export const GenerateImageResponse = z.object({
  path: z.string(),
  url: z.string(),
  expires_at: z.string(),
});
export type GenerateImageResponse = z.infer<typeof GenerateImageResponse>;
