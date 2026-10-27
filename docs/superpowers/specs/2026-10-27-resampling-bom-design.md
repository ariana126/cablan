# Re-sampling a rejected daily BOM (نمونه گیری مجدد) — design

**Date:** 2026-10-27 · **Mode:** auto · **Issue:** #72 · Gherkin approved in the issue
(latest `<!-- cablan:gherkin-proposal -->`, approved by the stakeholder), added verbatim as
`acceptance-tests/specs/bom-analyzing/resampling-bom.feature`.

## Capability

When the **latest** daily BOM of a tracking number is **rejected** (عدم تایید), a QC inspector,
management or the system admin can re-sample it: register a new daily BOM carrying the rejected
one's order number, tracking number and MI code — not editable — entering only the new sample's
weights and an optional description. The new BOM is an ordinary daily BOM: pending on registration,
same validation, same edit/review lifecycle. The rejected BOM is left untouched. Registering a new
daily BOM by hand stays possible.

## Scenarios

All in `bom-analyzing/resampling-bom.feature`.

- UI-voiced (active `When`s, the browser is the point): «… نمونه گیری مجدد می کند» (main scenario,
  the cloned-header example, the re-reject-then-re-sample example, invalid weight outline, no
  description, authorized-users outline) and «… آنالیز های روزانه شماره ردیابی … را مشاهده می کند»
  (which list rows offer the button).
- API: the passive Givens («… نمونه گیری مجدد کرده باشد», «آنالیز های روزانه … به ترتیب ثبت با
  وضعیت های …», the background registration with a tracking number), the refused attempts
  («تلاش می کند …»: re-sampling the same rejected BOM again → 409, reporter → 403), and the facts
  checked in `Then`s (`POST boms/report` / `GET boms/:id`).

## Decisions

1. **"Latest" = the most recently registered (`createdAt`) daily BOM with the same tracking
   number** (exact stored value; tracking numbers are already digit-normalised). A BOM is
   *resamplable* iff its status is `rejected` and no other daily BOM with its tracking number was
   registered after it. Computed on read, not stored — it changes when *another* BOM is registered,
   edited (tracking number change) or deleted.
2. **Read models carry `resamplable: boolean`** — the report row (`POST /boms/report`, which the
   `/boms` list reads) and the detail (`GET /boms/:id`). The frontend shows the button from it and
   never re-derives the rule.
3. **Command `ResampleBom`**, endpoint `POST /boms/:id/resampling`, roles
   `QcInspector, Management, SystemAdmin` (same as registration). Body
   `{ components: [{ componentId, materialId, weight }], description? }` — the same component
   input and validation as `POST /boms` (weights required, non-zero; 400 on invalid). No order
   number / tracking number / MI code in the body: they are taken from the source BOM, which is
   what makes them unchangeable. Response **201 `{ id }`** like registration. The composition is
   cloned from the source's `standardBomMiCode` through the existing `BomCompositionFactory`.
   `registeredBy` is the acting user. Unknown id → 404 (the module's existing not-found). Source not
   resamplable (not rejected, or not the latest) → **409 `bom-not-resamplable`**.
4. **Same aggregate, new factory path.** It is a registration (`Bom.register`, `BomRegistered`
   audit entry as usual), decided by the application handler after asking the repository whether a
   later BOM exists for the tracking number. No link to the source is persisted — nothing in the
   Gherkin reads it.
5. **UI.** On `/boms`, the actions column of a row with `resamplable` gets a «نمونه گیری مجدد»
   button. It opens the existing daily-BOM form dialog in a resample mode: order number, tracking
   number and MI code pre-filled and disabled; the composition of that standard BOM with empty
   weights; empty description; submit calls `POST /boms/:id/resampling`; server/field errors as in
   registration. After success, behave like registration (preview), and the list refreshes so the
   old row loses the button.

## Risks

- Two concurrent re-samples of the same rejected BOM can both pass the check (no lock). Accepted:
  a duplicate is visible, editable and deletable, and the button disappears after one.
- The resample button and the edit/delete buttons crowd the sticky actions column — the frontend
  keeps it within the existing compact row actions.
