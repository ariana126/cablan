import { Role } from '@framework/domain';

/**
 * Whether an edit of a record in use may carry its correction into every
 * related record and snapshot (issue #110) — the `applyToRelatedRecords`
 * an edit route takes. Only the System Admin is granted it; anyone else who
 * asks for it is silently held to issue #94's rule, as if they had not.
 */
export class ApplyToRelatedRecords {
  private constructor(private readonly granted: boolean) {}

  static askedBy(
    actorRole: Role | null,
    applyToRelatedRecords: boolean,
  ): ApplyToRelatedRecords {
    return new ApplyToRelatedRecords(
      applyToRelatedRecords && actorRole === Role.SystemAdmin,
    );
  }

  static notAsked(): ApplyToRelatedRecords {
    return new ApplyToRelatedRecords(false);
  }

  isGranted(): boolean {
    return this.granted;
  }
}
