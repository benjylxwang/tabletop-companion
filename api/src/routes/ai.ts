import { Router } from 'express';
import {
  GenerateCampaignRequest,
  GenerateCampaignResponse,
  GenerationJobResponse,
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
            status: { type: 'string', enum: ['Alive', 'Dead', 'Unknown'] },
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
              enum: ['History', 'Magic', 'Religion', 'Politics', 'Other'],
            },
            content: { type: 'string' },
            visibility: { type: 'string', enum: ['Private', 'Public', 'Revealed'] },
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
    status?: 'Alive' | 'Dead' | 'Unknown';
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
    category: 'History' | 'Magic' | 'Religion' | 'Politics' | 'Other';
    content?: string;
    visibility?: 'Private' | 'Public' | 'Revealed';
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
    const { mode, campaign_id } = parsed.data;

    // DM check for all non-new modes.
    if (mode !== 'new') {
      const role = await getCampaignRole(userId, campaign_id!);
      if (!role) throw new NotFoundError();
      if (role !== 'dm') throw new ForbiddenError();
    }

    // Create a job record and respond immediately.
    const { data: job, error: jobError } = await supabaseService
      .from('generation_jobs')
      .insert({ user_id: userId })
      .select('id')
      .single();
    if (jobError || !job) throw new HttpError(500, 'failed to create generation job');

    const jobId = (job as { id: string }).id;
    res.status(202).json(GenerateCampaignResponse.parse({ job_id: jobId }));

    // Run the heavy work in the background — no await.
    void runGenerationJob(jobId, parsed.data, userId);
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /ai/jobs/:id ────────────────────────────────────────────────────────

aiRouter.get('/jobs/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: job, error } = await supabaseService
      .from('generation_jobs')
      .select('id, status, campaign_id, counts, error')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new HttpError(500, `database error: ${error.message}`);
    if (!job) throw new NotFoundError();

    const j = job as {
      id: string;
      status: string;
      campaign_id: string | null;
      counts: Record<string, number> | null;
      error: string | null;
    };

    res.json(
      GenerationJobResponse.parse({
        id: j.id,
        status: j.status,
        campaign_id: j.campaign_id ?? undefined,
        counts: j.counts ?? undefined,
        error: j.error ?? undefined,
      }),
    );
  } catch (err) {
    sendError(res, err);
  }
});

// ─── Background job runner ───────────────────────────────────────────────────

async function runGenerationJob(
  jobId: string,
  data: typeof GenerateCampaignRequest._type,
  userId: string,
): Promise<void> {
  const { mode, campaign_id, seed, provider, generate_images } = data;

  await supabaseService
    .from('generation_jobs')
    .update({ status: 'running' })
    .eq('id', jobId);

  let targetCampaignId: string | undefined;
  try {
    if (mode === 'generate_missing_images') {
      await runGenerateMissingImages(campaign_id!, userId);
      await supabaseService
        .from('generation_jobs')
        .update({ status: 'completed', campaign_id: campaign_id, completed_at: new Date().toISOString() })
        .eq('id', jobId);
      return;
    }

    const userPrompt = buildUserPrompt(mode, seed);
    const payload = await generateJson<CampaignPayload>({
      system: CAMPAIGN_SYSTEM_PROMPT,
      user: userPrompt,
      tool: CAMPAIGN_GENERATOR_TOOL,
      provider,
    });
    console.log('[runGenerationJob] payload from provider:', JSON.stringify(payload, null, 2));

    targetCampaignId =
      mode === 'populate' ? campaign_id! : await createCampaignForUser(payload, userId);

    const { counts, npcIds, characterIds, locationIds } = await insertPayload(
      targetCampaignId,
      payload,
      mode,
    );

    if (generate_images) {
      await generateImagesForCampaign(
        targetCampaignId,
        payload,
        { npcIds, characterIds, locationIds },
        userId,
      );
    }

    await supabaseService
      .from('generation_jobs')
      .update({
        status: 'completed',
        campaign_id: targetCampaignId,
        counts: counts as unknown as Record<string, number>,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[runGenerationJob] failed:', err);

    if (mode === 'new' && targetCampaignId) {
      await supabaseService.from('campaigns').delete().eq('id', targetCampaignId);
    }

    await supabaseService
      .from('generation_jobs')
      .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
      .eq('id', jobId);
  }
}

// ─── Generate missing images for an existing campaign ────────────────────────

async function runGenerateMissingImages(campaignId: string, userId: string): Promise<void> {
  const [campaignRes, npcsRes, charactersRes, locationsRes] = await Promise.all([
    supabaseService
      .from('campaigns')
      .select('id, name, system, description')
      .eq('id', campaignId)
      .is('cover_image_url', null)
      .maybeSingle(),
    supabaseService
      .from('npcs')
      .select('id, name, role_title, appearance')
      .eq('campaign_id', campaignId)
      .is('portrait_url', null),
    supabaseService
      .from('characters')
      .select('id, name, race_species, class, appearance')
      .eq('campaign_id', campaignId)
      .is('portrait_url', null),
    supabaseService
      .from('locations')
      .select('id, name, type, description')
      .eq('campaign_id', campaignId)
      .is('map_image_url', null),
  ]);

  interface ImageTask {
    prompt: string;
    table: 'campaigns' | 'npcs' | 'characters' | 'locations';
    id: string;
  }

  const tasks: ImageTask[] = [];

  if (campaignRes.data) {
    const c = campaignRes.data as { id: string; name: string; system: string | null; description: string | null };
    const desc = c.description ? ` ${c.description}` : '';
    const sys = c.system ? ` (${c.system})` : '';
    tasks.push({
      prompt: `${IMAGE_STYLE} Campaign cover art for "${c.name}"${sys}.${desc}`,
      table: 'campaigns',
      id: c.id,
    });
  }

  for (const n of (npcsRes.data ?? []) as { id: string; name: string; role_title: string | null; appearance: string | null }[]) {
    const role = n.role_title ? `, ${n.role_title}` : '';
    const appearance = n.appearance ? ` ${n.appearance}` : '';
    tasks.push({
      prompt: `${IMAGE_STYLE} Character portrait of ${n.name}${role}.${appearance}`,
      table: 'npcs',
      id: n.id,
    });
  }

  for (const c of (charactersRes.data ?? []) as { id: string; name: string; race_species: string | null; class: string | null; appearance: string | null }[]) {
    const race = c.race_species ? ` ${c.race_species}` : '';
    const cls = c.class ? ` ${c.class}` : '';
    const appearance = c.appearance ? ` ${c.appearance}` : '';
    tasks.push({
      prompt: `${IMAGE_STYLE} Character portrait of ${c.name},${race}${cls}.${appearance}`,
      table: 'characters',
      id: c.id,
    });
  }

  for (const l of (locationsRes.data ?? []) as { id: string; name: string; type: string | null; description: string | null }[]) {
    const typeLabel = l.type ? ` ${l.type}` : '';
    const desc = l.description ? ` ${l.description}` : '';
    tasks.push({
      prompt: `${IMAGE_STYLE}${typeLabel ? ` A${typeLabel}` : ''} named "${l.name}".${desc}`,
      table: 'locations',
      id: l.id,
    });
  }

  console.log(`[runGenerateMissingImages] ${tasks.length} images to generate for campaign ${campaignId}`);
  if (tasks.length === 0) return;

  const results = await Promise.allSettled(
    tasks.map((task) => generateImage({ prompt: task.prompt, userId })),
  );

  await Promise.allSettled(
    results.map(async (result, i) => {
      const task = tasks[i];
      if (result.status === 'rejected') {
        console.error(`[runGenerateMissingImages] failed for ${task.table}/${task.id}:`, result.reason);
        return;
      }
      const path = result.value.path;
      let error: { message: string } | null = null;
      if (task.table === 'campaigns') {
        ({ error } = await supabaseService.from('campaigns').update({ cover_image_url: path }).eq('id', task.id));
      } else if (task.table === 'npcs') {
        ({ error } = await supabaseService.from('npcs').update({ portrait_url: path }).eq('id', task.id));
      } else if (task.table === 'characters') {
        ({ error } = await supabaseService.from('characters').update({ portrait_url: path }).eq('id', task.id));
      } else if (task.table === 'locations') {
        ({ error } = await supabaseService.from('locations').update({ map_image_url: path }).eq('id', task.id));
      }
      if (error) {
        console.error(`[runGenerateMissingImages] DB update failed for ${task.table}/${task.id}:`, error);
      }
    }),
  );
}

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
  if (error || !campaign) {
    console.error('[createCampaignForUser] campaigns insert error:', error);
    throw new HttpError(500, `database error creating campaign: ${error?.message ?? 'no data'}`);
  }

  const { error: memberError } = await supabaseService
    .from('campaign_members')
    .insert({ campaign_id: campaign.id, user_id: userId, role: 'dm' });
  if (memberError) {
    console.error('[createCampaignForUser] campaign_members insert error:', memberError);
    await supabaseService.from('campaigns').delete().eq('id', campaign.id);
    throw new HttpError(500, `database error adding DM member: ${memberError.message}`);
  }

  return campaign.id as string;
}

interface InsertPayloadResult {
  counts: GenerateCampaignCounts;
  npcIds: string[];
  characterIds: string[];
  locationIds: string[];
}

async function insertPayload(
  campaignId: string,
  payload: CampaignPayload,
  mode: 'new' | 'populate',
): Promise<InsertPayloadResult> {
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
      if (error) {
        console.error('[insertPayload] campaign update error:', error);
        throw new HttpError(500, `database error updating campaign: ${error.message}`);
      }
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
  const locationIdMap = await insertBatch(
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
    const childId = locationIdMap[loc.ref];
    const parentId = locationIdMap[loc.parent_ref];
    if (!childId || !parentId) continue;
    const { error } = await supabaseService
      .from('locations')
      .update({ parent_location_id: parentId })
      .eq('id', childId);
    if (error) {
      console.error('[insertPayload] location parent update error:', error);
      throw new HttpError(500, `database error updating location parent: ${error.message}`);
    }
  }

  // 4. NPCs — depend on factions + sessions.
  const npcRefs = payload.npcs.map((_, i) => `npc-${i}`);
  const npcIdMap = await insertBatch(
    'npcs',
    payload.npcs.map((n) => ({
      campaign_id: campaignId,
      name: n.name,
      role_title: n.role_title ?? null,
      alignment: n.alignment ?? null,
      appearance: n.appearance ?? null,
      personality: n.personality ?? null,
      relationships: n.relationships ?? null,
      status: n.status ?? 'Alive',
      faction_id: n.faction_ref ? factionIds[n.faction_ref] ?? null : null,
      first_appeared_session_id: n.first_session_ref
        ? sessionIds[n.first_session_ref] ?? null
        : null,
      dm_notes: n.dm_notes ?? null,
    })),
    npcRefs,
  );
  const npcIds = npcRefs.map((r) => npcIdMap[r]).filter((id): id is string => !!id);

  // 5. Characters — independent of the rest.
  const charRefs = payload.characters.map((_, i) => `char-${i}`);
  const charIdMap = await insertBatch(
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
    charRefs,
  );
  const characterIds = charRefs.map((r) => charIdMap[r]).filter((id): id is string => !!id);

  // 6. Lore — independent of the rest.
  await insertBatch(
    'lore',
    payload.lore.map((l) => ({
      campaign_id: campaignId,
      title: l.title,
      category: l.category,
      content: l.content ?? null,
      visibility: l.visibility ?? 'Public',
      dm_notes: l.dm_notes ?? null,
    })),
  );

  const locIds = payload.locations.map((l) => locationIdMap[l.ref]).filter((id): id is string => !!id);

  return {
    counts: {
      factions: payload.factions.length,
      sessions: payload.sessions.length,
      locations: payload.locations.length,
      npcs: payload.npcs.length,
      characters: payload.characters.length,
      lore: payload.lore.length,
    },
    npcIds,
    characterIds,
    locationIds: locIds,
  };
}

// ─── Bulk image generation ───────────────────────────────────────────────────

const IMAGE_STYLE = 'Fantasy tabletop RPG illustration, painterly style, detailed.';

async function generateImagesForCampaign(
  campaignId: string,
  payload: CampaignPayload,
  ids: { npcIds: string[]; characterIds: string[]; locationIds: string[] },
  userId: string,
): Promise<void> {
  interface ImageTask {
    prompt: string;
    table: 'campaigns' | 'npcs' | 'characters' | 'locations';
    column: string;
    id: string;
  }

  const tasks: ImageTask[] = [];

  // Campaign cover
  const campaignDesc = payload.campaign.description ? ` ${payload.campaign.description}` : '';
  const systemStr = payload.campaign.system ? ` (${payload.campaign.system})` : '';
  tasks.push({
    prompt: `${IMAGE_STYLE} Campaign cover art for "${payload.campaign.name}"${systemStr}.${campaignDesc}`,
    table: 'campaigns',
    column: 'cover_image_url',
    id: campaignId,
  });

  // NPC portraits
  for (let i = 0; i < ids.npcIds.length; i++) {
    const n = payload.npcs[i];
    if (!n) continue;
    const role = n.role_title ? `, ${n.role_title}` : '';
    const appearance = n.appearance ? ` ${n.appearance}` : '';
    tasks.push({
      prompt: `${IMAGE_STYLE} Character portrait of ${n.name}${role}.${appearance}`,
      table: 'npcs',
      column: 'portrait_url',
      id: ids.npcIds[i],
    });
  }

  // Character portraits
  for (let i = 0; i < ids.characterIds.length; i++) {
    const c = payload.characters[i];
    if (!c) continue;
    const race = c.race_species ? ` ${c.race_species}` : '';
    const cls = c.class ? ` ${c.class}` : '';
    const appearance = c.appearance ? ` ${c.appearance}` : '';
    tasks.push({
      prompt: `${IMAGE_STYLE} Character portrait of ${c.name},${race}${cls}.${appearance}`,
      table: 'characters',
      column: 'portrait_url',
      id: ids.characterIds[i],
    });
  }

  // Location art
  for (let i = 0; i < ids.locationIds.length; i++) {
    const l = payload.locations[i];
    if (!l) continue;
    const typeLabel = l.type ? ` ${l.type}` : '';
    const desc = l.description ? ` ${l.description}` : '';
    tasks.push({
      prompt: `${IMAGE_STYLE}${typeLabel ? ` A${typeLabel}` : ''} named "${l.name}".${desc}`,
      table: 'locations',
      column: 'map_image_url',
      id: ids.locationIds[i],
    });
  }

  console.log(`[generateImagesForCampaign] generating ${tasks.length} images`);

  const results = await Promise.allSettled(
    tasks.map((task) => generateImage({ prompt: task.prompt, userId })),
  );

  await Promise.allSettled(
    results.map(async (result, i) => {
      const task = tasks[i];
      if (result.status === 'rejected') {
        console.error(`[generateImagesForCampaign] image failed for ${task.table}/${task.id}:`, result.reason);
        return;
      }
      const path = result.value.path;
      let error: { message: string } | null = null;
      if (task.table === 'campaigns') {
        ({ error } = await supabaseService.from('campaigns').update({ cover_image_url: path }).eq('id', task.id));
      } else if (task.table === 'npcs') {
        ({ error } = await supabaseService.from('npcs').update({ portrait_url: path }).eq('id', task.id));
      } else if (task.table === 'characters') {
        ({ error } = await supabaseService.from('characters').update({ portrait_url: path }).eq('id', task.id));
      } else if (task.table === 'locations') {
        ({ error } = await supabaseService.from('locations').update({ map_image_url: path }).eq('id', task.id));
      }
      if (error) {
        console.error(`[generateImagesForCampaign] DB update failed for ${task.table}/${task.id}:`, error);
      }
    }),
  );
}

// Inserts `rows` and, if `refs` is provided, returns a map of ref → inserted id.
async function insertBatch(
  table: 'factions' | 'sessions' | 'locations' | 'npcs' | 'characters' | 'lore',
  rows: Record<string, unknown>[],
  refs?: string[],
): Promise<Record<string, string>> {
  if (rows.length === 0) return {};
  console.log(`[insertBatch] ${table}:`, JSON.stringify(rows, null, 2));
  const { data, error } = await supabaseService
    .from(table)
    .insert(rows as never)
    .select('id');
  if (error || !data) {
    console.error(`[insertBatch] ${table} error:`, error);
    throw new HttpError(500, `database error inserting ${table}: ${error?.message ?? 'no data'}`);
  }
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
