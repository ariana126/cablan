-- Issue #101's legacy carry-over: every order number the daily BOMs were
-- registered with becomes an order, and every standard BOM those daily BOMs
-- used is assigned to it once, in the order it was first used. No `bom` row
-- is touched. One idempotent DO block, so the test stack can re-run it
-- (`POST /api/testing/boms/order-backfill`, `orders.int-spec.ts`): an order
-- already defined keeps its number and MI codes and gains only the ones it
-- lacks. A daily BOM whose standard BOM no longer exists carries nothing
-- over (its MI code has no standard BOM to assign).
DO $$
BEGIN
  INSERT INTO "bom_order" ("id", "order_number", "created_at", "updated_at")
  SELECT gen_random_uuid()::text, legacy."order_number", now(), now()
  FROM (
    SELECT DISTINCT b."order_number"
    FROM "bom" b
    JOIN "standard_bom" s ON s."id" = b."standard_bom_id"
  ) legacy
  ON CONFLICT ("order_number") DO NOTHING;

  INSERT INTO "bom_order_mi_code"
    ("id", "order_id", "standard_bom_id", "mi_code", "product_id", "product_name", "position")
  SELECT
    gen_random_uuid()::text,
    o."id",
    used."standard_bom_id",
    s."mi_code",
    s."product_id",
    s."product_name",
    COALESCE(
      (SELECT MAX(e."position") + 1 FROM "bom_order_mi_code" e WHERE e."order_id" = o."id"),
      0
    ) + ROW_NUMBER() OVER (PARTITION BY o."id" ORDER BY used."first_registration") - 1
  FROM (
    SELECT "order_number", "standard_bom_id", MIN("registration_sequence") AS "first_registration"
    FROM "bom"
    GROUP BY "order_number", "standard_bom_id"
  ) used
  JOIN "standard_bom" s ON s."id" = used."standard_bom_id"
  JOIN "bom_order" o ON o."order_number" = used."order_number"
  WHERE NOT EXISTS (
    SELECT 1 FROM "bom_order_mi_code" e
    WHERE e."order_id" = o."id" AND e."standard_bom_id" = used."standard_bom_id"
  );
END $$;
