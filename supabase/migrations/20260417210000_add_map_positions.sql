-- Add world map image to campaigns and positional coordinates to locations.
-- map_x / map_y are fractional (0.0–1.0) so marker positions stay correct
-- regardless of how the image is rendered client-side.

ALTER TABLE campaigns ADD COLUMN world_map_url text;

ALTER TABLE locations ADD COLUMN map_x double precision;
ALTER TABLE locations ADD COLUMN map_y double precision;
