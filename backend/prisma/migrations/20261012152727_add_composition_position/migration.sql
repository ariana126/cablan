-- AlterTable
ALTER TABLE "bom_component" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "bom_material" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "standard_bom_component" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "standard_bom_material" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill (hand-added before this migration was ever applied).
--
-- Rows written before this column existed carry no record of their order,
-- and the aggregates always replace a composition by deleting and
-- re-inserting it, so physical insertion order (ctid) is the closest
-- surviving trace of the array order they were saved in. It is
-- deterministic for a given database, and only a best-effort recovery of the
-- original order where freed space was reused after an edit.

-- Standard BOM components: insertion order within each standard BOM.
UPDATE "standard_bom_component" AS c
SET "position" = o."position"
FROM (
  SELECT "id",
         (ROW_NUMBER() OVER (PARTITION BY "standard_bom_id" ORDER BY ctid) - 1)::INTEGER AS "position"
  FROM "standard_bom_component"
) AS o
WHERE c."id" = o."id";

-- Standard BOM materials: insertion order within each component.
UPDATE "standard_bom_material" AS m
SET "position" = o."position"
FROM (
  SELECT "id",
         (ROW_NUMBER() OVER (PARTITION BY "standard_bom_component_id" ORDER BY ctid) - 1)::INTEGER AS "position"
  FROM "standard_bom_material"
) AS o
WHERE m."id" = o."id";

-- Daily BOM components follow their standard BOM's order, since they are
-- cloned from it; a component no longer on the standard BOM goes last, in
-- insertion order.
UPDATE "bom_component" AS c
SET "position" = o."position"
FROM (
  SELECT bc."id",
         (ROW_NUMBER() OVER (
           PARTITION BY bc."bom_id"
           ORDER BY sc."position" NULLS LAST, bc.ctid
         ) - 1)::INTEGER AS "position"
  FROM "bom_component" AS bc
  JOIN "bom" AS b ON b."id" = bc."bom_id"
  LEFT JOIN "standard_bom_component" AS sc
    ON sc."standard_bom_id" = b."standard_bom_id"
   AND sc."component_id" = bc."component_id"
) AS o
WHERE c."id" = o."id";

-- Daily BOM materials likewise follow the standard BOM component's material
-- order, with any material no longer on it last, in insertion order.
UPDATE "bom_material" AS m
SET "position" = o."position"
FROM (
  SELECT bm."id",
         (ROW_NUMBER() OVER (
           PARTITION BY bm."bom_component_id"
           ORDER BY sm."position" NULLS LAST, bm.ctid
         ) - 1)::INTEGER AS "position"
  FROM "bom_material" AS bm
  JOIN "bom_component" AS bc ON bc."id" = bm."bom_component_id"
  JOIN "bom" AS b ON b."id" = bc."bom_id"
  LEFT JOIN "standard_bom_component" AS sc
    ON sc."standard_bom_id" = b."standard_bom_id"
   AND sc."component_id" = bc."component_id"
  LEFT JOIN "standard_bom_material" AS sm
    ON sm."standard_bom_component_id" = sc."id"
   AND sm."material_id" = bm."material_id"
) AS o
WHERE m."id" = o."id";
