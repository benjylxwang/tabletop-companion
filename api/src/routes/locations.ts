import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  Location,
  LocationCreate,
  LocationUpdate,
  LocationWithHierarchy,
  LocationWithHierarchyResponse,
} from '@tabletop/shared';
import { supabaseService } from '../lib/supabaseService.js';
import { getCampaignRole } from '../lib/campaignRole.js';
import { stripDmFields, shouldStripDmFields } from '../lib/stripDmFields.js';
import { HttpError, NotFoundError, sendError } from '../lib/httpErrors.js';
import { createCrudHandlers } from '../lib/crud.js';

export const locationsRouter = Router();

const handlers = createCrudHandlers({
  table: 'locations',
  baseSchema: Location,
  createSchema: LocationCreate,
  updateSchema: LocationUpdate,
  responseKey: { single: 'location', plural: 'locations' },
  // Locations are nested under a campaign; the URL is the only trusted source
  // of the campaign binding. For routes operating on a specific row, the row's
  // own campaign_id is authoritative.
  resolveCampaignId: (req, row) => row?.campaign_id ?? req.params.campaignId ?? null,
});

// Coerce DB nulls to undefined for Zod compatibility
function nullToUndefined(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v === null ? undefined : v]),
  );
}

// Custom get handler — enriches location with ancestor chain and sub-locations
async function getLocation(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const { campaignId, id } = req.params;

    const { data: locData, error: locError } = await supabaseService
      .from('locations')
      .select('*')
      .eq('id', id)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (locError) throw new HttpError(500, 'database error');
    if (!locData) throw new NotFoundError();

    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();

    const location = Location.parse(nullToUndefined(locData as Record<string, unknown>));

    // Traverse parent chain (max 10 levels) to build ancestors ordered root→parent
    const ancestors: Array<{ id: string; name: string }> = [];
    let currentParentId = location.parent_location_id;
    let depth = 0;
    while (currentParentId && depth < 10) {
      const { data: parentData, error: parentError } = await supabaseService
        .from('locations')
        .select('id, name, parent_location_id')
        .eq('id', currentParentId)
        .eq('campaign_id', campaignId)
        .maybeSingle();

      if (parentError) throw new HttpError(500, 'database error');
      if (!parentData) break;

      ancestors.unshift({ id: parentData.id, name: parentData.name });
      currentParentId = (parentData as { parent_location_id?: string | null }).parent_location_id ?? undefined;
      depth++;
    }

    // Fetch direct children
    const { data: childrenData, error: childrenError } = await supabaseService
      .from('locations')
      .select('id, name, type')
      .eq('campaign_id', campaignId)
      .eq('parent_location_id', id);

    if (childrenError) throw new HttpError(500, 'database error');

    const sub_locations = (childrenData ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      type: (c as { type?: string | null }).type ?? undefined,
    }));

    const strip = role === 'player' || shouldStripDmFields(req.requestedView);
    const locationPayload = strip ? stripDmFields(location) : location;

    const withHierarchy = LocationWithHierarchy.parse({
      ...locationPayload,
      ancestors,
      sub_locations,
    });

    res.status(200).json(LocationWithHierarchyResponse.parse({ location: withHierarchy }));
  } catch (err) {
    sendError(res, err);
  }
}

locationsRouter.get('/campaigns/:campaignId/locations', handlers.list);
locationsRouter.post('/campaigns/:campaignId/locations', handlers.create);
locationsRouter.get('/campaigns/:campaignId/locations/:id', getLocation);
locationsRouter.put('/campaigns/:campaignId/locations/:id', handlers.update);
locationsRouter.delete('/campaigns/:campaignId/locations/:id', handlers.remove);
