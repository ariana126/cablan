import { DataTable } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { FreezeTimeAt } from '../common/clock';
import { parseJalaliDateTime } from '../common/jalali-datetime';
import {
  LogInAsPersona,
  personaIdentity,
  realNameFor,
} from '../common/personas';
import { AuditAction, AuditRecordType } from './view-audit-log';
import {
  freshUserDetails,
  theLastRegisteredUser,
} from '../authentication/user-details';
import { RegisterUserAndRememberIt } from '../authentication/register-user';
import { DeleteUser } from '../authentication/delete-user';
import {
  freshComponentDetails,
  theLastRegisteredComponent,
} from '../bom-registration/component-details';
import { RegisterComponentAndRememberIt } from '../bom-registration/register-component';
import { DeleteComponent } from '../bom-registration/delete-component';
import {
  freshMaterialDetails,
  theLastRegisteredMaterial,
} from '../bom-registration/material-details';
import { RegisterMaterialAndRememberIt } from '../bom-registration/register-material';
import {
  freshProductDetails,
  RegisteredProduct,
  theLastRegisteredProduct,
} from '../bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../bom-registration/register-product';
import {
  RegisteredStandardBom,
  theLastRegisteredStandardBom,
} from '../bom-registration/standard-bom-details';
import { RegisterStandardBomAndRememberIt } from '../bom-registration/register-standard-bom';
import { EditStandardBom } from '../bom-registration/edit-standard-bom';
import {
  RegisteredBom,
  theLastRegisteredBom,
} from '../bom-registration/bom-details';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';
import { EditBom } from '../bom-registration/edit-bom';

/**
 * Test-data setup for `viewing-audit-log.feature`'s own background — "اینکه رویدادهای زیر در سیستم
 * ثبت شده باشند:". There is no API to seed audit-log rows directly (this suite never reaches
 * around the backend's own HTTP surface — see `acceptance-tests/CLAUDE.md`'s hard boundaries), so
 * every one of the table's ten rows is produced by actually performing the real, top-level domain
 * command it names — register/edit/delete a user, product, component, material, standard BOM or
 * daily BOM — through each module's own existing endpoint, with the backend's test clock frozen to
 * that row's own "تاریخ و زمان" immediately before it runs. Freezing right before the row's actor
 * authenticates (not after) mirrors `screenplay/bom-reporting/bom-report-fixtures.ts`'s own
 * reasoning: a JWT's `iat`/`exp` are stamped from whatever the clock reads at LOGIN time, so an
 * actor who logged in under an earlier freeze would find their own token already stale once the
 * clock has since moved on.
 *
 * Three things this fixture needs that are NOT one of the ten rows, all handled up front while the
 * clock is frozen at `NOISE_INSTANT` — deliberately far earlier than every Jalali date the table
 * itself uses (`1403/...`, all in 2024), so whatever audit event each one unavoidably produces
 * sorts to the very END of a newest-first list, never among the ten:
 *
 * - Row 2 ("حذف کاربر") and row 10 ("حذف جز") each delete something that has to already exist.
 *   Neither one's OWN prior registration is itself one of the ten rows, so a throwaway user and a
 *   throwaway component are registered here first, for exactly those two rows to delete later.
 * - Row 3 registers a product with NO explicit composition of its own — it doesn't need one, only
 *   a product to exist — but `freshProductDetails()`'s default composition names a component and a
 *   material that don't exist anywhere yet. `ProductCompositionFactory`
 *   (`backend/src/modules/products/application/service/product-composition.factory.ts`)
 *   auto-registers any not-yet-existing component/material named in a product's composition as a
 *   side effect of registering the product — and unlike `throwawayUser`/`throwawayComponent` above,
 *   that side effect can't be backdated to `NOISE_INSTANT`: it is a genuine, timestamp-accurate
 *   consequence of row 3's OWN registration, so it would otherwise land at row 3's own instant and
 *   pollute the newest-first ordering between rows 3 and 4. A throwaway component and material are
 *   therefore registered here too, up front, and named explicitly in row 3's own composition below
 *   — so row 3's product references something that already exists and triggers no auto-creation.
 *   Deliberately NOT "مغزی"/"مسی": rows 4 and 5 register components/materials with exactly those
 *   names later, as their own tracked audit events, and reusing them here would make row 3's
 *   product auto-reuse them too — reversing which row actually first registers them, and colliding
 *   with row 4/5's own attempt to register a "new" component/material under a name that would
 *   already exist by then.
 * - مصطفی performs five of the ten rows (3-7, 10), so her own account has to exist before she can
 *   first log in — but "ثبت کاربر جدید با نام «مصطفی»" is deliberately NOT one of the ten rows
 *   (only نیکروش's own registration, row 1, is), so her account is provisioned here too. This is
 *   what row 1 itself is FOR, symmetrically: `LogInAsPersona('نیکروش')`, performed at row 1's own
 *   frozen instant, is exactly how her account's OWN registration becomes the tracked row 1 event,
 *   attributed to یاشار — see `LogInAsPersona`'s own comment (`screenplay/common/personas.ts`) on
 *   why it internally performs that POST as یاشار regardless of which actor is performing the outer
 *   task. `LogInAsPersona` is idempotent for exactly this reason (see that same module's own
 *   comment on `ProvisionPersonaIfNeeded`): every LATER call for نیکروش or مصطفی in this fixture —
 *   and, in the access-denied rule's own outline, the shared "{actor} وارد سیستم شده باشد" step
 *   reusing either persona again — just re-authenticates rather than re-registering.
 */

const ROW_NUMBER = 'ردیف';
const ACTOR = 'کاربر';
const OCCURRED_AT = 'تاریخ و زمان';
const RECORD_ID_PLACEHOLDER = 'شناسه رکورد';

const NOISE_INSTANT = '2000-01-01T00:00:00.000Z';

export interface TrackedAuditRow {
  actorName: string;
  recordType: AuditRecordType;
  recordId: string;
  action: AuditAction;
}

let rowsByNumber = new Map<number, TrackedAuditRow>();
let realIdByPlaceholder = new Map<string, string>();

/** The row's own tracked {actor, recordType, recordId, action} — everything a `Then` step needs
 * to build an expectation against `screenplay/audit-logging/view-audit-log.ts`'s own assertions. */
export const theAuditRow = (rowNumber: number): TrackedAuditRow => {
  const row = rowsByNumber.get(rowNumber);
  if (!row) {
    throw new Error(
      `Audit log row ${rowNumber} was never registered — expected a preceding "اینکه رویدادهای ` +
        'زیر در سیستم ثبت شده باشند:" step.',
    );
  }
  return row;
};

/** Translates one of the background table's own literal "شناسه رکورد" placeholders (e.g.
 * "66666666-6666-6666-6666-666666666666") into the REAL id the backend actually assigned that
 * row's record — the backend has no way to honour a caller-supplied id, so every later step that
 * filters by "شناسه رکورد" needs this translation before sending the filter on the wire. */
export const theRealRecordIdFor = (placeholder: string): string => {
  const id = realIdByPlaceholder.get(placeholder);
  if (!id) {
    throw new Error(
      `"${placeholder}" is not one of the background's own placeholder record ids.`,
    );
  }
  return id;
};

export const registerAuditLogFixtures = async (
  table: DataTable,
): Promise<void> => {
  rowsByNumber = new Map();
  realIdByPlaceholder = new Map();

  const admin = actorCalled('یاشار');
  await admin.attemptsTo(FreezeTimeAt(NOISE_INSTANT), LogInAsPersona('یاشار'));

  // مصطفی's own account, pre-provisioned (noise — see this module's own comment above).
  await actorCalled('مصطفی').attemptsTo(LogInAsPersona('مصطفی'));

  const throwawayUser = freshUserDetails();
  await admin.attemptsTo(RegisterUserAndRememberIt(throwawayUser));
  const throwawayUserId = theLastRegisteredUser().id;

  const throwawayComponent = freshComponentDetails();
  await admin.attemptsTo(RegisterComponentAndRememberIt(throwawayComponent));
  const throwawayComponentId = theLastRegisteredComponent().id;

  // Named in row 3's own product composition below, so registering that product triggers no
  // auto-creation of its own (see this module's own comment above).
  const throwawayComponentForRow3Product = freshComponentDetails();
  await admin.attemptsTo(
    RegisterComponentAndRememberIt(throwawayComponentForRow3Product),
  );
  const throwawayMaterialForRow3Product = freshMaterialDetails();
  await admin.attemptsTo(
    RegisterMaterialAndRememberIt(throwawayMaterialForRow3Product),
  );

  const mostafa = actorCalled('مصطفی');
  const nikroosh = actorCalled('نیکروش');

  let row3Product: RegisteredProduct | undefined;
  let row6StandardBom: RegisteredStandardBom | undefined;
  let row8Bom: RegisteredBom | undefined;

  for (const row of table.hashes()) {
    const rowNumber = Number(row[ROW_NUMBER]);
    const actorDisplayName = row[ACTOR];
    const instant = parseJalaliDateTime(row[OCCURRED_AT]);
    const placeholder = row[RECORD_ID_PLACEHOLDER];

    let recordId: string;
    let recordType: AuditRecordType;
    let action: AuditAction;

    switch (rowNumber) {
      case 1: {
        // "ثبت کاربر جدید با نام «نیکروش»" — یاشار performs نیکروش's OWN registration explicitly,
        // using her canonical persona identity, so every LATER login for her (row 8, row 9, and
        // any access-denied outline example that names her) finds an already-provisioned account.
        await admin.attemptsTo(FreezeTimeAt(instant), LogInAsPersona('یاشار'));
        await admin.attemptsTo(
          RegisterUserAndRememberIt(personaIdentity('نیکروش')),
        );
        recordId = theLastRegisteredUser().id;
        recordType = 'User';
        action = 'Registered';
        break;
      }
      case 2: {
        await admin.attemptsTo(FreezeTimeAt(instant), LogInAsPersona('یاشار'));
        await admin.attemptsTo(DeleteUser.viaApiUsing(throwawayUserId));
        recordId = throwawayUserId;
        recordType = 'User';
        action = 'Deleted';
        break;
      }
      case 3: {
        await mostafa.attemptsTo(
          FreezeTimeAt(instant),
          LogInAsPersona('مصطفی'),
        );
        await mostafa.attemptsTo(
          RegisterProductAndRememberIt(
            freshProductDetails({
              name: 'کابل شبکه U/UTP 0.42 LEGRAND',
              // Explicit composition naming the pre-registered throwaway component/material above
              // — so this registration triggers no auto-creation of its own (see this module's own
              // comment on why registering row 3's product can't be left to default composition).
              components: [
                {
                  name: throwawayComponentForRow3Product.name,
                  materials: [{ name: throwawayMaterialForRow3Product.name }],
                },
              ],
            }),
          ),
        );
        row3Product = theLastRegisteredProduct();
        recordId = row3Product.id;
        recordType = 'Product';
        action = 'Registered';
        break;
      }
      case 4: {
        await mostafa.attemptsTo(
          FreezeTimeAt(instant),
          LogInAsPersona('مصطفی'),
        );
        await mostafa.attemptsTo(
          RegisterComponentAndRememberIt(
            freshComponentDetails({ name: 'مغزی' }),
          ),
        );
        recordId = theLastRegisteredComponent().id;
        recordType = 'Component';
        action = 'Registered';
        break;
      }
      case 5: {
        await mostafa.attemptsTo(
          FreezeTimeAt(instant),
          LogInAsPersona('مصطفی'),
        );
        await mostafa.attemptsTo(
          RegisterMaterialAndRememberIt(freshMaterialDetails({ name: 'مسی' })),
        );
        recordId = theLastRegisteredMaterial().id;
        recordType = 'Material';
        action = 'Registered';
        break;
      }
      case 6: {
        if (!row3Product) {
          throw new Error(
            'Row 6 needs row 3’s own product to already be registered — the background table is ' +
              'expected to list row 3 before row 6.',
          );
        }
        await mostafa.attemptsTo(
          FreezeTimeAt(instant),
          LogInAsPersona('مصطفی'),
        );
        await mostafa.attemptsTo(
          RegisterStandardBomAndRememberIt(row3Product, {
            miCode: '1001',
            standardLength: '305',
          }),
        );
        row6StandardBom = theLastRegisteredStandardBom();
        recordId = row6StandardBom.id;
        recordType = 'StandardBom';
        action = 'Registered';
        break;
      }
      case 7: {
        if (!row6StandardBom) {
          throw new Error(
            'Row 7 needs row 6’s own standard BOM to already be registered — the background ' +
              'table is expected to list row 6 before row 7.',
          );
        }
        await mostafa.attemptsTo(
          FreezeTimeAt(instant),
          LogInAsPersona('مصطفی'),
        );
        await mostafa.attemptsTo(
          EditStandardBom.viaApiUsing(row6StandardBom.id, {
            standardLength: '310',
          }),
        );
        recordId = row6StandardBom.id;
        recordType = 'StandardBom';
        action = 'Edited';
        break;
      }
      case 8: {
        if (!row6StandardBom) {
          throw new Error(
            'Row 8 needs row 6’s own standard BOM to already be registered — the background ' +
              'table is expected to list row 6 before row 8.',
          );
        }
        await nikroosh.attemptsTo(
          FreezeTimeAt(instant),
          LogInAsPersona('نیکروش'),
        );
        await nikroosh.attemptsTo(
          RegisterBomAndRememberIt(row6StandardBom, {
            orderNumber: 'ORD-2001',
            trackingNumber: 'TRK-3001',
          }),
        );
        row8Bom = theLastRegisteredBom();
        recordId = row8Bom.id;
        recordType = 'Bom';
        action = 'Registered';
        break;
      }
      case 9: {
        if (!row8Bom) {
          throw new Error(
            'Row 9 needs row 8’s own daily BOM to already be registered — the background table ' +
              'is expected to list row 8 before row 9.',
          );
        }
        await nikroosh.attemptsTo(
          FreezeTimeAt(instant),
          LogInAsPersona('نیکروش'),
        );
        await nikroosh.attemptsTo(
          EditBom.viaApiUsing(row8Bom.id, { trackingNumber: 'TRK-3005' }),
        );
        recordId = row8Bom.id;
        recordType = 'Bom';
        action = 'Edited';
        break;
      }
      case 10: {
        await mostafa.attemptsTo(
          FreezeTimeAt(instant),
          LogInAsPersona('مصطفی'),
        );
        await mostafa.attemptsTo(
          DeleteComponent.viaApiUsing(throwawayComponentId),
        );
        recordId = throwawayComponentId;
        recordType = 'Component';
        action = 'Deleted';
        break;
      }
      default:
        throw new Error(
          `viewing-audit-log.feature's own background table has no fixture logic for row ` +
            `${rowNumber}.`,
        );
    }

    rowsByNumber.set(rowNumber, {
      actorName: realNameFor(actorDisplayName),
      recordType,
      recordId,
      action,
    });
    realIdByPlaceholder.set(placeholder, recordId);
  }
};
