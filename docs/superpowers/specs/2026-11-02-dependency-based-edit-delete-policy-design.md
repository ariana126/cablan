# Dependency-based edit and delete policy — design

Issue #94. **Capability:** a record that another record references (uses, or was registered on
the basis of) can be neither edited nor deleted while that reference exists; the user is told
where it is used; once every reference is gone the record is free again; deleting a record never
deletes anything else. System Admin has no exception. User accounts are explicitly outside the
rule — managing an account never touches the history that names the user.

## Scenarios

All new scenarios were appended, as approved, to eight feature files:

| Feature file | Rule |
|---|---|
| `bom-registration/registring-material.feature` | a material used by a product / standard BOM can't be edited or deleted |
| `bom-registration/registring-component.feature` | same, for components |
| `bom-registration/registring-product.feature` | a product with a standard BOM can't be deleted or edited, composition locked; deleting a product deletes nothing else |
| `bom-registration/registring-standard-bom.feature` | a standard BOM with a daily BOM can't be deleted or edited (weights, MI code, brand) |
| `bom-analyzing/resampling-bom.feature` | a daily BOM that was re-sampled can't be deleted |
| `maintenance-management/registring-equipment.feature` | equipment with PM plan items (active or deactivated) can't be renamed, not even by System Admin |
| `maintenance-management/registring-maintenance-activity.feature` | an activity in any PM plan (active or deactivated) can't be renamed |
| `authentication/registring-user.feature` | deleting / re-roling a user with history is allowed, history keeps their name |

Which steps go through the browser is QA's door-split call (grammatical voice). The "به او گفته
شود …" outcome is a message the user reads, so the UI must render it from the problem response
on every edit/delete surface listed above.

## Decisions

**One rule, one mechanism, inverted dependencies.** Module dependencies point
`boms → manufacturing-instructions → products`; `maintenance` stands alone. The record that must be
protected lives *upstream* of whoever references it, so the upstream module cannot ask its
consumers directly without reversing those arrows. Instead `framework/` owns a port:

- `RecordReference` = `{ type: ReferencedRecordType; id: string }`, with
  `ReferencedRecordType` = `'Material' | 'Component' | 'Product' | 'StandardBom' | 'Bom' |
  'Equipment' | 'MaintenanceActivity'`.
- `DependentsProbe` — implemented by **each module that holds references**, answering only for the
  record types it references, from its own tables:
  - `products`: Material, Component ← products' compositions (`product_component`,
    `product_material`)
  - `manufacturing-instructions`: Material, Component (its composition lines), Product
    (`productId`)
  - `boms`: Material, Component (its composition lines), StandardBom (`standardBomId`),
    Bom (`resampledFromId`, new — see below)
  - `maintenance`: Equipment, MaintenanceActivity ← `pm_plan_item` rows, active **and**
    deactivated (executions always hang off a plan item, and plan items are never deleted, so
    plan items cover execution history too)
- `RecordDependencies` (framework application service) gathers every registered probe's answer
  and `assertNoDependents(reference)` throws `RecordHasDependents` when any exists.
- Each edit/delete command handler of a protected record calls it before mutating. New features
  plug in by registering a probe for what they reference — that is the "applies to future
  features" acceptance criterion made structural.

Only **direct** references count. A daily BOM always references a standard BOM, which already
locks the product, so indirect chains are covered by the direct links (issue answer 5).

**Problem type:** 409 `record-has-dependents`, title "Record has dependents", extension members:

```json
{
  "recordType": "Material",
  "dependents": [
    { "kind": "product", "count": 1, "names": ["کابل NYY"] },
    { "kind": "standard-bom", "count": 1, "names": ["MI-100"] }
  ]
}
```

`kind` ∈ `product` (names = product names) | `standard-bom` (MI codes) | `daily-bom` (order
numbers) | `resampled-daily-bom` (order numbers of the re-samples) | `equipment-pm-plan` (equipment
names whose PM plan holds the record; for an Equipment subject, the equipment itself). Sorted
by kind in that order, names sorted. Mapped once, in the framework exception filter.

**What is locked, per record (absolute — any change, even a typo):**

| Record | Edit | Delete | Dependents |
|---|---|---|---|
| Material | `PATCH /materials/:id` | `DELETE /materials/:id` | product, standard-bom, daily-bom |
| Component | `PATCH /components/:id` | `DELETE /components/:id` | product, standard-bom, daily-bom |
| Product | `PATCH /products/:id` (fields **and** composition) | `DELETE /products/:id` | standard-bom |
| Standard BOM | `PATCH /standard-boms/:id` (incl. active flag) | `DELETE /standard-boms/:id` | daily-bom |
| Daily BOM | `PATCH /boms/:id` | `DELETE /boms/:id` | resampled-daily-bom |
| Equipment | `PATCH /equipment/:id` (rename) | — (no route) | equipment-pm-plan |
| Activity | `PATCH /maintenance-activities/:id` (rename) | — (no route) | equipment-pm-plan |

Not locked (own rules, per the approved assumptions): PM plan operations, equipment retirement,
approve/reject/resample of a daily BOM, material-import reversion, user accounts. A no-op save
that changes nothing is still a save of a locked record → refused (simplest, absolute).

**Re-sampling now persists its link:** `bom.resampled_from_id` (nullable, no FK, set by
`Bom.resample()`), migration without backfill — earlier re-samples left no trace to recover.

**Users:** no behaviour change is expected; the backend verifies that every history record that
names a user (daily BOM registrar/editor/reviewer, maintenance execution performer) survives the
user's deletion and role change, and fixes it if a name is resolved live from `app_user`.

**Audit log entries are not dependents** (issue answer 1).

## UI scope

No new page. On every edit/delete surface for the seven record types the frontend maps a 409
`record-has-dependents` to a Persian message built from `dependents`, e.g.

> امکان حذف این اطلاعات وجود ندارد، زیرا در 1 محصول («کابل NYY») استفاده شده است.

labels: محصول / آنالیز استاندارد / آنالیز روزانه / نمونه گیری مجدد («از این آنالیز روزانه
نمونه گیری مجدد شده است») / برنامه PM ... تجهیز. Several kinds are joined with «و».

## Risks

- **Check-then-act race:** a reference created between the check and the mutation slips through.
  Accepted, like re-sampling's own "no lock" decision; the windows are milliseconds on rare,
  manual operations.
- **Existing scenarios** whose setup edits a product after registering its standard BOM (or a
  standard BOM after a daily BOM) will now fail; QA triages them in step 6 — the fix is to the
  automation's setup order, never the rule.
- The "only in standard BOM MI-100" example is unreachable through the public API (a standard
  BOM's composition is cloned from its product's, which then stays locked); QA sets it up as
  product + standard BOM and asserts the dependents include exactly 1 standard BOM "MI-100".
