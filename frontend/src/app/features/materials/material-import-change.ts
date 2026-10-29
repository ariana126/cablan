import {
  AppMaterialImportChange,
  AppMaterialImportRowError,
} from '../../core/materials/material-import-gateway';

/**
 * A change-list row in words, as `importing-materials.feature` writes them: plain ASCII quotes
 * around the server's own values (Latin digits, never re-digitised — names and codes are matched as
 * typed). A row that changes nothing — in error, or missing its name or code — is shown by what the
 * file gave, so the visitor can find it in the spreadsheet.
 */
export function describeImportChange(change: AppMaterialImportChange): string {
  switch (change.kind) {
    case 'register':
      return `ثبت مواد اولیه جدید "${change.name}" با کد "${change.code}"`;
    case 'changeCode':
      return `تغییر کد "${change.name}" از "${change.previousCode}" به "${change.code}"`;
    case 'rename':
      return `تغییر نام کد "${change.code}" از "${change.previousName}" به "${change.name}"`;
    default:
      return asGiven(change);
  }
}

function asGiven({ name, code }: AppMaterialImportChange): string {
  if (name === '') {
    return `کد "${code}"`;
  }
  if (code === '') {
    return `"${name}"`;
  }
  return `"${name}" با کد "${code}"`;
}

const ROW_ERROR_LABELS: Readonly<Record<AppMaterialImportRowError, string>> = {
  'name-required': 'اسم مواد اولیه خالی است',
  'code-required': 'کد مواد اولیه خالی است',
  'duplicate-name-in-file': 'اسم مواد اولیه در اکسل تکراری است',
  'duplicate-code-in-file': 'کد مواد اولیه در اکسل تکراری است',
  'code-taken': 'کد مواد اولیه تکراری است و متعلق به مواد اولیه دیگری است',
  'material-targeted-twice': 'این مواد اولیه در چند ردیف اکسل تغییر کرده است',
};

/** An error a newer API might add still reads as Persian, never as its code. */
const UNKNOWN_ROW_ERROR = 'این ردیف خطا دارد';

/** A row error in Persian. Takes a plain string: a refused confirm's `rows` are not typed by enum. */
export function importRowErrorLabel(error: string): string {
  return ROW_ERROR_LABELS[error as AppMaterialImportRowError] ?? UNKNOWN_ROW_ERROR;
}
