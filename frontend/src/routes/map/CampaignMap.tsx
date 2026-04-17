import { useRef, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Trash2 } from 'lucide-react';
import {
  fetchCampaign,
  fetchLocations,
  updateLocation,
  updateCampaign,
  uploadFile,
} from '../../lib/api';
import { useViewMode } from '../../contexts/ViewModeContext';
import { useSignedUrl } from '../../lib/useSignedUrl';
import { FileUpload } from '../../components/ui/FileUpload';
import { GenerateImageButton } from '../../components/ui/GenerateImageButton';
import { ConfirmModal } from '../../components/ui/Modal';
import type { Location, LocationsResponse, CampaignResponse } from '@tabletop/shared';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOT_R = 5;
const PANEL_W = 252;
const PANEL_GAP = 24;
const PANEL_EST_H = 224;

// ─── LocationHoverPanel ───────────────────────────────────────────────────────
// Rendered only while hovered, so useSignedUrl fires lazily per location.

interface PanelProps {
  location: Location;
  campaignId: string;
  style: React.CSSProperties;
  lineX1: number;
  lineY1: number;
  lineX2: number;
  lineY2: number;
}

function LocationHoverPanel({
  location,
  campaignId,
  style,
  lineX1,
  lineY1,
  lineX2,
  lineY2,
}: PanelProps) {
  const { url: imageUrl } = useSignedUrl(location.map_image_url);

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        style={{ width: '100%', height: '100%', zIndex: 15 }}
        aria-hidden
      >
        <line
          x1={lineX1}
          y1={lineY1}
          x2={lineX2}
          y2={lineY2}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute rounded-lg border border-slate-600/60 bg-slate-900/95 shadow-2xl overflow-hidden backdrop-blur-sm"
        style={{ ...style, width: PANEL_W, zIndex: 20 }}
      >
        {imageUrl && (
          <img src={imageUrl} alt={location.name} className="w-full h-24 object-cover" />
        )}
        <div className="p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-sm font-semibold text-white leading-snug">
              {location.name}
            </h3>
            {location.type && (
              <span className="shrink-0 rounded-full border border-amber-600/30 bg-amber-600/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                {location.type}
              </span>
            )}
          </div>
          {location.description && (
            <p className="text-xs leading-relaxed text-slate-400 line-clamp-3">
              {location.description}
            </p>
          )}
          <Link
            to={`/campaigns/${campaignId}/locations/${location.id}`}
            className="inline-block pt-0.5 text-xs text-amber-400 hover:text-amber-300"
          >
            View details →
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── CampaignMap ──────────────────────────────────────────────────────────────

export default function CampaignMap() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { viewMode } = useViewMode();
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [placingLocationId, setPlacingLocationId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [dragState, setDragState] = useState<{
    locationId: string;
    x: number;
    y: number;
  } | null>(null);

  // Keep a ref to the latest drag state so stable event handlers can read it.
  const dragStateRef = useRef(dragState);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // ─── Data ───────────────────────────────────────────────────────────────────

  const campaignQuery = useQuery({
    queryKey: ['campaign', campaignId, viewMode],
    queryFn: () => fetchCampaign(campaignId!, viewMode),
    enabled: !!campaignId,
  });
  const locationsQuery = useQuery({
    queryKey: ['locations', campaignId, viewMode],
    queryFn: () => fetchLocations(campaignId!, viewMode),
    enabled: !!campaignId,
  });

  const campaign = campaignQuery.data?.campaign;
  const locations = locationsQuery.data?.locations ?? [];
  const isDm = campaign?.my_role === 'dm';
  const worldMapUrl = useSignedUrl(campaign?.world_map_url ?? null);

  // ─── Container sizing ───────────────────────────────────────────────────────

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setContainerSize({ width: r.width, height: r.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [worldMapUrl.url]);

  // ─── Keyboard shortcut ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!placingLocationId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlacingLocationId(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [placingLocationId]);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const updatePositionMutation = useMutation({
    mutationFn: ({ locationId, x, y }: { locationId: string; x: number; y: number }) =>
      updateLocation(campaignId!, locationId, { map_x: x, map_y: y }),
    onMutate: async ({ locationId, x, y }) => {
      await queryClient.cancelQueries({ queryKey: ['locations', campaignId] });
      const previous = queryClient.getQueryData<LocationsResponse>(['locations', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<LocationsResponse>(['locations', campaignId, viewMode], {
          ...previous,
          locations: previous.locations.map((l) =>
            l.id === locationId ? { ...l, map_x: x, map_y: y } : l,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['locations', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['locations', campaignId] });
    },
  });

  const updateWorldMapMutation = useMutation({
    mutationFn: (path: string | null) =>
      updateCampaign(campaignId!, { world_map_url: path }),
    onMutate: async (path) => {
      await queryClient.cancelQueries({ queryKey: ['campaign', campaignId, viewMode] });
      const previous = queryClient.getQueryData<CampaignResponse>(['campaign', campaignId, viewMode]);
      if (previous) {
        queryClient.setQueryData<CampaignResponse>(['campaign', campaignId, viewMode], {
          ...previous,
          campaign: { ...previous.campaign, world_map_url: path ?? undefined },
        });
      }
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['campaign', campaignId, viewMode], data);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['campaign', campaignId, viewMode], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });

  // ─── Drag handlers (stable, attached once) ──────────────────────────────────

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragStateRef.current) return;
      const container = mapContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));
      setDragState((prev) => (prev ? { ...prev, x, y } : null));
    }

    function onMouseUp() {
      const curr = dragStateRef.current;
      if (!curr) return;
      updatePositionMutation.mutate({ locationId: curr.locationId, x: curr.x, y: curr.y });
      setDragState(null);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [updatePositionMutation.mutate]);

  // ─── Map click (placement mode) ─────────────────────────────────────────────

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingLocationId || dragStateRef.current) return;
    const container = mapContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));
    updatePositionMutation.mutate({ locationId: placingLocationId, x, y });
    setPlacingLocationId(null);
  }

  // ─── Derived state ───────────────────────────────────────────────────────────

  const placedLocations = locations.filter((l) => l.map_x != null && l.map_y != null);
  const unplacedLocations = locations.filter((l) => l.map_x == null || l.map_y == null);

  const hoveredLocation =
    hoveredLocationId && !dragState
      ? (locations.find((l) => l.id === hoveredLocationId) ?? null)
      : null;

  function getPanelLayout(location: Location) {
    if (!containerSize.width || location.map_x == null || location.map_y == null) return null;
    const dotX = location.map_x * containerSize.width;
    const dotY = location.map_y * containerSize.height;
    const spaceRight = containerSize.width - dotX - DOT_R - PANEL_GAP;
    const panelOnRight = spaceRight >= PANEL_W;
    const panelLeft = panelOnRight
      ? dotX + DOT_R + PANEL_GAP
      : Math.max(8, dotX - DOT_R - PANEL_GAP - PANEL_W);
    const panelTop = Math.max(
      8,
      Math.min(containerSize.height - PANEL_EST_H - 8, dotY - PANEL_EST_H / 2),
    );
    return {
      style: { position: 'absolute' as const, left: panelLeft, top: panelTop },
      lineX1: dotX,
      lineY1: dotY,
      lineX2: panelOnRight ? panelLeft : panelLeft + PANEL_W,
      lineY2: panelTop + PANEL_EST_H / 2,
    };
  }

  const panelLayout = hoveredLocation ? getPanelLayout(hoveredLocation) : null;

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (campaignQuery.isLoading || locationsQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">World Map</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {placedLocations.length} of {locations.length} location
            {locations.length !== 1 ? 's' : ''} placed
          </p>
        </div>
        {isDm && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FileUpload
              accept="image/png,image/jpeg"
              allowedMimeTypes={['image/png', 'image/jpeg']}
              uploadFile={uploadFile}
              onUploaded={(result) => updateWorldMapMutation.mutate(result?.path ?? null)}
            />
            <GenerateImageButton
              campaignId={campaignId!}
              entityType="campaign"
              entityId={campaignId!}
              fieldName="world_map_url"
              onGenerated={(path) => updateWorldMapMutation.mutate(path)}
            />
            {worldMapUrl.url && (
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(true)}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors"
                title="Remove world map"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove map
              </button>
            )}
          </div>
        )}
      </div>

      {/* Map area */}
      {worldMapUrl.url ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-950">
          <div
            ref={mapContainerRef}
            className={`relative w-full select-none ${
              placingLocationId
                ? 'cursor-crosshair'
                : dragState
                  ? 'cursor-grabbing'
                  : ''
            }`}
            onClick={handleMapClick}
          >
            <img
              src={worldMapUrl.url}
              alt="World map"
              className="block w-full rounded-xl"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                const rect = img.getBoundingClientRect();
                setContainerSize({ width: rect.width, height: rect.height });
              }}
            />

            {/* Placed markers */}
            {placedLocations.map((location) => {
              const isHovered = hoveredLocationId === location.id && !dragState;
              const isDragging = dragState?.locationId === location.id;
              const x = isDragging ? dragState!.x : location.map_x!;
              const y = isDragging ? dragState!.y : location.map_y!;

              return (
                <div
                  key={location.id}
                  className="pointer-events-auto absolute flex flex-col items-center"
                  style={{
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isHovered || isDragging ? 10 : 5,
                  }}
                  onMouseEnter={() => setHoveredLocationId(location.id)}
                  onMouseLeave={() => setHoveredLocationId(null)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={
                    isDm && !placingLocationId
                      ? (e) => {
                          e.stopPropagation();
                          setHoveredLocationId(null);
                          const container = mapContainerRef.current;
                          if (!container) return;
                          const rect = container.getBoundingClientRect();
                          setDragState({
                            locationId: location.id,
                            x: Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width)),
                            y: Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height)),
                          });
                        }
                      : undefined
                  }
                >
                  <div
                    className={`rounded-full border-2 shadow-md transition-all duration-100 ${
                      isDm && !placingLocationId ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${
                      isHovered
                        ? 'scale-150 border-white bg-amber-300 shadow-amber-500/50'
                        : isDragging
                          ? 'scale-150 border-amber-100 bg-amber-400'
                          : 'border-amber-200 bg-amber-500'
                    }`}
                    style={{ width: DOT_R * 2, height: DOT_R * 2 }}
                  />
                  <span
                    className={`mt-1 max-w-[80px] text-center text-[10px] font-medium leading-tight text-white ${
                      isHovered ? 'underline' : ''
                    }`}
                    style={{
                      textShadow:
                        '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)',
                    }}
                  >
                    {location.name}
                  </span>
                </div>
              );
            })}

            {/* Hover panel + connecting line */}
            {hoveredLocation && panelLayout && (
              <LocationHoverPanel
                location={hoveredLocation}
                campaignId={campaignId!}
                style={panelLayout.style}
                lineX1={panelLayout.lineX1}
                lineY1={panelLayout.lineY1}
                lineX2={panelLayout.lineX2}
                lineY2={panelLayout.lineY2}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50">
          <div className="max-w-xs text-center">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            {isDm ? (
              <>
                <p className="mb-1 font-medium text-slate-300">No world map yet</p>
                <p className="text-sm text-slate-500">
                  Upload or generate a world map above to start placing locations.
                </p>
              </>
            ) : (
              <p className="text-slate-400">The DM hasn't added a world map yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Unplaced locations (DM only, when a world map exists) */}
      {isDm && worldMapUrl.url && unplacedLocations.length > 0 && (
        <div className="shrink-0 rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Unplaced Locations
            {placingLocationId && (
              <span className="ml-2 font-normal normal-case tracking-normal text-amber-400">
                — click the map to place, or press Esc to cancel
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {unplacedLocations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() =>
                  setPlacingLocationId((prev) => (prev === location.id ? null : location.id))
                }
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  placingLocationId === location.id
                    ? 'border-amber-500 bg-amber-600/20 text-amber-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                <MapPin className="h-3 w-3" />
                {location.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Remove map confirmation */}
      <ConfirmModal
        open={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={() => {
          updateWorldMapMutation.mutate(null);
          setShowRemoveConfirm(false);
        }}
        title="Remove world map"
        message="Are you sure you want to remove the world map? Location pins will be preserved and can be re-placed after uploading a new map."
        confirmLabel="Remove map"
        cancelLabel="Keep map"
        variant="danger"
        isLoading={updateWorldMapMutation.isPending}
      />
    </div>
  );
}
