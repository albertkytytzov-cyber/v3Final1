"use client";

import type { ConstructorDraft } from "@training-platform/shared";
import { constructorPreviewSessionsForDay } from "../../lib/constructor-matrix-ui";

type MatrixDraftReadOnlyViewProps = {
  draft: ConstructorDraft;
  phaseLabel: (phase: ConstructorDraft["plan"]["weeks"][number]["phase"]) => string;
  keyPrefix?: string;
  className?: string;
};

function exerciseDetails(exercise: NonNullable<ConstructorDraft["plan"]["weeks"][number]["days"][number]["blocks"][number]["exercises"]>[number]) {
  return [
    exercise.targetSets ? `${exercise.targetSets} сер.` : "",
    exercise.targetReps ? `${exercise.targetReps} повт.` : "",
    exercise.targetDurationMinutes ? `${exercise.targetDurationMinutes} мин` : "",
    exercise.targetRpe ? `RPE ${exercise.targetRpe}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

export function MatrixDraftReadOnlyView({
  draft,
  phaseLabel,
  keyPrefix = "constructor-draft",
  className = "constructor-week-list",
}: MatrixDraftReadOnlyViewProps) {
  return (
    <div className={className}>
      {draft.plan.weeks.map((week) => (
        <article className="constructor-week-card" key={`${keyPrefix}-${week.weekNumber}-${week.title}`}>
          <div className="summary-topline">
            <strong>{week.title}</strong>
            <span>{phaseLabel(week.phase)}</span>
          </div>
          <p>{week.mainIntent}</p>
          <div className="constructor-day-list">
            {week.days.map((day) => (
              <div
                className="constructor-day-row"
                key={`${keyPrefix}-${week.weekNumber}-${day.dayLabel}-${day.dayIntent}`}
              >
                <div>
                  <strong>{day.dayLabel}</strong>
                  <span>{day.dayIntent}</span>
                </div>
                <small>{day.readinessGate}</small>
                {constructorPreviewSessionsForDay(day).map((session) => (
                  <div
                    className="constructor-session-preview"
                    key={`${keyPrefix}-${day.dayLabel}-${session.name}`}
                  >
                    <div className="summary-topline">
                      <strong>{session.name}</strong>
                      <span>{session.notes}</span>
                    </div>
                    <ul>
                      {session.blocks.map((block, blockIndex) => (
                        <li key={`${keyPrefix}-${day.dayLabel}-${session.name}-${block.name}-${blockIndex}`}>
                          <span>{block.name}</span>
                          <strong>{block.volume}</strong>
                          {block.exercises?.length ? (
                            <small>
                              {block.exercises
                                .slice(0, 3)
                                .map((exercise) => {
                                  const details = exerciseDetails(exercise);

                                  return details ? `${exercise.name} (${details})` : exercise.name;
                                })
                                .join("; ")}
                            </small>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
