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

export const LoreCategoryEnum = z.enum(['History', 'Magic', 'Religion', 'Politics']);
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

export const CampaignUpdate = CampaignCreate.partial();
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
  relationships: z.array(z.string()).optional(),
  status: NpcStatusEnum,
  first_appeared_session_id: z.string().optional(),
  faction_id: z.string().optional(),
  created_at: z.string().datetime({ offset: true }),
  dm_notes: z.string().optional(),
});
export type Npc = z.infer<typeof Npc>;

export const NpcPlayer = Npc.omit({ dm_notes: true });
export type NpcPlayer = z.infer<typeof NpcPlayer>;

export const NpcCreate = Npc.omit({ id: true, created_at: true });
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

export const LocationCreate = Location.omit({ id: true, created_at: true });
export type LocationCreate = z.infer<typeof LocationCreate>;

export const LocationUpdate = LocationCreate.partial();
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

// ─── Lore ────────────────────────────────────────────────────────────────────

export const Lore = z.object({
  id: z.string(),
  campaign_id: z.string(),
  title: z.string(),
  category: LoreCategoryEnum,
  content: z.string(),
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
