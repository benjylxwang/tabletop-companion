import { Router } from 'express';
import {
  GenerateCampaignRequest,
  GenerateCampaignResponse,
  GenerateFieldRequest,
  GenerateFieldResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  type GenerateCampaignCounts,
} from '@tabletop/shared';
import { supabaseService } from '../lib/supabaseService.js';
import { getCampaignRole } from '../lib/campaignRole.js';
import {
  HttpError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  sendError,
} from '../lib/httpErrors.js';
import { generateJson, generateText, generateImage, type GenerateJsonTool } from '../lib/aiProvider.js';

export const aiRouter = Router();

// ─── Tool schema for full-campaign generation ────────────────────────────────
// Mirrors the DB column shapes (lowercase enums, race_species/level_tier). We
// define this against the DB, not the Zod entity schemas, because the two
// have drifted — the Zod schemas are client-facing and title-case some enums.

const CAMPAIGN_GENERATOR_TOOL: GenerateJsonTool = {
  name: 'emit_campaign',
  description:
    'Emit a fully populated TTRPG campaign: the campaign itself plus sessions, factions, NPCs, locations, characters, and lore. Use stable string refs (faction_ref, first_session_ref, parent_ref) to link entities inside this payload; the server resolves them to real UUIDs on insert.',
  input_schema: {
    type: 'object' as const,
    required: ['campaign', 'factions', 'sessions', 'npcs', 'locations', 'characters', 'lore'],
    properties: {
      campaign: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          system: { type: 'string' },
          description: { type: 'string' },
          dm_notes: { type: 'string' },
        },
      },
      factions: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: {
          type: 'object',
          required: ['ref', 'name'],
          properties: {
            ref: { type: 'string', description: 'stable id within this payload, e.g. "faction-0"' },
            name: { type: 'string' },
            description: { type: 'string' },
            goals: { type: 'string' },
            alignment_tone: { type: 'string' },
            dm_notes: { type: 'string' },
          },
        },
      },
      sessions: {
        type: 'array',
        minItems: 3,
        maxItems: 6,
        items: {
          type: 'object',
          required: ['ref', 'title'],
          properties: {
            ref: { type: 'string' },
            title: { type: 'string' },
            date_played: { type: 'string', description: 'YYYY-MM-DD' },
            summary: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            xp_awarded: { type: 'integer' },
            dm_notes: { type: 'string' },
          },
        },
      },
      locations: {
        type: 'array',
        minItems: 4,
        maxItems: 8,
        items: {
          type: 'object',
          required: ['ref', 'name'],
          properties: {
            ref: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string', description: 'e.g. city, dungeon, wilderness' },
            description: { type: 'string' },
            history: { type: 'string' },
            parent_ref: { type: 'string', description: 'ref of another location in this payload' },
            dm_notes: { type: 'string' },
          },
        },
      },
      npcs: {
        type: 'array',
        minItems: 5,
        maxItems: 10,
        items: {
          type: 'object',
          required: ['ref', 'name'],
          properties: {
            ref: { type: 'string' },
            name: { type: 'string' },
            role_title: { type: 'string' },
            alignment: { type: 'string' },
            appearance: { type: 'string' },
            personality: { type: 'string' },
            relationships: { type: 'string' },
            status: { type: 'string', enum: ['alive', 'dead', 'unknown'] },
            faction_ref: { type: 'string' },
            first_session_ref: { type: 'string' },
            dm_notes: { type: 'string' },
          },
        },
      },
      characters: {
        type: 'array',
        minItems: 3,
        maxItems: 5,
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            player_name: { type: 'string' },
            race_species: { type: 'string' },
            class: { type: 'string' },
            level_tier: { type: 'integer' },
            backstory: { type: 'string' },
            appearance: { type: 'string' },
            personality: { type: 'string' },
            goals_bonds: { type: 'string' },
            dm_notes: { type: 'string' },
          },
        },
      },
      lore: {
        type: 'array',
        minItems: 3,
        maxItems: 6,
        items: {
          type: 'object',
          required: ['title', 'category'],
          properties: {
            title: { type: 'string' },
            category: {
              type: 'string',
              enum: ['history', 'magic', 'religion', 'politics', 'other'],
            },
            content: { type: 'string' },
            visibility: { type: 'string', enum: ['private', 'public', 'revealed'] },
            dm_notes: { type: 'string' },
          },
        },
      },
    },
  },
};

interface CampaignPayload {
  campaign: {
    name: string;
    system?: string;
    description?: string;
    dm_notes?: string;
  };
  factions: Array<{
    ref: string;
    name: string;
    description?: string;
    goals?: string;
    alignment_tone?: string;
    dm_notes?: string;
  }>;
  sessions: Array<{
    ref: string;
    title: string;
    date_played?: string;
    summary?: string;
    highlights?: string[];
    xp_awarded?: number;
    dm_notes?: string;
  }>;
  locations: Array<{
    ref: string;
    name: string;
    type?: string;
    description?: string;
    history?: string;
    parent_ref?: string;
    dm_notes?: string;
  }>;
  npcs: Array<{
    ref: string;
    name: string;
    role_title?: string;
    alignment?: string;
    appearance?: string;
    personality?: string;
    relationships?: string;
    status?: 'alive' | 'dead' | 'unknown';
    faction_ref?: string;
    first_session_ref?: string;
    dm_notes?: string;
  }>;
  characters: Array<{
    name: string;
    player_name?: string;
    race_species?: string;
    class?: string;
    level_tier?: number;
    backstory?: string;
    appearance?: string;
    personality?: string;
    goals_bonds?: string;
    dm_notes?: string;
  }>;
  lore: Array<{
    title: string;
    category: 'history' | 'magic' | 'religion' | 'politics' | 'other';
    content?: string;
    visibility?: 'private' | 'public' | 'revealed';
    dm_notes?: string;
  }>;
}

const CAMPAIGN_SYSTEM_PROMPT = `You populate a TTRPG campaign-manager database. Generate a coherent, evocative campaign: the setting, a cast that knows each other, places that reference each other, and sessions that fit a natural arc.

Rules:
- Every NPC should belong to a faction where it makes sense (via faction_ref).
- Use location parent_ref to nest settlements inside regions where appropriate.
- Sessions should be chronological; session_number is assigned by the DB.
- dm_notes fields are DM-only — put secrets, twists, and hidden motives there.
- Keep prose vivid but concise (2-4 sentences for descriptions, 1-2 for personalities).
- If the caller gives a seed, honour its genre/tone/setting closely.`;

// ─── POST /ai/generate-campaign ──────────────────────────────────────────────

aiRouter.post('/generate-campaign', async (req, res) => {
  try {
    const userId = req.user!.id;

    const parsed = GenerateCampaignRequest.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }
    const { mode, campaign_id, seed, provider } = parsed.data;

    // DM check for populate. New-campaign mode makes the caller the DM.
    if (mode === 'populate') {
      const role = await getCampaignRole(userId, campaign_id!);
      if (!role) throw new NotFoundError();
      if (role !== 'dm') throw new ForbiddenError();
    }

    const userPrompt = buildUserPrompt(mode, seed);
    const payload = await generateJson<CampaignPayload>({
      system: CAMPAIGN_SYSTEM_PROMPT,
      user: userPrompt,
      tool: CAMPAIGN_GENERATOR_TOOL,
      provider,
    });

    const targetCampaignId =
      mode === 'populate' ? campaign_id! : await createCampaignForUser(payload, userId);

    try {
      const counts = await insertPayload(targetCampaignId, payload, mode);
      res.status(201).json(
        GenerateCampaignResponse.parse({ campaign_id: targetCampaignId, counts }),
      );
    } catch (err) {
      if (mode === 'new') {
        // Best-effort cleanup — cascade deletes take care of any partial children.
        await supabaseService.from('campaigns').delete().eq('id', targetCampaignId);
      }
      throw err;
    }
  } catch (err) {
    sendError(res, err);
  }
});

function buildUserPrompt(mode: 'new' | 'populate', seed?: string): string {
  const header =
    mode === 'new'
      ? 'Generate a brand-new campaign from scratch.'
      : 'Generate a set of supporting content (sessions, factions, NPCs, etc.) for an existing campaign. The campaign row itself already exists — the name/system/description/dm_notes in the campaign field will be ignored on populate, so feel free to still include a coherent campaign summary to guide the rest of the generation.';
  const seedLine = seed?.trim() ? `\n\nSeed: ${seed.trim()}` : '';
  return `${header}${seedLine}\n\nCall the emit_campaign tool with a complete payload.`;
}

async function createCampaignForUser(
  payload: CampaignPayload,
  userId: string,
): Promise<string> {
  const { data: campaign, error } = await supabaseService
    .from('campaigns')
    .insert({
      name: payload.campaign.name,
      system: payload.campaign.system ?? null,
      description: payload.campaign.description ?? null,
      dm_notes: payload.campaign.dm_notes ?? null,
      status: 'Active',
    })
    .select('id')
    .single();
  if (error || !campaign) throw new HttpError(500, 'database error');

  const { error: memberError } = await supabaseService
    .from('campaign_members')
    .insert({ campaign_id: campaign.id, user_id: userId, role: 'dm' });
  if (memberError) {
    await supabaseService.from('campaigns').delete().eq('id', campaign.id);
    throw new HttpError(500, 'database error');
  }

  return campaign.id as string;
}

async function insertPayload(
  campaignId: string,
  payload: CampaignPayload,
  mode: 'new' | 'populate',
): Promise<GenerateCampaignCounts> {
  // On populate mode, apply any non-empty campaign-level fields from the model
  // (except the name — don't rename a campaign the user already picked).
  if (mode === 'populate') {
    const update: {
      system?: string;
      description?: string;
      dm_notes?: string;
    } = {};
    if (payload.campaign.system) update.system = payload.campaign.system;
    if (payload.campaign.description) update.description = payload.campaign.description;
    if (payload.campaign.dm_notes) update.dm_notes = payload.campaign.dm_notes;
    if (Object.keys(update).length > 0) {
      const { error } = await supabaseService
        .from('campaigns')
        .update(update)
        .eq('id', campaignId);
      if (error) throw new HttpError(500, 'database error');
    }
  }

  // 1. Factions — NPCs reference these.
  const factionIds = await insertBatch(
    'factions',
    payload.factions.map((f) => ({
      campaign_id: campaignId,
      name: f.name,
      description: f.description ?? null,
      goals: f.goals ?? null,
      alignment_tone: f.alignment_tone ?? null,
      dm_notes: f.dm_notes ?? null,
    })),
    payload.factions.map((f) => f.ref),
  );

  // 2. Sessions — NPCs reference via first_session_ref.
  const sessionIds = await insertBatch(
    'sessions',
    payload.sessions.map((s) => ({
      campaign_id: campaignId,
      title: s.title,
      date_played: s.date_played ?? null,
      summary: s.summary ?? null,
      highlights: s.highlights ?? null,
      xp_awarded: s.xp_awarded ?? null,
      dm_notes: s.dm_notes ?? null,
    })),
    payload.sessions.map((s) => s.ref),
  );

  // 3. Locations — two-pass to resolve parent_ref (self-reference).
  const locationIds = await insertBatch(
    'locations',
    payload.locations.map((l) => ({
      campaign_id: campaignId,
      name: l.name,
      type: l.type ?? null,
      description: l.description ?? null,
      history: l.history ?? null,
      dm_notes: l.dm_notes ?? null,
    })),
    payload.locations.map((l) => l.ref),
  );
  for (const loc of payload.locations) {
    if (!loc.parent_ref) continue;
    const childId = locationIds[loc.ref];
    const parentId = locationIds[loc.parent_ref];
    if (!childId || !parentId) continue;
    const { error } = await supabaseService
      .from('locations')
      .update({ parent_location_id: parentId })
      .eq('id', childId);
    if (error) throw new HttpError(500, 'database error');
  }

  // 4. NPCs — depend on factions + sessions.
  await insertBatch(
    'npcs',
    payload.npcs.map((n) => ({
      campaign_id: campaignId,
      name: n.name,
      role_title: n.role_title ?? null,
      alignment: n.alignment ?? null,
      appearance: n.appearance ?? null,
      personality: n.personality ?? null,
      relationships: n.relationships ?? null,
      status: n.status ?? 'alive',
      faction_id: n.faction_ref ? factionIds[n.faction_ref] ?? null : null,
      first_appeared_session_id: n.first_session_ref
        ? sessionIds[n.first_session_ref] ?? null
        : null,
      dm_notes: n.dm_notes ?? null,
    })),
  );

  // 5. Characters — independent of the rest.
  await insertBatch(
    'characters',
    payload.characters.map((c) => ({
      campaign_id: campaignId,
      name: c.name,
      player_name: c.player_name ?? null,
      race_species: c.race_species ?? null,
      class: c.class ?? null,
      level_tier: c.level_tier ?? null,
      backstory: c.backstory ?? null,
      appearance: c.appearance ?? null,
      personality: c.personality ?? null,
      goals_bonds: c.goals_bonds ?? null,
      dm_notes: c.dm_notes ?? null,
    })),
  );

  // 6. Lore — independent of the rest.
  await insertBatch(
    'lore',
    payload.lore.map((l) => ({
      campaign_id: campaignId,
      title: l.title,
      category: l.category,
      content: l.content ?? null,
      visibility: l.visibility ?? 'public',
      dm_notes: l.dm_notes ?? null,
    })),
  );

  return {
    factions: payload.factions.length,
    sessions: payload.sessions.length,
    locations: payload.locations.length,
    npcs: payload.npcs.length,
    characters: payload.characters.length,
    lore: payload.lore.length,
  };
}

// Inserts `rows` and, if `refs` is provided, returns a map of ref → inserted id.
async function insertBatch(
  table: 'factions' | 'sessions' | 'locations' | 'npcs' | 'characters' | 'lore',
  rows: Record<string, unknown>[],
  refs?: string[],
): Promise<Record<string, string>> {
  if (rows.length === 0) return {};
  const { data, error } = await supabaseService
    .from(table)
    .insert(rows as never)
    .select('id');
  if (error || !data) throw new HttpError(500, 'database error');
  if (!refs) return {};
  const map: Record<string, string> = {};
  for (let i = 0; i < refs.length && i < data.length; i += 1) {
    map[refs[i]] = (data[i] as { id: string }).id;
  }
  return map;
}

// ─── POST /ai/generate-field ─────────────────────────────────────────────────

aiRouter.post('/generate-field', async (req, res) => {
  try {
    const userId = req.user!.id;

    const parsed = GenerateFieldRequest.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }
    const { campaign_id, entity_type, field_name, entity_draft, user_hint, provider } = parsed.data;

    const role = await getCampaignRole(userId, campaign_id);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const snapshot = await fetchCampaignSnapshot(campaign_id);
    const system = `You write content for a tabletop RPG campaign manager. Return ONLY the requested field text — no labels, no JSON, no markdown headings, no surrounding quotes. Plain prose that can be dropped directly into the field.\n\nCampaign snapshot (for reference — do not restate it in the output):\n${JSON.stringify(snapshot, null, 2)}`;
    const user = buildFieldPrompt(entity_type, field_name, entity_draft, user_hint);

    const text = await generateText({ system, user, provider });
    res.json(GenerateFieldResponse.parse({ text }));
  } catch (err) {
    sendError(res, err);
  }
});

function buildFieldPrompt(
  entityType: string,
  fieldName: string,
  entityDraft: Record<string, unknown> | undefined,
  userHint: string | undefined,
): string {
  const parts: string[] = [
    `Generate the "${fieldName}" field for a ${entityType}.`,
  ];
  if (entityDraft && Object.keys(entityDraft).length > 0) {
    parts.push(`Current draft of this ${entityType}:\n${JSON.stringify(entityDraft, null, 2)}`);
  }
  if (userHint?.trim()) {
    parts.push(`Extra instructions from the user: ${userHint.trim()}`);
  }
  parts.push('Return only the field text.');
  return parts.join('\n\n');
}

interface CampaignSnapshot {
  campaign: { name: string; system?: string; description?: string };
  factions: { name: string; description?: string }[];
  npcs: { name: string; role_title?: string }[];
  locations: { name: string; type?: string }[];
}

async function fetchCampaignSnapshot(campaignId: string): Promise<CampaignSnapshot> {
  const [campaignRes, factionsRes, npcsRes, locationsRes] = await Promise.all([
    supabaseService
      .from('campaigns')
      .select('name, system, description')
      .eq('id', campaignId)
      .maybeSingle(),
    supabaseService
      .from('factions')
      .select('name, description')
      .eq('campaign_id', campaignId)
      .limit(10),
    supabaseService
      .from('npcs')
      .select('name, role_title')
      .eq('campaign_id', campaignId)
      .limit(15),
    supabaseService
      .from('locations')
      .select('name, type')
      .eq('campaign_id', campaignId)
      .limit(15),
  ]);

  if (campaignRes.error || !campaignRes.data) throw new NotFoundError();

  return {
    campaign: {
      name: campaignRes.data.name,
      system: campaignRes.data.system ?? undefined,
      description: campaignRes.data.description ?? undefined,
    },
    factions: (factionsRes.data ?? []).map((f) => ({
      name: f.name,
      description: f.description ?? undefined,
    })),
    npcs: (npcsRes.data ?? []).map((n) => ({
      name: n.name,
      role_title: n.role_title ?? undefined,
    })),
    locations: (locationsRes.data ?? []).map((l) => ({
      name: l.name,
      type: l.type ?? undefined,
    })),
  };
}

// ─── POST /ai/generate-image ─────────────────────────────────────────────────

aiRouter.post('/generate-image', async (req, res) => {
  try {
    const userId = req.user!.id;

    const parsed = GenerateImageRequest.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }
    const { campaign_id, entity_type, entity_id, prompt_hint } = parsed.data;

    const role = await getCampaignRole(userId, campaign_id);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const prompt = await buildImagePrompt(entity_type, entity_id, prompt_hint);

    const { path, url, expires_at } = await generateImage({ prompt, userId });

    res.status(201).json(GenerateImageResponse.parse({ path, url, expires_at }));
  } catch (err) {
    sendError(res, err);
  }
});

async function buildImagePrompt(
  entityType: string,
  entityId: string,
  hint: string | undefined,
): Promise<string> {
  const hintSuffix = hint?.trim() ? ` ${hint.trim()}` : '';
  const style = 'Fantasy tabletop RPG illustration, painterly style, detailed.';

  if (entityType === 'campaign') {
    const { data } = await supabaseService
      .from('campaigns')
      .select('name, system, description')
      .eq('id', entityId)
      .maybeSingle();
    if (!data) throw new NotFoundError();
    const desc = data.description ? ` ${data.description}` : '';
    return `${style} Campaign cover art for "${data.name}"${data.system ? ` (${data.system})` : ''}.${desc}${hintSuffix}`;
  }

  if (entityType === 'location') {
    const { data } = await supabaseService
      .from('locations')
      .select('name, type, description')
      .eq('id', entityId)
      .maybeSingle();
    if (!data) throw new NotFoundError();
    const typeLabel = data.type ? ` ${data.type}` : '';
    const desc = data.description ? ` ${data.description}` : '';
    return `${style}${typeLabel ? ` A${typeLabel}` : ''} named "${data.name}".${desc}${hintSuffix}`;
  }

  if (entityType === 'npc') {
    const { data } = await supabaseService
      .from('npcs')
      .select('name, role_title, appearance')
      .eq('id', entityId)
      .maybeSingle();
    if (!data) throw new NotFoundError();
    const role = data.role_title ? `, ${data.role_title}` : '';
    const appearance = data.appearance ? ` ${data.appearance}` : '';
    return `${style} Character portrait of ${data.name}${role}.${appearance}${hintSuffix}`;
  }

  if (entityType === 'character') {
    const { data } = await supabaseService
      .from('characters')
      .select('name, race_species, class, appearance')
      .eq('id', entityId)
      .maybeSingle();
    if (!data) throw new NotFoundError();
    const race = data.race_species ? ` ${data.race_species}` : '';
    const cls = data.class ? ` ${data.class}` : '';
    const appearance = data.appearance ? ` ${data.appearance}` : '';
    return `${style} Character portrait of ${data.name},${race}${cls}.${appearance}${hintSuffix}`;
  }

  throw new HttpError(400, 'unsupported entity type');
}
