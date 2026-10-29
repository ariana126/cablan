// The one lock confirming and reverting material imports share: each reads
// the materials (and, for a revert, which import is latest) before writing,
// so two of them interleaving could each pass checks the other invalidates.
// Holding this key for the whole unit of work runs them one at a time.
export const MATERIAL_IMPORT_LOCK = 'products:material-import';
