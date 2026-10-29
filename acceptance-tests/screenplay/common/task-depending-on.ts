import {
  Activity,
  Answerable,
  AnswersQuestions,
  PerformsActivities,
  Task,
  UsesAbilities,
} from '@serenity-js/core';

class TaskDependingOn<T> extends Task {
  constructor(
    description: Answerable<string>,
    private readonly answer: Answerable<T>,
    private readonly activitiesFor: (value: T) => Activity[],
  ) {
    super(description);
  }

  async performAs(
    actor: PerformsActivities & UsesAbilities & AnswersQuestions,
  ): Promise<void> {
    const value = await actor.answer(this.answer);
    await actor.attemptsTo(...this.activitiesFor(value));
  }
}

/**
 * A task whose activities depend on something the actor has to find out first — the id of the
 * latest audit event, the code a renamed material has now. `Task.where` builds its activity list
 * eagerly, before anything is known; this answers `answer` when the task is performed and only then
 * builds the activities from it. The same escape hatch `sequentially-dependent-task.ts` is, for a
 * value rather than a preceding task.
 */
export const taskDependingOn = <T>(
  description: string,
  answer: Answerable<T>,
  activitiesFor: (value: T) => Activity[],
): Task => new TaskDependingOn(description, answer, activitiesFor);
