# Project Instructions

Before making architectural decisions or implementing features, read `PROJECT.md`.

When adding or changing player-facing game rules, update the root `game-rules.md`
in the same task. Keep it aligned with implemented behaviour, and clearly separate
planned features from playable rules. Use it as the consolidated reference for
player explanations and rule questions; retain technical details in `docs/`.

Track todos in the Todoist project `Sumer Farm Tracker` (project ID
`6hgM5pCFx353hh8f`), not in a repository Markdown checklist.

Create new Todoist tasks only when the user explicitly asks. Do not automatically
create tasks for requested changes or fixes. Continue applying the workflow below
when working on an existing task; if no matching task exists, do the work without
creating one.

When the user asks to check outstanding tasks or what to tackle next, fetch the
project's current tasks from Todoist, including all result pages. Recommend one
actionable task, considering `Fix` tasks at P1–P3 first, then the remaining tasks
by priority (P1 highest, P4 lowest). "Higher priority than 4" means P1–P3.
Consider dependencies and alignment with `PROJECT.md`; ignore template examples
and informational headers. Verify older migrated tasks against the implementation
before recommending them. If Todoist is unavailable, report that limitation rather
than claiming the backlog is empty or recreating a local checklist. If there are
no outstanding actionable tasks, suggest a new task consistent with `PROJECT.md`
and the user's current direction.

Use `Fix` for bugs, `Change` for changes to existing behaviour, and `Future feature`
for features that can wait. Additional labels may be added when useful. Keep task
details in descriptions, preserve existing priorities unless reprioritization is
requested.

Apply workflow labels automatically to tasks we work on in this project:

- Before implementation, find the matching Todoist task (avoid duplicates) and
  add `In progress`, removing `Needs review` if reworking it.
- Once implementation and verification are finished, replace `In progress` with
  `Needs review`. Keep the task open while awaiting the user's testing/approval.
- After the user approves the result, remove the workflow label and mark the
  task complete, preserving completed-task history rather than deleting it.
- Preserve all other labels, priorities, descriptions, and project sections
  when changing status. These two workflow labels are mutually exclusive.
- When reviewing the backlog or suggesting the next task, first flag tasks with
  `Needs review` and any unfinished `In progress` work. Do not recommend already
  implemented tasks as new implementation work.
- If a status update fails or Todoist is unavailable, report it explicitly; do
  not claim the task's status was updated.

`PROJECT.md` is the source of truth for:

- project architecture
- technology choices
- frontend/backend boundaries
- game-domain design
- economy and marketplace direction
- development priorities
- functional programming conventions

In particular, follow the functional TypeScript guidelines in `PROJECT.md`.

The project intentionally uses:

- `effect`
- `ts-pattern`

Prefer functional programming patterns, immutable domain models, discriminated unions, exhaustive pattern matching, typed errors, and explicit effect boundaries when suggesting or implementing code.

Prefer discriminated unions and exhaustive `ts-pattern` matching for domain commands and state variants when this improves clarity.

Do not introduce architectural patterns that conflict with `PROJECT.md` without first explaining the tradeoff.

For Phaser-specific APIs, consult the current official Phaser documentation before assuming API signatures or behavior.

## Effect

The project intentionally uses Effect.

Before writing substantial Effect-based architecture, consult the current
official Effect documentation rather than relying solely on memorized APIs.

Use Effect particularly for:

- typed failures
- services/dependencies
- async workflows
- resource lifetimes
- retries
- configuration

Do not wrap trivial pure domain functions in Effect.

## Framework versions

Use the versions installed in `package.json` as authoritative.

Do not assume Phaser 3 APIs when the project uses Phaser 4, or vice versa.
