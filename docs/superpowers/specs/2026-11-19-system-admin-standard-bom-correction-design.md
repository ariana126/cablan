# System Admin correction of a standard BOM in use — design

Issue #126, a new System Admin exception to issue #94's rule (see
`2026-11-04-system-admin-dependency-exceptions-design.md` for the earlier ones).

**Capability:** the System Admin — and only the System Admin — may correct a standard BOM
(«آنالیز استاندارد») that an order or a daily BOM references: its standard weights, brand,
standard length, description and active flag. Its MI code and the set of components/materials stay
locked even for them, and deleting it stays refused for everyone. Earlier daily BOMs keep their
review decision, reviewer, management note, measured weights and edit history; they show the new
brand and standard length, and every comparison (dashboard differences, score, ordering, preview,
Excel export) is against the standard BOM's current weights.

## Scenarios (approved in the issue's `cablan:gherkin-proposal` comment)

`acceptance-tests/specs/bom-registration/registring-standard-bom.feature`

- The two existing lock rules are retitled («… جز اصلاح هایی که مدیر سیستم مجاز به آن است …»);
  their delete scenarios become outlines over مصطفی and یاشار (both refused). Their edit outlines
  (مصطفی refused) are unchanged.
- New rule «مدیر سیستم می تواند … اصلاح کند»:
  - «اصلاح آنالیز استاندارد استفاده شده توسط مدیر سیستم» (outline: weights, brand, standard length,
    description, active flag) — **UI-voiced** (the person edits).
  - «مدیر سیستم هم کد MI یا اجزا و مواد اولیه … را نمی تواند تغییر دهد» (outline: MI code, adding
    a material to a component, removing a material from a component) — refused with the usual
    `record-has-dependents` message.
  - «آنالیز روزانه قبلی برند و متراژ استاندارد اصلاح شده را نشان می دهد».
  - «غیرفعال کردن آنالیز استاندارد مانع ثبت آنالیز روزانه جدید با آن نمی شود».
  - «اصلاح آنالیز استاندارد با مقادیر قبل و بعد در رویدادهای سیستم ثبت می شود».
- New rule «اصلاح … تصمیم ها و اطلاعات ثبت شده آنالیز های روزانه قبلی را تغییر نمی دهد»:
  «آنالیز های روزانه قبلی پس از اصلاح وزن استاندارد بدون تغییر می مانند».

`bom-analyzing/bom-dashboard.feature` — new rule, three examples: a corrected weight (100→105 vs
110 → difference and score 5); another standard BOM of the same product unaffected and ordering
follows the new scores; the background's 1001 corrected (3/6) flips ORD-5001 above ORD-5002.

`bom-reporting/exporting-bom.feature` — new rule: after 1001's brand/length become اشنایدر/300,
ORD-2001's per-BOM row reads اشنایدر, 300, 23, 6900, 300.

Door split is QA's call by grammatical voice.

## Decisions

### 1. No new route, no confirmation flag

`PATCH /standard-boms/:id` keeps its body. The issue's approved assumption is that the System Admin
saves directly — no «آیا در اطلاعات و سوابق مرتبط هم اعمال شود؟» dialog — so there is no
`applyToRelatedRecords` here. The controller resolves whether the caller is currently `SystemAdmin`
(the role is looked up per request, as `RolesGuard`/`ApplyToRelatedRecordsResolver` do) and passes
it into `EditManufacturingInstructionCommand` as **`actorIsSystemAdmin: boolean`** (backend may name
it otherwise; it is not on the wire).

`EditManufacturingInstructionHandler`:

- No dependents → unchanged (any edit, any permitted role).
- Dependents and the caller is not System Admin → unchanged: 409 `record-has-dependents`.
- Dependents and the caller is System Admin → allowed **only if** the MI code is unchanged
  (after digit normalisation) **and** the composition, if sent, has exactly the same set of
  `(componentId, materialId)` pairs as the stored one (weights may differ; order is irrelevant).
  Otherwise the same 409 `record-has-dependents` with the same `dependents` list — that is what the
  approved scenario asserts («به او گفته شود که "MI-100" در 1 آنالیز روزانه … استفاده شده است»).
- Uniqueness and composition invariants run as today.

### 2. Daily BOM snapshots: brand and standard length propagate, nothing else

Weights are already compared live: the dashboard, `GET /boms/:id/weight-differences` (the preview)
and the export all read the standard BOM's **current** weights through `StandardBomWeights`. Only
`bom.brand` and `bom.standard_length` are snapshots that must follow a correction.

`manufacturing-instructions` may not import `boms`, so the rewrite goes through a framework port,
in the edit's transaction, like issue #110's `CorrectionPropagator` and issue #122's
`CompositionOrderPropagator`. Backend's call whether to widen the existing `CorrectionPropagator`'s
correction or add a sibling port; either way `boms`' implementation updates `brand` and
`standard_length` of every daily BOM whose `standard_bom_id` is the corrected one, **by raw SQL so
`updated_at` is not bumped**, with no domain event, no audit entry, no change to approval status,
reviewer, management note, weights, `edit_history` or `pending_review_changes`. A daily BOM is
never returned to pending by this.

Orders hold only MI codes, which cannot change here, so orders need nothing.

### 3. Audit

The correction is the standard BOM's ordinary `ManufacturingInstructionEdited` → `StandardBom` /
`Edited` entry, actor and time as usual, with old → new per changed field **including each changed
standard weight** (e.g. `100` → `105` for مغزی/مسی). Backend verifies the existing event/handler
already carries per-material weight changes and adds them if not. Earlier entries are untouched.

### 4. Deactivation

Registering a daily BOM against an inactive standard BOM must keep working (approved answer 5).
Backend verifies the registration path does not check `active`; no change expected.

### 5. UI

- The standard BOM edit dialog already exists. For a System Admin it must let an in-use standard
  BOM's weights, brand, standard length, description and active flag be saved; MI-code or
  composition-structure changes come back 409 and are shown through `recordHasDependentsMessage()`
  inside the open dialog, as today.
- Dashboard (per-product daily BOM list): a short explanatory note so the user knows the
  differences are against the **current** standard and the approval status is the earlier recorded
  decision — e.g. «اختلاف ها با آخرین وزن های استاندارد محاسبه می شوند؛ وضعیت تایید، تصمیم ثبت شده
  قبلی است.» Plain text, design-system tokens only, no new route.

## Risks

- Allowing "same set, new weights" requires comparing pairs, not just lengths; a reorder alone is
  not a structure change.
- Raw SQL in `boms` against its own table only; no cross-module table access is added.
- The existing edit outlines for مصطفی (weights, MI code, brand refused) must stay red→409.
