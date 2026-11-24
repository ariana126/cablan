-- Products, standard BOMs and daily BOMs each keep a copy of the name of
-- every material in their composition, taken when they were saved (ADR 0004).
-- Before the in-use lock (issue #94) and the System Admin's correction (issue
-- #110), materials were renamed -- by hand and by material imports -- without
-- those copies following, so some still hold an old name. Since #110 a
-- correction carries the new name into every copy; this catches up the drift
-- left from before, once.
--
-- Every copy whose material still exists takes that material's current name.
-- A copy whose material has since been deleted has no current name to take
-- and keeps the one it has (the join skips it). Only the material-name column
-- of a stale copy changes: component and product name copies, ids, positions,
-- weights, reviews and history are left as they are, and the audit log is not
-- written -- this repairs pre-rule leftovers rather than recording something a
-- person did. A copy already matching is not touched, so running this block
-- again changes nothing.
--
-- One DO block, so the whole migration is a single statement.
DO $$
BEGIN
  UPDATE "product_material" AS copied
  SET "name" = m."name"
  FROM "material" AS m
  WHERE m."id" = copied."material_id"
    AND copied."name" IS DISTINCT FROM m."name";

  UPDATE "standard_bom_material" AS copied
  SET "name" = m."name"
  FROM "material" AS m
  WHERE m."id" = copied."material_id"
    AND copied."name" IS DISTINCT FROM m."name";

  UPDATE "bom_material" AS copied
  SET "name" = m."name"
  FROM "material" AS m
  WHERE m."id" = copied."material_id"
    AND copied."name" IS DISTINCT FROM m."name";
END $$;
