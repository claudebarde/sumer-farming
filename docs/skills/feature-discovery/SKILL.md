---
name: feature-discovery
description: Gather and confirm requirements for Sumer Farm features when the user asks for feature questions, and before implementing a new animation. Maintain reusable question categories by feature type; do not restart discovery for a narrow tweak to an approved feature.
---

# Feature discovery

Use this process when the user asks to be interviewed about a proposed feature.
For every new animation, consult it before implementation and ask about missing
essential details. A precise change to an approved feature needs only relevant
clarification, not a full interview.

## Workflow

1. Read `PROJECT.md` and applicable project instructions. Inspect relevant existing
   behaviour, assets and `game-rules.md`; verify technical facts rather than asking
   the user to rediscover them.
2. Identify the feature type or types. Read the common questions and relevant
   sections in [question-catalog.md](references/question-catalog.md).
3. Extract already supplied answers. Distinguish confirmed requirements, existing
   behaviour to preserve, proposed defaults and unresolved decisions.
4. Ask concise questions in manageable groups. Start with decisions affecting
   scope, behaviour and assets; follow with edge cases revealed by the answers.
   Explain non-obvious tradeoffs and offer recommendations when helpful.
5. Ask additional questions whenever necessary: the catalogue is not exhaustive.
   Skip irrelevant categories and never silently promote assumptions to confirmed
   requirements. Do not ask the user to repeat information already provided.
6. Summarize agreed behaviour, exclusions, interruption/failure handling and
   concrete acceptance checks. Resolve blocking ambiguity before implementation.
   A request for questions authorizes discovery, not implementation: wait for
   implementation authorization if it has not already been given.

## Maintain the reusable catalogue

During discovery, add new information categories that proved necessary. If the
feature type is missing, create a section based on this discussion's questions
and answers. Merge duplicates and refine existing categories. Do not invent a
large catalogue of unrelated features or speculative requirements.

Record the kinds of information future implementations need, not one feature's
chosen settings as universal defaults. For example, record “inactivity threshold
and reset events”, not “all idle animations begin after 20 seconds”. Questions
are reusable; confirmed feature-specific answers belong in the implementation
and appropriate technical documentation.

Mention material catalogue changes to the user. Update `game-rules.md` when
player-facing behaviour is implemented, keeping planned and playable features
separate. Do not create Todoist tasks or local task backlogs as a side effect of
discovery; follow the project's explicit task-recording instructions.
