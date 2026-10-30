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
- **Travel versus rest:** Which tiles may be crossed but never used for resting?
  Should journeys prefer a direction, avoid repeated areas, extend short strolls
  to reach safe rest spots, or reroute when a moving obstacle blocks the next step?
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

## Multi-tile infrastructure tools

- **Selection model:** Exact tile clicks, drag painting, or generated paths between
  endpoints? How do touch selection and camera panning coexist?
- **Connectivity:** Where may a route begin, must each tile extend the previous
  one, and may it branch or reconnect? Which obstacles can be cleared?
- **Visibility:** Should buildings fade, remain outlined, and allow ground-based
  selection behind them? Which props and shadows need the same treatment?
- **Commit boundary:** Can an unconfirmed plan be edited? Is the whole route
  validated atomically, and can committed work be stopped or only demolished later?
- **Saved sequence:** Reuse existing travel/work animations and timings, reserve
  all tiles on confirmation, and verify reload/offline completion without callbacks.
- **Scope and completion:** Roads only or canals too? Exit the tool on confirmation
  or remain in it? What feedback explains busy workers and invalid tiles?

## Building upgrades

- **Existing rules:** Preserve or change unlock level, price, duration, production
  benefit, sequential tiers and simultaneous-upgrade limits?
- **Worker independence:** Does upgrading require the farmer, or can it begin
  during other work? Check both UI restrictions and global API busy guards.
- **Building availability:** Must current production finish first? Can existing
  output be collected during the upgrade, and are capacities or recipes affected?
- **Presentation:** Reuse artwork or introduce a new tier sprite? Where should
  progress, countdown and the completed level appear?
- **Persistence:** Verify upfront payment, retries, offline completion and which
  future jobs receive the benefit; never make completion depend on animation.

## Building production animations

Use alongside the common and animation sections; inspect existing recipes first.

- **Parity and labour:** Which recipe, upgrade-adjusted duration, supply sources,
  worker occupation and offline-completion rules must remain unchanged?
- **Attended versus unattended phases:** Does the worker only prepare the batch,
  or remain throughout production? When is the worker released, what keeps moving
  afterward, and can new commands interrupt a cosmetic preparation sequence?
- **Work cycle:** Continuous work or short motions separated by pauses? Which
  effects run throughout production versus only during worker motions?
- **Composite artwork:** Which building parts stay fixed, which props move, and
  which foreground edges must cover the worker or tool? Is a separate active
  base or opening overlay needed to avoid baked-in props or duplicated actors?
- **Working space:** Must the worker/tool stay within the building footprint,
  or may they occupy the loading tile? Check neighbouring buildings and roads.
- **Output and completion:** Where do finished goods appear, what happens to
  the worker and ambient effects, and is collection included in this slice?
- **Progress feedback:** Reuse building progress, a lower activity container,
  or both? Keep preparation/travel distinct from production progress.

## Autonomous supply and delivery jobs

Use alongside the animation and common questions for hired-worker logistics.

- **Physical inventory:** Are quantities shared with a visual allocation, or saved
  per building? How are legacy goods assigned once, new capacity filled, shared
  spending ordered, and non-empty storage demolition handled? Distinguish a
  combined estate total from actual pickup and delivery locations.

- **Restocking threshold:** Refill only when empty or whenever below a target?
  Are partial supplies useful when estate stock cannot fill the target?
- **Job priority:** How do supply trips compete with finished-goods collection?
  Finish a booked trip first or allow interruption, and where does the worker
  wait or return between jobs?
- **Stock ownership and conflicts:** Which storage supplies the goods, when are
  stock and destination space reserved, and how do manual deliveries avoid
  duplicate transfers or overfilling? May the worker buy missing supplies?
- **Availability:** What happens without a completed destination, a valid road
  route, available stock or an active hire? Reuse saved-job expiry and offline
  catch-up rules where applicable.

## Perennial crops and optional care

- **Cycle boundaries:** Separate first maturation from repeat harvest cycles;
  define whether the next cycle starts at harvest or at delivery completion.
- **Care window:** When is care available, how often per cycle, and does eligibility
  use request acceptance, worker arrival or work completion? Define exact cutoff behaviour.
- **Acceleration:** Change the remaining duration or growth rate without resetting
  earned progress; agree progress-bar behaviour and whether the first maturation qualifies.
- **Existing saves:** Preserve or migrate already-saved deadlines explicitly;
  never silently delay existing crops when changing cycle length.
- **Visual stages:** Choose sapling/empty/flowering/ripe transitions independently
  of economic rules; clarify whether care changes stage timing or only readiness.

## Annual crop decay

- **Eligibility and migration:** Which crops and levels are affected? Preserve existing fields and already-booked planting queues, or migrate them explicitly?
- **Clock and yields:** Measure from ripening or planting; define exact yield thresholds and offline behaviour.
- **Harvest boundary:** Lock yield at selection, arrival/work start, or completion? What happens to fields that expire during a queued journey?
- **Expired fields:** Clear automatically or require labour? Define refunds, replanting eligibility, and how a skipped field affects delivery of goods already harvested.
- **Presentation:** Which withering artwork, yield information and countdowns distinguish each stage?

## Neighbourhood and social maps

- **Membership baseline:** Reuse existing city/group assignment, capacity and saved
  membership. Distinguish revealing a map from assigning or relocating players.
- **Map representation:** Real geography or a symbolic layout? Shared stable plots
  or viewer-centred arrangement? How are empty slots and offline members shown?
- **Live presence:** Are unlock restrictions checked for both viewer and visitor? Define scene/tab departure, reconnects, stale visits, duplicate tabs and whether movement follows actual paths or decorative wandering.
- **Public information:** Which names, portraits, levels and estate details may
  other members see? Keep private inventory and account data out of map responses.
- **Interaction scope:** Overview only, profile popup or farm visits? Identify
  excluded trading, messaging and cooperative actions explicitly.
- **Navigation and assets:** Entry point, unlock level, return flow and relationship
  to city/world maps; reuse building artwork or create a dedicated map illustration?

## Cooperative construction

- **Shared ownership and location:** Which group owns the project, who may contribute,
  and does its fixed footprint preserve member plots and access routes?
- **Stages and contributions:** Define stage requirements, partial contributions,
  resource sources, refunds, and handling of simultaneous final contributions.
- **Start and labour:** Does funding automatically start each stage or require an
  authorized player action? Are personal workers occupied or are builders independent?
- **Participation and rewards:** Can a lone active member finish? Who receives benefits,
  including later arrivals, lower-level members and contributors who leave the group?
- **Persistence:** Define offline stage completion, membership changes, and whether
  completed contributions or stage progress can ever expire or reset.

- **Shared visual delivery queues:** Does a shared transport serve one trip at a
  time? How are repeated donations combined, which timestamp drives all viewers,
  and how do return/reload and local previews avoid replaying or charging goods?

## Adding a feature type

When a real discussion introduces an uncovered type, add a named section with
the information categories needed for that type and its demonstrated edge cases.
Reference common concerns instead of duplicating them. Keep proposed solutions
separate from the questions future discussions need to resolve.
