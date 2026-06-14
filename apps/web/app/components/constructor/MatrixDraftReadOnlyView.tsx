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

function blockReviewNotes(block: ConstructorDraft["plan"]["weeks"][number]["days"][number]["blocks"][number]) {
  return [
    block.coachEditable ? "редактируется тренером" : "нагрузка зафиксирована",
    block.volumeLocked ? "нагрузка заблокирована" : "",
    block.riskFlags.length ? `риски: ${block.riskFlags.join(", ")}` : "",
    block.evidenceRefs.length ? `evidence: ${block.evidenceRefs.slice(0, 3).join(", ")}` : "",
    block.localLoadZones.length ? `зоны: ${block.localLoadZones.slice(0, 3).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
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
                          <small>{blockReviewNotes(block)}</small>
                          {block.exercises?.length ? (
                            <div className="matrix-coach-exercise-list">
                              {block.exercises.slice(0, 4).map((exercise) => {
                                const details = exerciseDetails(exercise);

                                return (
                                  <small key={`${keyPrefix}-${day.dayLabel}-${session.name}-${exercise.name}`}>
                                    {details ? `${exercise.name} (${details})` : exercise.name}
                                    {exercise.notes ? ` — ${exercise.notes}` : ""}
                                  </small>
                                );
                              })}
                            </div>
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
