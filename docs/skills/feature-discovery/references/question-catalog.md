# Feature question catalogue

These are information categories to resolve, not a script to recite. Reuse known
answers, ask relevant unanswered questions, and extend the catalogue as actual
feature discussions reveal new needs.

## Common to new features

- **Purpose and desired effect:** What should the player experience, understand
  or be able to do? What would make the feature successful?
- **Scope:** Which scenes, levels, entities and existing behaviours are involved?
  What is explicitly excluded from this version?
- **Entry conditions:** What triggers it? What prerequisites or restrictions
  apply? What happens if they are not met?
- **Flow and outcomes:** What happens in order, how does it finish, and which
  state or resources change? Is it cosmetic or gameplay-affecting?
- **Interruption and conflicts:** Can it be cancelled or repeated? What wins when
  another action starts, an entity disappears or state changes mid-process?
- **Presentation and interaction:** What is visible/clickable, what minimal
  feedback is needed, and which existing UI or artwork should be reused?
- **Lifetime:** What survives scene changes, hiding the tab, reloads and returning
  later? For gameplay changes, identify server-authoritative state.
- **Acceptance:** Which normal and boundary scenarios should be tested? Which
  results require the player's visual approval?

## Animation

- **Trigger:** Manual action, gameplay event, inactivity, proximity or random
  occurrence? For inactivity, what threshold applies and what resets the timer?
- **Eligibility:** Which actor state, location/radius, level or other conditions
  permit it? How is distance measured, and from which point or footprint?
- **Targets and participants:** Which actors, props and scenery participate?
  Should companions or nearby actors react or move out of the way?
- **Desired effect:** Mood, energy, subtlety, readability and visual references.
- **Sequence:** Approach, preparation, action, transitions, completion and return
  to idle. Which stages need new frames versus existing movement or effects?
- **Timing:** Delay, duration, frame rate, travel speed, pauses, repetitions and
  cooldown. Which may vary? Distinguish faster frame motion from faster travel
  or shorter time spent at each location.
- **Placement and movement:** Start/end locations, nearest-target selection,
  routes, allowed tiles, anchors, facing, scale and footprint limits. What happens
  if the route or destination is unavailable?
- **Layering and visibility:** What goes in front of what? May anything obscure
  the effect? Should it remain clickable, ignore input or show an occlusion marker?
- **Randomness and concurrency:** Variants, minimum/maximum simultaneous instances,
  spacing and spawn/despawn rules. When may the appearance change?
- **Cancellation:** Which mouse, touch, keyboard or gameplay events stop it?
  Immediately or after the current motion? Where and in which pose does each
  participant remain? When may it start again?
- **Lifecycle and accessibility:** Hidden tabs, focus loss, scene transitions,
  reloads, reduced motion, zoom and mobile behaviour. Avoid replaying long
  cosmetic catch-up sequences when the player returns.
- **Gameplay boundary:** Does this visualize a saved job or remain purely
  decorative? Cosmetic completion must not gate economic production or rewards.
- **Assets:** References, poses, shared canvas/foot registration, transparent
  gaps, held props, audio and particles. Can existing assets produce the result?
- **Visual checks:** Loop continuity, entry/exit transitions, speed, scale/anchor
  consistency, obstructions, interruption and repeated activation.

### Autonomous wandering and companion animations

Use alongside the animation questions when an actor chooses its own destinations.

- **Idle ownership:** Does “idle” mean no player input, an idle main character,
  an idle companion, or a combination? Can wandering run during productive work?
- **Roaming anchor:** Is the allowed area relative to the current main-character
  position, the position when wandering started, a building, or the whole map?
  Should the actor stay in the visible viewport?
- **Behaviour priority:** How does wandering interact with following, scripted
  activities and reserved work areas? Which behaviour wins when they overlap?
- **Return policy:** After cancellation or completion, stay at the current spot,
  finish the current step, or navigate back to the main character/home? What if
  that destination has moved or cannot be reached?

## Building construction

Use the common and animation sections alongside these construction-specific checks.

- **Existing baseline:** Which approved building flow should be reused? Inspect
  unlock level, footprint, costs, duration, ownership limits and material sources;
  preserve existing rules unless the user requests a change.
- **Placement and access:** Road connection, loading space, occupied tiles,
  neighbouring-building access, orientation, preview and confirmation behaviour.
- **Work presentation:** Reuse or replace approach, working pose, work position,
  construction sprite treatment and progress indicator? Check footprint fit and
  visibility beside neighbouring buildings.
- **Commit and interruption:** When are materials spent and tiles reserved? Reuse
  authoritative timers, duplicate guards and reload behaviour; distinguish
  cancelling a placement preview from cancelling committed construction.
- **Completion scope:** Does this slice end with a completed idle building, or
  also include production controls, upgrades, demolition and output handling?
  Resolve what the completed-building popup should expose during staged migration.

## Adding a feature type

When a real discussion introduces an uncovered type, add a named section with
the information categories needed for that type and its demonstrated edge cases.
Reference common concerns instead of duplicating them. Keep proposed solutions
separate from the questions future discussions need to resolve.
