-- Migration: replace sprite_svg with model_key + fallback_svg on characters table.
-- model_key: the procedural 3D character key (same as the character key, used to select the 3D model).
-- fallback_svg: a flat SVG illustration used when WebGL is unavailable.

ALTER TABLE "characters" RENAME COLUMN "sprite_svg" TO "fallback_svg";
ALTER TABLE "characters" ADD COLUMN "model_key" TEXT NOT NULL DEFAULT '';

-- Backfill model_key to equal the character key (same value, explicit column for future flexibility).
UPDATE "characters" SET "model_key" = "key";

-- Remove the default now that rows are populated.
ALTER TABLE "characters" ALTER COLUMN "model_key" DROP DEFAULT;
