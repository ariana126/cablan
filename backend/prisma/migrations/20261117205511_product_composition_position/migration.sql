-- AlterTable
ALTER TABLE "product_component" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "product_material" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill (hand-added before this migration was ever applied).
--
-- A product's composition carried no order before this column (issue #122),
-- and the repository always replaces it by deleting and re-inserting it, so
-- physical insertion order (ctid) is the closest surviving trace of the array
-- order it was saved in — best effort, as for the standard and daily BOMs'
-- `position` in 20261012152727_add_composition_position.

-- Product components: insertion order within each product.
UPDATE "product_component" AS c
SET "position" = o."position"
FROM (
  SELECT "id",
         (ROW_NUMBER() OVER (PARTITION BY "product_id" ORDER BY ctid) - 1)::INTEGER AS "position"
  FROM "product_component"
) AS o
WHERE c."id" = o."id";

-- Product materials: insertion order within each component.
UPDATE "product_material" AS m
SET "position" = o."position"
FROM (
  SELECT "id",
         (ROW_NUMBER() OVER (PARTITION BY "product_component_id" ORDER BY ctid) - 1)::INTEGER AS "position"
  FROM "product_material"
) AS o
WHERE m."id" = o."id";
