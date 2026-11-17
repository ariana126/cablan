import { Identity } from '@framework/domain';

export class DeleteQcActivityCommand {
  constructor(public readonly activityId: Identity) {}
}
