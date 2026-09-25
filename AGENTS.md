# Project Instructions

Before making architectural decisions or implementing features, read `PROJECT.md`.

When the user asks what task to tackle next, first read the root `TODOS.md` and
recommend an outstanding task according to its priorities. If there are no
outstanding tasks, suggest a new task consistent with `PROJECT.md` and the user's
current direction.

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
