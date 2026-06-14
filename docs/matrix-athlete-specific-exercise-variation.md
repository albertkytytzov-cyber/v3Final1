# Matrix Athlete-Specific Exercise Variation

This stage fixes a controlled-pilot quality issue: Matrix could generate the
same first exercise choices for different athletes when competition timing,
phase and selected blocks were similar.

## Finding

The web form already passes athlete profile fields into `ConstructorInput`:

- strengths;
- weaknesses;
- injury or restriction notes;
- pain zones;
- training age;
- coach comment and goals.

Before this stage, `constructor-matrix-exercise-resolver.ts` mostly ranked
exercise candidates by block category priority and exercise id. That made the
output stable, but it also meant two different athletes could receive the same
exercise order even when their strengths and weaknesses differed.

## Resolver Change

The resolver now applies athlete-profile scoring before the final deterministic
tie-break:

- weaknesses, goals and coach context receive the strongest priority;
- strengths receive a smaller support priority;
- pain, injury, youth or low-training-age context can lower candidate priority;
- deterministic athlete/context rotation is used only after safety and profile
  scoring, so the output remains repeatable.

This changes only coach-editable exercise ordering inside Matrix controlled
pilot content. It does not add medical clearance, high-risk automation or
runtime threshold gates.

## Guardrails

- Matrix is still not production default.
- The production draft route remains legacy-backed.
- Exercise prescriptions remain coach-editable.
- Pain and injury context only adds caution/review-required behavior.
- No weight-cut, hydration, RED-S, injury-return, youth or BFR/KAATSU decision
  is automated.
- No fake citations or fake human, medical or coach approvals are added.
- No numeric medical, weight-cut or hydration threshold gates are added.

## Validation

The check `npm run check:constructor-matrix-athlete-specific-exercise-variation`
builds the same D21 controlled-pilot scenario for two synthetic athletes with
different needs:

- speed and leg-entry development;
- grip endurance and par-terre pressure.

The check fails if their selected exercise sequence becomes identical again. It
also verifies that pain/injury caution does not become approval language or an
unsafe weight-cut protocol.
