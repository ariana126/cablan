-- Issue #62: digits typed on a Persian keyboard -- Persian (U+06F0-06F9) and
-- Arabic-Indic (U+0660-0669) -- are now stored as English digits (0-9) by the
-- domain (`toAsciiDigits`, applied where each value object is constructed).
-- This normalises the rows written before that, once, the same way: every
-- such digit becomes its English digit, and no other character changes.
--
-- Columns with no uniqueness constraint are translated unconditionally. This
-- includes every snapshot copy (ADR 0004) of a normalised value: a daily
-- BOM's MI code, brand and product name, a standard BOM's product name, and
-- the component/material names cloned into each composition table.
--
-- Unique columns -- standard_bom.mi_code, material.code, material.name,
-- component.name and, among active users only (the partial index
-- "app_user_username_active_key"), app_user.username -- are translated only
-- for a row whose translated value equals no other row's translated value. A
-- row that would collide, whether with a row already in English digits or
-- with another row translated to the same value, is left as it is and named
-- in a NOTICE, for the duplicate to be resolved by hand. A soft-deleted
-- user's username is outside that index and is translated unconditionally.
--
-- The audit log is history, not current data, and is deliberately left as
-- recorded. Translating text that has no such digit is a no-op, so running
-- this block again changes nothing further.
--
-- One DO block, so the whole migration is a single statement.
DO $$
DECLARE
  typed_digits CONSTANT text := '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
  ascii_digits CONSTANT text := '01234567890123456789';
  target record;
  skipped record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('bom', 'order_number'),
      ('bom', 'tracking_number'),
      ('bom', 'description'),
      ('bom', 'standard_bom_mi_code'),
      ('bom', 'brand'),
      ('bom', 'product_name'),
      ('bom_component', 'name'),
      ('bom_material', 'name'),
      ('standard_bom', 'brand'),
      ('standard_bom', 'product_name'),
      ('standard_bom_component', 'name'),
      ('standard_bom_material', 'name'),
      ('product', 'name'),
      ('product_component', 'name'),
      ('product_material', 'name')
    ) AS non_unique (table_name, column_name)
  LOOP
    EXECUTE format(
      'UPDATE %1$I SET %2$I = translate(%2$I, $1, $2) '
      'WHERE %2$I <> translate(%2$I, $1, $2)',
      target.table_name, target.column_name
    ) USING typed_digits, ascii_digits;
  END LOOP;

  UPDATE "app_user"
  SET "username" = translate("username", typed_digits, ascii_digits)
  WHERE "is_deleted" = true
    AND "username" <> translate("username", typed_digits, ascii_digits);

  -- `scope` restricts both the rows translated and the rows they may collide
  -- with to those the unique index covers.
  FOR target IN
    SELECT * FROM (VALUES
      ('standard_bom', 'mi_code', 'true'),
      ('material', 'code', 'true'),
      ('material', 'name', 'true'),
      ('component', 'name', 'true'),
      ('app_user', 'username', 'is_deleted = false')
    ) AS uniquely_indexed (table_name, column_name, scope)
  LOOP
    FOR skipped IN EXECUTE format(
      'SELECT candidate.id, candidate.%2$I AS value FROM %1$I candidate '
      'WHERE (%3$s) '
      'AND candidate.%2$I <> translate(candidate.%2$I, $1, $2) '
      'AND EXISTS (SELECT 1 FROM %1$I other WHERE (%3$s) '
      'AND other.id <> candidate.id '
      'AND translate(other.%2$I, $1, $2) = translate(candidate.%2$I, $1, $2)) '
      'ORDER BY candidate.id',
      target.table_name, target.column_name, target.scope
    ) USING typed_digits, ascii_digits
    LOOP
      RAISE NOTICE 'Persian-digit normalisation skipped %.% of row % (%): its English-digit form % is already taken or shared with another row; resolve by hand',
        target.table_name, target.column_name, skipped.id, skipped.value,
        translate(skipped.value, typed_digits, ascii_digits);
    END LOOP;

    -- One statement: every NOT EXISTS reads the table as it stood before the
    -- update, so two rows that would translate to the same value both stay.
    EXECUTE format(
      'UPDATE %1$I candidate SET %2$I = translate(candidate.%2$I, $1, $2) '
      'WHERE (%3$s) '
      'AND candidate.%2$I <> translate(candidate.%2$I, $1, $2) '
      'AND NOT EXISTS (SELECT 1 FROM %1$I other WHERE (%3$s) '
      'AND other.id <> candidate.id '
      'AND translate(other.%2$I, $1, $2) = translate(candidate.%2$I, $1, $2))',
      target.table_name, target.column_name, target.scope
    ) USING typed_digits, ascii_digits;
  END LOOP;
END
$$;
