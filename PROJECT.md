# Sumer Game — Project Architecture & Development Guide

## 1. Project Vision

This project is a browser-first economic simulation game set in Ancient Sumer.

The original inspiration is a FarmVille-like game, but the intended game is broader than a farming simulator. Farming is one possible economic path within a larger simulation centered on production, processing, trade, marketplaces, occupations, household growth, and long-term prosperity.

A useful high-level description is:

> A cozy economic strategy game about growing a household from modest beginnings into one of the most prosperous estates or businesses in ancient Mesopotamia.

The marketplace and economy are intended to be central gameplay systems, not secondary interfaces for selling excess production.

The game should ultimately support multiple economic identities such as:

- farmer
- brewer
- merchant

Additional occupations may be added later, such as:

- potter
- weaver
- herder
- fisherman
- baker
- boatman
- builder
- scribe

Starting occupation is not intended to be a permanent RPG class. It represents the household's starting economic path. Players should eventually be able to diversify into other trades.

---

## 2. Product and Distribution Strategy

### Browser first

The canonical first version of the game is a browser application.

The browser version should:

- load from a normal URL
- work well on desktop and mobile browsers
- require as little friction as possible before the user can play
- eventually support installation as a PWA
- be designed from the beginning with touch/mobile interaction in mind

### Future native distribution

The architecture should preserve a low-friction path to:

- Apple App Store
- Google Play Store

The intended approach is to package the same React + Phaser application using Capacitor later.

Therefore:

- avoid unnecessary browser-only assumptions in core game code
- design interaction around tap, drag, pinch, and long press rather than mouse-only behavior
- keep platform-specific functionality behind interfaces
- keep the game world resolution-independent
- make the React UI responsive from the beginning

Potential platform-specific services include:

- payments
- notifications
- haptics
- storage
- authentication
- sharing

These should eventually be accessed through explicit platform abstractions rather than being called directly throughout the application.

---

## 3. Chosen Technology Stack

### Language

- TypeScript

TypeScript is the primary language across the entire project.

### Front end

- React
- Phaser
- Vite
- Sass / SCSS

Responsibilities:

**React owns application UI**, including:

- HUD
- inventory
- marketplace interfaces
- dialogs
- quests
- account/profile UI
- menus
- settings
- resource displays

**Phaser owns the game world**, including:

- world rendering
- map
- farm tiles
- canals
- crops
- buildings
- characters
- animations
- camera
- world interaction

React should not be used to render the game map itself.

Phaser should not become the primary framework for complex application UI.

### Back end

- Hono
- Cloudflare Workers

The backend and frontend belong to the same project and should be developed and deployed together.

The browser should see a single origin:

- `/` and `/assets/*` → React / Phaser frontend
- `/api/*` → Hono backend

Prefer relative API requests such as:

```ts
fetch("/api/game/action")
```

Avoid separate frontend/backend origins unless there is a concrete future reason to introduce them.

### Cloudflare development/runtime

- `@cloudflare/vite-plugin`
- Wrangler
- Cloudflare Workers runtime

Development should normally use one Vite process.

Do **not** introduce `concurrently` merely to run a separate frontend and backend development server.

The intended development flow is:

```bash
npm run dev
```

with Vite handling the React frontend and Cloudflare Worker/Hono backend together.

### Database

Planned production persistence:

- PostgreSQL
- Drizzle ORM
- Cloudflare Hyperdrive when connecting Workers to Postgres

The exact managed PostgreSQL provider can be selected later.

Potential providers include Neon or another managed Postgres service.

### Validation

- Zod

Shared API and command schemas should be defined with Zod where appropriate.

### Testing

- Vitest

The pure game-domain packages should be heavily unit tested.

---

## 4. Functional Programming Direction

Functional programming is an explicit architectural preference for this project.

The project already includes:

- `effect`
- `ts-pattern`

Codex should take this into account whenever it suggests:

- types
- domain models
- functions
- error handling
- services
- dependency injection
- asynchronous workflows
- API boundaries
- game simulation logic

### General FP principles

Prefer:

- pure functions
- immutable data
- explicit data transformations
- discriminated unions
- exhaustive pattern matching
- composition
- explicit dependency boundaries
- typed errors
- referentially transparent domain logic when practical

Avoid unnecessary:

- mutable singleton state
- inheritance-heavy domain models
- large stateful classes
- service locator patterns
- implicit side effects
- throwing exceptions as normal domain control flow
- boolean-heavy APIs when a richer union type communicates intent better

### `ts-pattern`

Use `ts-pattern` when exhaustive matching improves clarity.

Example:

```ts
type GameCommand =
  | PlantCropCommand
  | HarvestCropCommand
  | SellGoodsCommand
  | BuyGoodsCommand

const result = match(command)
  .with({ type: "plant_crop" }, handlePlantCrop)
  .with({ type: "harvest_crop" }, handleHarvestCrop)
  .with({ type: "sell_goods" }, handleSellGoods)
  .with({ type: "buy_goods" }, handleBuyGoods)
  .exhaustive()
```

Prefer discriminated unions and exhaustive matching over sprawling `if`/`else` chains or class hierarchies.

### Effect

Use `effect` where it provides meaningful value, particularly for:

- typed failures
- dependency management
- repository/service abstractions
- asynchronous workflows
- retries
- structured concurrency
- configuration
- resource acquisition/release
- observability
- composition of backend workflows

For example, backend orchestration may eventually have a shape conceptually similar to:

```ts
const executeGameCommand = (command: GameCommand) =>
  Effect.gen(function* () {
    const farmRepository = yield* FarmRepository
    const clock = yield* GameClock

    const farm = yield* farmRepository.load(command.farmId)
    const now = yield* clock.now

    const nextFarm = yield* applyGameCommand(farm, command, now)

    yield* farmRepository.save(nextFarm)

    return nextFarm
  })
```

Do not use Effect mechanically for every tiny pure function.

A function such as:

```ts
calculateBarleyYield(...)
```

should remain a normal pure function if Effect adds no value.

The goal is functional architecture and explicit effects, not framework ceremony.

### Domain errors

Prefer typed errors, for example:

```ts
type HarvestError =
  | { _tag: "CropNotFound"; tileId: TileId }
  | { _tag: "CropNotReady"; tileId: TileId; readyAt: number }
  | { _tag: "InventoryFull" }
```

rather than generic:

```ts
throw new Error("Cannot harvest")
```

At application boundaries, these typed domain errors can be mapped to HTTP responses or UI states.

---

## 5. Repository Structure

The project should remain a single repository.

A recommended structure is:

```text
sumer-game/
├── package.json
├── vite.config.ts
├── wrangler.jsonc
├── tsconfig.json
├── .env.example
│
├── src/
│   ├── client/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   │
│   │   ├── game/
│   │   │   ├── phaser/
│   │   │   │   ├── config.ts
│   │   │   │   ├── game.ts
│   │   │   │   └── scenes/
│   │   │   │       ├── BootScene.ts
│   │   │   │       └── FarmScene.ts
│   │   │   │
│   │   │   ├── rendering/
│   │   │   ├── input/
│   │   │   └── bridge/
│   │   │
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── farm/
│   │   │   ├── market/
│   │   │   ├── inventory/
│   │   │   └── account/
│   │   │
│   │   ├── api/
│   │   └── styles/
│   │
│   └── server/
│       ├── index.ts
│       ├── routes/
│       ├── services/
│       ├── repositories/
│       ├── db/
│       ├── middleware/
│       └── env.ts
│
├── packages/
│   ├── game-core/
│   │   └── src/
│   │       ├── index.ts
│   │       ├── state.ts
│   │       ├── commands.ts
│   │       ├── crops.ts
│   │       ├── production.ts
│   │       ├── economy.ts
│   │       ├── market.ts
│   │       ├── occupations.ts
│   │       └── simulation.ts
│   │
│   ├── game-data/
│   │   └── src/
│   │       ├── crops.ts
│   │       ├── goods.ts
│   │       ├── recipes.ts
│   │       ├── buildings.ts
│   │       └── occupations.ts
│   │
│   ├── schemas/
│   │   └── src/
│   │       ├── commands.ts
│   │       ├── api.ts
│   │       └── entities.ts
│   │
│   └── platform/
│       └── src/
│           ├── index.ts
│           ├── storage.ts
│           ├── payments.ts
│           └── notifications.ts
│
└── tests/
    ├── game-core/
    └── integration/
```

This structure is a target, not a requirement to create empty folders immediately.

Prefer adding folders when they contain real code.

---

## 6. `game-core` Is the Most Important Boundary

`packages/game-core` should contain the rules of the game as framework-independent TypeScript.

It should know nothing about:

- React
- Phaser
- Hono
- Cloudflare Workers
- HTTP
- DOM
- Postgres
- Drizzle

It should consist primarily of:

- immutable domain values
- discriminated unions
- pure transformations
- explicit results/errors
- deterministic simulation logic

Example responsibilities:

```text
plantCrop
harvestCrop
buyGood
sellGood
startProduction
completeProduction
acceptContract
fulfillContract
calculatePrice
calculateYield
applyGameCommand
simulateElapsedTime
```

The backend imports `game-core`.

The frontend may import safe/shared pieces of `game-core` for prediction, UI, and display logic, but server validation remains authoritative for persistent economy/progression.

Keeping this boundary clean is a high-priority architectural rule.

---

## 7. `game-data`

Game configuration should generally be separated from rules.

Examples include:

- crop definitions
- good definitions
- recipes
- building definitions
- occupation starting configurations
- balance constants

Example:

```ts
export const crops = {
  barley: {
    growTimeMs: 5 * 60 * 1000,
    seedCost: 1,
    yieldMin: 3,
    yieldMax: 5,
  },

  flax: {
    growTimeMs: 15 * 60 * 1000,
    seedCost: 2,
    yieldMin: 2,
    yieldMax: 4,
  },
} as const
```

The purpose is to make balance changes easy and avoid spreading numerical constants throughout game logic.

---

## 8. Command-Oriented API

Prefer commands over a generic CRUD API for game actions.

Good:

```http
POST /api/game/action
```

Example body:

```json
{
  "type": "plant_crop",
  "tileId": "12:8",
  "cropType": "barley"
}
```

Other commands might include:

```text
harvest_crop
buy_good
sell_good
build_canal
build_structure
start_production
accept_contract
fulfill_contract
expand_property
```

The browser sends **player intentions**.

The browser should never authoritatively send state changes such as:

> set my silver to 500

Instead it sends:

> sell 20 barley at market X

The server validates the command and computes the resulting state.

Discriminated unions plus `ts-pattern` are a preferred way to model and dispatch commands.

---

## 9. Backend Request Flow

The intended request flow is:

```text
Player action
    ↓
React or Phaser
    ↓
POST /api/game/action
    ↓
Hono route
    ↓
application/service workflow
    ↓
load required state
    ↓
game-core
    ↓
validate + calculate next state
    ↓
Postgres transaction
    ↓
return updated snapshot/result
    ↓
React + Phaser update presentation
```

Hono route handlers should remain thin.

They should focus on:

- parsing
- authentication
- validation
- invoking application workflows
- mapping typed results/errors to HTTP

Game rules should not accumulate in route handlers.

---

## 10. Persistence Strategy

PostgreSQL is the planned source of truth.

For the MVP, it is acceptable to start with a relatively coarse farm/household state representation, potentially using JSONB, instead of prematurely normalizing every entity.

For example:

```text
users
-----
id
email
created_at

households
----------
id
user_id
state jsonb
version integer
created_at
updated_at
```

Normalization can be introduced when there is a concrete need for:

- querying
- analytics
- performance
- integrity
- cross-player systems

Do not create dozens of relational tables solely because they may be useful one day.

---

## 11. Server Authority

Persistent economy and progression are server-authoritative.

The server owns:

- current time
- inventory changes
- currency changes
- market transactions
- contract completion
- production completion
- progression
- authoritative crop readiness

Never trust a client-supplied current time for economic actions.

For timed systems, prefer timestamps.

Example:

```ts
type PlantedCrop = {
  cropType: CropType
  plantedAt: number
  harvestAt: number
}
```

To determine readiness:

```ts
const ready = now >= crop.harvestAt
```

The server should not continuously tick every crop.

---

## 12. Lazy Simulation

Do not build an always-running simulation process for every player's household.

Prefer lazy/time-based simulation.

Example:

```text
crop planted at 10:00
harvestAt = 10:30

player returns at 14:00

server compares:
14:00 >= 10:30

crop is ready
```

This principle should also guide:

- workshop production
- contracts
- merchant journeys
- building construction
- similar asynchronous systems

Background queues should be introduced only when a real use case requires them.

Potential later uses:

- notifications
- daily events
- analytics aggregation
- leaderboard updates
- scheduled live events

Do not add Redis, Kafka, RabbitMQ, or a job system to the MVP without a demonstrated need.

---

## 13. Concurrency and Transactions

Economic actions must be transactional.

For example, buying a building should atomically:

1. validate the household has enough resources
2. deduct resources
3. place/add the building
4. record relevant transaction data
5. commit

Avoid multi-request sequences where one request spends money and another separately grants the item.

Use optimistic concurrency/versioning on mutable household/farm state when appropriate.

Example:

```text
household.version = 42
```

Client command can include the version it observed.

The server updates only if the current version still matches.

This helps prevent duplication or stale writes caused by:

- multiple tabs
- multiple devices
- retries
- race conditions

---

## 14. Core Game Direction

The game is not intended to be:

```text
login
→ harvest
→ replant
→ leave
```

The desired loop is closer to:

```text
return to household
→ inspect completed production
→ harvest / collect goods
→ inspect market conditions
→ inspect contracts and buyers
→ decide what to consume, store, process, or sell
→ acquire needed inputs
→ invest in productive capacity
→ plan future production
→ leave with an economic goal in progress
```

The player should leave thinking something like:

> When I return, the beer will be ready and I can fulfill the tavern contract.

rather than simply:

> My timers will be done.

---

## 15. Marketplace Is a Core System

The marketplace should not be a fixed-price vending machine.

Avoid a simplistic model such as:

```text
Barley → always sell for 2 coins
Beer → always sell for 5 coins
```

The marketplace should eventually include:

- changing supply and demand
- different buyers
- contracts
- events
- imported goods
- local scarcity
- storage decisions
- processing opportunities
- reputation
- potentially multiple markets/locations

Important buyer categories may include:

- households
- taverns
- craftspeople
- temples
- palace/government institutions
- traveling merchants/caravans

Market movement should be understandable rather than pure random noise.

For example:

```text
BARLEY +18%

Temple preparations for the New Year festival
have increased local demand.
```

---

## 16. Goods Should Have Competing Uses

Goods should often have several meaningful destinations.

Example:

```text
Barley
├── household food
├── seed
├── immediate sale
├── storage
├── brewing
└── livestock feed
```

This creates economic decisions.

Processing should create production chains.

Examples:

```text
barley → beer

wool → yarn → cloth → garments

flax → linen

clay → bricks / jars / tablets

reeds → baskets / mats / boats
```

Do not implement all of these immediately.

The important design principle is that downstream uses make goods interesting.

---

## 17. Buying Is as Important as Selling

The economy should be circular.

Players should need inputs to expand.

Potential inputs include:

- seeds
- tools
- timber
- reeds
- bricks
- animals
- labor
- land
- storage
- boats
- imported materials

Historically scarce/imported materials such as timber, copper, and stone are especially useful game-design resources because they force participation in trade.

---

## 18. Starting Occupations

Initial target occupations:

- Farmer
- Brewer
- Merchant

They do not need symmetrical starting conditions.

They can begin with different forms of capital.

### Farmer

Possible starting assets:

- small leased plot
- barley seed
- simple tools
- irrigation access

Early loop:

```text
irrigate
→ plant
→ harvest
→ decide between consumption / seed / market
→ expand
```

### Brewer

Possible starting assets:

- household brewing vessels
- initial barley
- small storage area
- basic recipe knowledge

Early loop:

```text
buy/source barley
→ brew
→ choose buyer
→ fulfill contract
→ reinvest in capacity
```

### Merchant

Possible starting assets:

- modest silver
- pack animal
- small stock of goods
- market access

Early loop:

```text
inspect prices
→ buy
→ transport
→ sell
→ accept delivery opportunity
→ grow working capital
```

Starting occupation should be presented as a starting path, not a permanent class.

Players should eventually diversify.

Avoid hardcoding identity as:

```ts
player.profession = "brewer"
```

Long-term identity may instead emerge from:

- skills
- reputation
- owned productive assets
- actual economic behavior

---

## 19. Development Philosophy

Build a vertical slice before building a content catalog.

Do not begin by defining:

- dozens of crops
- dozens of professions
- hundreds of items
- large inheritance hierarchies
- extensive character simulations
- a complete Sumerian economy

The first useful vertical slice should be deliberately small.

Suggested first loop:

```text
one small map
one farmer
one crop: barley
one canal
one buyer
one market transaction
one useful upgrade
```

Playable flow:

```text
irrigate
→ plant barley
→ wait briefly / accelerate time
→ harvest
→ sell at market
→ buy an upgrade
→ return to farm
```

If this is not satisfying, more content will not solve the underlying problem.

---

## 20. Suggested Development Milestones

### Milestone 1 — world interaction

- Phaser boots
- map renders
- camera works
- tile selection works
- placeholder graphics are acceptable

### Milestone 2 — barley loop

- plant
- grow
- harvest
- inventory

### Milestone 3 — basic market

- market React UI
- sell barley
- buy seeds/tools
- silver

At this point there should be a minimal actual game.

### Milestone 4 — meaningful economy

- variable price
- one NPC contract
- storage decision

Test whether saving goods versus immediate sale is interesting.

### Milestone 5 — processing

Introduce one recipe:

```text
barley → beer
```

Add:

- placeholder brewery
- production time
- tavern/buyer
- processed good economics

### Milestone 6 — merchant gameplay

Introduce:

- second market or trading destination
- different price conditions
- transport cost/time
- arbitrage/trade opportunity

Only after this milestone should the farmer/brewer/merchant starting paths be formalized.

### Milestone 7 — backend persistence

Add:

- Hono API
- Cloudflare Worker runtime
- Postgres
- anonymous account
- server authority
- save/load

### Milestone 8 — cohesive art/audio

Begin scaling production-quality assets only after visual and technical conventions are stable.

### Milestone 9 — onboarding

Build the occupation selection/onboarding experience only once those loops actually exist.

---

## 21. Art Strategy

Do not create a large sprite library before gameplay stabilizes.

Use three art stages.

### Stage 1 — programmer art

Use:

- rectangles
- simple icons
- temporary assets

The goal is interaction, not appearance.

### Stage 2 — visual style prototype

Create only enough polished assets to establish:

- perspective
- camera
- tile dimensions
- sprite dimensions
- palette
- animation style
- visual density

Representative assets might include:

- one character
- barley crop stages
- one building
- dirt tile
- water/canal tile
- one market stall

### Stage 3 — production assets

Only after conventions are stable should a larger asset pipeline begin.

Avoid creating dozens of assets that later need to be redone because tile size, perspective, or art direction changed.

---

## 22. Character Simulation

Do not build a deep character simulation until characters have gameplay responsibilities that justify it.

Decorative workers can initially be presentation only.

For example:

```text
game action succeeds
→ Phaser animates a worker walking to the field
```

The economic simulation should not need to wait for the visual worker to finish walking.

**Golden rule — production never waits for animations.** Submit and persist the
production intention immediately on player confirmation, validating and reserving
ingredients atomically. The server schedules any preparation/travel allowance,
production start and completion. Animation callbacks must never be required to
start production or advance its economic phases. A hidden tab, closed browser,
reload or slow frame rate cannot delay a saved job. On return, reconcile elapsed
server time instead of replaying preparation as a prerequisite. Test both absence
during preparation and absence spanning completion, including duplicate requests.

Avoid prematurely modeling:

- hunger
- morale
- family
- relationships
- religion
- health
- detailed schedules
- personality traits

unless those systems become actual gameplay.

---

## 23. Debug Tools

Build developer/debug controls early.

Useful controls include:

```text
+100 silver
+100 barley
set time speed: 1x / 10x / 100x
mature all crops
spike barley price
crash barley price
complete production
reset household
```

Simulation/economy games are much easier to develop when time and resources can be manipulated quickly.

---

## 24. Testing Priorities

Unit-test economic and domain rules heavily.

High-priority areas:

- money
- inventory
- crop growth
- yield
- market transactions
- production recipes
- contracts
- storage
- version/concurrency behavior
- illegal state transitions

Because `game-core` is intended to be pure TypeScript, most of these tests should not require:

- browser
- React
- Phaser
- network
- database

Use deterministic inputs, including an explicit `now`, rather than reading global time inside pure domain functions.

---

## 25. Authentication

For the eventual public game, avoid forcing registration before first play if possible.

Preferred conceptual flow:

```text
visitor opens game
→ anonymous household created
→ player starts immediately
→ player can later claim/save account
```

Potential later account methods:

- email magic link
- Google
- Apple

The goal is minimal onboarding friction.

---

## 26. PWA and Mobile Design

The browser version should eventually support PWA installation.

From early development:

- test desktop and mobile widths
- use responsive React layouts
- avoid hover-only controls
- keep buttons/touch targets usable on phones
- design Phaser camera/viewport logic for varying screen dimensions
- do not assume fixed 1280×720 gameplay

The future Capacitor app should reuse the same frontend and core game logic.

---

## 27. Platform Abstraction

Eventually introduce a `platform` package/interface layer for capabilities that differ between web and native.

Conceptually:

```ts
interface PlatformServices {
  storage: StorageService
  notifications: NotificationService
  payments: PaymentService
  haptics: HapticsService
}
```

Possible implementations:

```text
WebPlatformServices
CapacitorPlatformServices
```

Do not spread platform detection throughout domain code.

---

## 28. Sass

Sass is supported through Vite.

The project uses or may use:

```bash
npm install -D sass
```

Recommended styling split:

### Global SCSS

Use for:

- reset/base styles
- typography
- design tokens
- common layout
- shared utility rules

### SCSS modules

Use for component-scoped React styles such as:

- marketplace panels
- inventory UI
- HUD
- dialogs

Prefer CSS custom properties for values that may change dynamically at runtime, while Sass variables can organize compile-time design values.

---

## 29. Things Not to Build in the First MVP

Avoid:

- combat
- PvP
- guilds
- player-to-player trading
- giant world maps
- procedural world generation
- multiplayer world simulation
- detailed NPC family simulation
- deep religion simulation
- factions/politics
- dynasties
- detailed weather simulation
- elaborate crafting trees
- premium currency systems
- native mobile app packaging
- Steam packaging
- large localization infrastructure

These may become appropriate later.

They should not delay proving the core economic experience.

---

## 30. Architectural Rules for Codex

When suggesting or generating code, Codex should follow these priorities:

1. Favor functional programming patterns.
2. Prefer immutable data and pure transformations in domain logic.
3. Use discriminated unions for domain variants and commands.
4. Use `ts-pattern` for clear exhaustive pattern matching when useful.
5. Use `effect` intentionally for typed effects, services, errors, resources, and async workflows.
6. Do not force Effect into trivial pure calculations.
7. Prefer composition over inheritance.
8. Keep `game-core` independent from frameworks and infrastructure.
9. Keep Hono route handlers thin.
10. Keep React responsible for application UI and Phaser responsible for the world.
11. Treat the server as authoritative for persistent economy/progression.
12. Model player actions as commands rather than client-authored state mutation.
13. Prefer timestamps/lazy simulation over continuous ticking.
14. Use transactions for economic mutations.
15. Avoid premature abstraction and speculative systems.
16. Build the smallest playable vertical slice before broad content.
17. Use placeholder art until gameplay and asset conventions stabilize.
18. Avoid introducing infrastructure such as Redis, queues, WebSockets, or microservices until a concrete requirement exists.
19. Keep future Capacitor/mobile portability in mind.
20. When multiple designs are viable, prefer the simpler design that preserves these boundaries.

---

## 31. Current Immediate Target

The immediate development goal should be a small local vertical slice, not the entire game.

Suggested target:

```text
React + Phaser boots
→ one small farm map
→ irrigation/canal interaction
→ one crop: barley
→ planting and harvesting
→ inventory
→ React marketplace panel
→ one buyer
→ sell barley
→ receive silver
→ buy one useful upgrade
```

Use placeholder graphics.

Persistence can initially be local.

The backend/database should be introduced once this loop demonstrates that it is worth preserving.

---

## 32. Guiding Product Principle

The long-term differentiator is not the number of crops or buildings.

It is the quality of the economic decisions.

The economy should repeatedly create choices such as:

- consume or sell?
- sell now or store?
- sell raw material or process it?
- fulfill a contract or use the goods elsewhere?
- produce what is easy or what the market currently needs?
- spend capital on inventory or productive capacity?
- specialize or vertically integrate?

Farming provides raw production.

Processing creates added value.

Commerce connects the economy.

The marketplace should be one of the primary engines of player decision-making and long-term engagement.

## 33. Popup layout convention

Contextual action popups show only actions available now for the clicked tile/item.
Omit unavailable buttons instead of disabling them, and omit their blocker text.
Apply this rule to all new and revised popups. Keep server validation and in-flight
duplicate-submission guards. This supersedes older disabled-action conventions
for popups. Existing non-isometric popup migrations can follow when those views
are revised; this change does not remove any underlying gameplay restrictions.
Tile/item popups should have a visible arrow pointing to their selected target.
Keep the arrow outside any scrolling/clipping content container.
Explicit exception: when the farmer carries barley and both granary and farm
storage are full, retain a disabled `No storage available` button in his popup.
Another explicit exception: a completed mill without enough stored barley shows
one disabled `You don't have enough barley` button instead of its recipe actions.

Always place all informational text, resource counts, status messages, and alerts
above the action buttons. Action buttons must be the last elements at the bottom
of a popup; never render explanatory text after them. Reorder actions only within
this bottom action section (for example, prioritize delivering carried water).

Item/action popups must be no wider than six ground tiles, including padding
and borders. Derive this cap from `TILE_SIZE`, shrink it to fit narrow viewports,
and wrap descriptions and button labels. Reserve space for the close button when
titles wrap. Keep the same title font size across popups; allow whole header items
to wrap on narrow screens rather than shrinking individual titles or splitting
cuneiform labels. This cap does not apply to full dialogs such as markets or farm levels.

## 34. Build drawer convention

Group the isometric catalogue in a Radix Accordion: Available, Already built,
and Future unlocks. Only Available starts open when it contains buildings;
otherwise only Already built starts open. Unlocked buildings remain in Available
when missing materials or when the farmer is busy; existing construction sites
count as already built. Keep each group in unlock-level order and let the player
expand or collapse sections independently.
Already built cards show only the building image, name and description. Omit
dimensions, construction time, material requirements, status and action buttons.
Future unlock cards also omit dimensions, construction time and materials, but
retain the disabled `Unlock at level [level]` button.

List buildings in unlock-level order. Each entry shows its sprite and name,
then footprint, construction time and required materials, then its description,
and finally its build button.

In the isometric catalogue, show construction requirements as compact visual
rows: material icon, name, available/required quantity and horizontal progress.
Place footprint and building time above those rows. Use the full card width
inside the existing drawer/accordion bounds; do not widen the drawer. Clamp
progress fills at 100% while retaining the actual available quantity. Reuse the
same inventory eligibility as construction, including dropped reeds/clay but
excluding carried materials.
Do not repeat material shortages as Gather/Buy reminders below these rows.
Keep material validation on Build buttons; only non-material availability status
(such as occupied farmer or full hands) needs an additional message.

Level-locked building buttons use exactly `Unlock at level [level]`, including
future buildings. Use the relevant upgrade level for additional buildings (for
example, level 8 for the warehouse). Once unlocked, use `Build [building]`,
even when disabled for missing materials or farmer availability; explain those
blockers above the button. Do not imply an attained level is still locked.
Keep material counts and any availability explanations above the button rather
than substituting them for the standard disabled label. This is a wording rule;
retain material, farmer-availability and building-limit validation.

## 35. Building road access

Every player-built building requires cardinal adjacency to an existing, completed
road connected to the main road, with a free loading tile. Apply this by default
to future buildings too; exceptions require an explicit user decision. Share the
rule between placement previews and authoritative server validation. An invalid
placement must show a red footprint and sprite, including when road access is
missing even though the ground tiles are empty.

Approved isometric placement presentation (2026-10-11): use the granary preview
as the baseline for all building placement. Show the full tile footprint and a
semi-transparent building ghost, both green when valid and red when invalid;
mark the valid loading tile in yellow. Move the preview with the pointer or a
ground-projected tap, preserve camera pan/zoom, and provide cancellation/Escape.
Use a subtle opacity pulse, respecting reduced-motion preferences. Keep the
approved sprite scale/anchor aligned with the final building rendering.
The temporary toolbar test has been removed. Retained mock code bypasses economic
gates for spatial testing only: real Build actions must restore level, ownership,
materials, farmer availability and server validation before committing construction.
The granary now connects this preview to Manage → Build with a separate confirmation
and the existing authoritative build_granary command. Construction deadlines are
persisted immediately; walking and work animations never gate completion.

## 36. Minimal player-facing text

The default Destroy building icon is `BuildingActionIcon` with `kind="destroy"`:
two copies of the pickaxe in a 36px box, one mirrored, each rotated 18 degrees,
scaled to 0.9 and shifted 4px inward to cross at mid-handle. Preserve these approved
settings. Icon buttons use left-aligned text, centered vertical alignment and a
12px gap. Applied to mill, brewery and bread oven so far; extend other building UI only when requested.

Use `brewery/brewers-groats-icon.png` for groats quantity UI (inventory,
market previews, ingredient requirements and carried counts). Flour keeps its
flour-bag icon. Do not replace mill output bags or carrying/work animation artwork.

The isometric farm and warehouse popups preserve their titles and level badges and display local
inventory as a four-column visual grid (two columns on narrow screens): existing
36px item artwork, name with quantity/capacity beside it, and storage progress below.
Both inventory popups are 560px wide, capped to the viewport minus 24px; other popup widths are
unchanged. Reuse the existing
farm/warehouse allocation and capacity rules; clamp bars, not quantities.
Keep consistent 20px content padding without trailing grid or empty-action gaps.
Legacy popup tables retain their layout unless explicitly approved.

Market trade previews use side-by-side Current and After trade resource/currency
blocks and labelled minus/input/plus quantity controls with compact unit-price
panels to their right (wrapping on narrow screens). Player-buy listings retain
their separate per-seller unit-price panels.
Reuse these for every NPC resource and player listing. Listing creation shows
After listing: goods reserved, no immediate proceeds. Never use a slash between
resource quantities and shekel balances. Preserve all economic validation.

When the user requests a UI change in one component, inspect other components
with similar UI and ask whether they want the same change applied there too.
Do not automatically expand the requested scope. If shared code would change
other interfaces, flag those affected interfaces and confirm before applying
the broader change. The explicitly requested component can proceed independently
when practical.

Keep interface text to a minimum. Prefer concise labels, quantities, visual states,
and short contextual button messages over persistent explanations. Explain detailed
rules and their rationale in the game rules, not in every gameplay popup. A blocked
barley sale uses “You must keep 1 barley in your farm” on its disabled confirmation
button, without adding a paragraph to the market card.

Farmer sprite rendering has a player-approved baseline and a reversible sharpening
trial documented in `docs/farmer-rendering.md`. Preserve that baseline when tuning
artwork; do not replace it with direct full-resolution texture minification.

## 37. Dropped-item positioning

All dropped ground items use the approved barley/reed/clay position: project their
owning tile centre and use sprite origin (0.5, 0.71875), shared through
`GROUND_ITEM_ORIGIN` in `isometricFarm.ts`. Apply this default to future goods too.
Preserve owning-tile hit testing. Do not apply this anchor to carried items,
characters, crops or buildings. New artwork should be framed to match this baseline.

## 38. Flat-to-isometric migration parity

Approved production exception: mill, bread oven and brewery output is capped at
six finished items per producer using shared `productionOutputFits` in UI and
server start validation. Mill flour/groats share the cap, including donkey work.
Never discard legacy excess; block until the next entire batch fits. Recipes
and mill estate-storage reservations are unchanged. Output-cap blockers use a
disabled `Store finished goods to make room` button (popup visibility exception).

When migrating an existing flat-map feature, preserve its settings and behaviour
exactly unless the player explicitly requests a change. Inspect and reuse the
existing implementation and shared helpers rather than inventing new defaults.
Adapt coordinates to the isometric projection, preserving the same logical tile
placement, timings, quantities and interactions. Retain explicitly approved
isometric artwork, anchors and rendering settings. Finished building goods use
the shared `buildingOutputTile` placement inside the lower-left footprint tile,
not a decorative offset outside the building. Approved exception: bread baskets
and mill output use the nearest connected-road B/C rule in section 40.

## 39. Approved isometric shadow baseline

The player approved the morning/evening building silhouettes and midday contact
ovals on 2026-10-15. Reuse `shadowLayer.ts`, `buildingShadows.ts` and the pure
`buildingShadowProjection.ts` helpers for future buildings; do not retune existing
buildings when adding one. This is cosmetic only, with no sprite relighting or
effect on server time, economy or production.

Use device-local time: daylight 08:00–20:00, high sun 14:00, half-hour dawn/dusk
fades. Preserve the current brown-grey colour (#504739), opacity (0.10 night to
0.20 daylight), ground clipping and below-artwork depth. Characters and small
items use the existing narrow-feathered ovals.

Buildings use alpha-derived morning/evening silhouettes. Anchor to visible
ground contact, never transparent canvas margins or the lowest foreground prop.
For isometric corners, use the per-column base contour so matching corners stay
attached (farmhouse/market baseline). Otherwise calibrate an artwork-specific
contact row (approved active oven: 0.76). The idle oven without sack/bowl uses
its per-column base contour for evening corner alignment, not the old fixed row.
Preserve source framing, sprite scale and origin.
At 14:00 use a shallow oval sized to visible artwork, with six-world-pixel side
and southern margins; blend smoothly between 11:00 and 17:00. Keep the existing
morning and evening settings unchanged. Night retains faint contact shadows.

Register new building images with `addBuilding`; composite buildings register
only intended casting parts. Cache pixel analysis, respect visibility/alpha,
release generated textures on redraw/shutdown, and do not upload them every frame.
Verify all time presets, ground corners, map-edge clipping, construction opacity
and active/idle visibility before requesting player approval. The temporary
Shadows time selector remains until the user asks to remove it.
The mill casts from its body and idle bags only, excluding bowl and lever.
Its midday and evening settings are approved. Its morning uses simple ellipses
with the shared sun-length scale and visible artwork height (excluding transparent
padding). Preserve the approved settings for other buildings.

## 40. Building work animation footprint

All isometric in-world action progress bars share `ACTION_PROGRESS` and
`drawActionProgress`: 52×7 logical pixels, 2px inset, brown track and gold fill.
Reuse these for mill, oven, brewery, construction and road/canal work; preserve
each action's anchor. Exception: BarleyWorkProgress retains the approved round
meter in the lower container for sowing and harvesting, with percentage inside
and the field counter beside it. Status meters and
material-availability bars are separate UI elements, not action timers.

Keep workers and their tools within the building's 2×2 footprint as far as
possible, preserving normal character proportions and avoiding neighbouring
buildings. Active/idle bases must share framing, scale and position.
The bread oven uses its saved production job: two push/pull strokes
over three seconds followed by a 2.2-second rest, gentle orange glow and three
staggered white wisps. Its progress bar follows server start/completion timestamps.
The table and progress bar share the real batch duration: two doughs
in the first third, one in the second third, and empty during the final third.
Completion restores the idle oven, releases the farmer and displays saved bread.
The paddle loop never resets batch progress. Table frames share
512px framing, 128px preparation and 62px display size, anchored at oven +(22,9).
The active table is lowered to match the idle table and clear the finished basket.
Reduced motion holds the resting pose and steady glow without smoke.
The baking worker's full-frame texture is prepared at 140px with 0.15 RGB
sharpening for its 70px display width; keep alpha and shared pose alignment.
The working pose is lowered two world pixels and shifted two world pixels left
from the first trial, keeping its scale and the oven's mask fixed. White smoke
peaks at 42% opacity, with unchanged size, count and speed.
Hidden-tab time is reconciled from the saved job. Objects/masks are cleaned up on redraw and shutdown.
Resolve active building textures before rendering daylight shadows, including
the first frame after periodic redraw, to avoid flashing the idle silhouette.
The baking worker uses the regular farmer's 23×48 shadow profile in the
shared daylight layer, anchored at his feet (oven offset -44,-21). It is visible
only with the working farmer, including pauses, and follows the same time preset.
Saved pending bread uses `isometricOutputPosition` and `GROUND_ITEM_ORIGIN`, at 64px
with shared storage-chip styling. It is selectable with a warm yellow outline
and Store action, and remains below the farmer and dog.
For 2×2 footprint discussions, A is upper left (origin), B lower left (row+1),
C upper right (column+1), D lower right (column+1,row+1). Compare B/C using squared
grid distance to completed, connected roads cardinally adjacent to the footprint.
Equal distances prefer proximity to valid saved loading access, then B. Use the
same chosen road for basket pickup; do not mutate the saved construction/supply
loading tile. No connected road falls back to B with no pickup route. Preserve
the approved within-tile offset/origin. Mill output uses this same shared
`roadsideOutputPlacement` helper for artwork, selection and collection. While
finished flour/groats bags occupy C and the mill is inactive, hide its decorative
barley bags and bowl. Restore them when the output is collected or moves to B;
keep active milling props unchanged. Hidden bags must not cast a shadow.
Submit start_baking immediately, reserving flour and saving the server-planned
supply route. Render that route with empty-handed then flour-carrying frames.
Never dispatch production commands from animation callbacks. Finished bread uses
the existing production_delivery pickup/store flow; interrupted deliveries remain
persisted and resumable. No baking preview button or accelerated timer remains.

The brewery courtyard uses the new
`brewery-left-bottom-shell.png` and up to two copies of `brewery-left-bottom-jar.png`.
`breweryLayout.ts` composes them once at texture preparation, repainting the low
foreground wall over the vessels. Keep the existing 150px building scale and
anchor, selection and shadow pipeline. The brewery shadow samples the new courtyard/vessel
composite and uses its per-column base contour for evening alignment; the old
roofed brewery's fixed 0.79 contact row is retired. Morning alone uses the current
farmhouse silhouette, uniformly scaled to the brewery's visible artwork width
and aligned to its ground-contact baseline, then shifted 4 world pixels upward
at the 150px brewery scale to tuck under the vessels. Use the farmhouse's exact shared
projection settings, opacity and blend into midday; no visible proxy building
is created. The custom rear-wall polygon trial has been removed. Preserve the approved
midday oval, evening contour and night settings; the foreground wall overlay is not
a separate shadow caster. Vessel count follows the current `brewingVessels`
inventory exactly, clamped to 0–2; never count packaging jars or finished beer.
The first vessel occupies the approved left position; the second occupies the
right position. Precompute all three counts for both shells and select on snapshot
updates, including market purchases/reloads, without uploading textures each frame.
Foam and worker placement follow visible vessels. This is presentation only;
construction retains permanent equipment in inventory and brewing gates are unchanged.
The brewing animation supports eight seconds of planted-foot
stirring (three seconds moving, one second resting, twice), then hides the working
worker and runs staggered cream foam caps. Its toolbar test control has been removed. The worker
uses shared crop bounds and the normal 64px farmer tile/56px body height; no
frame-specific resizing. During saved preparation the real farmer is occupied;
his walking sprite is replaced by the working sprite while stirring. The stool raises his feet onto the existing stool sprite beside
the selected vessel. The approved left-vessel preset is preserved in
`BREWING_WORK_PLACEMENTS.left`: stool x=-30, farmer x=-27, seat y=-64,
ground y=-40, stool size=40, relative to the brewery anchor. Production
uses the right vessel, translating both sprites and their shadow +31.5px in x
and +8px in y. Keep their scales, origins and relative alignment unchanged.
Both stool and worker render above the jars; do not repaint
the jar's front body over them. The worker renders above the stool.
During preparation, a shell-only front-right wall overlay renders above the
stool but below the farmer, hiding overlapping stool legs behind the masonry.
It shares the brewery's exact scale/origin and does not cast a duplicate shadow.
The thicker stirring shaft is now part of the replacement farmer sprites.
The temporary Phaser shaft overlay and its per-frame coordinates were removed.
The stool and worker disappear together after preparation. Their shared shadow
remains anchored to the ground, not the elevated feet.
All animation phases sample server-owned timestamps in `production.brewing`.
Submit `brewery_supply/start_brewing` immediately; atomically reserve groats, water
and packaging jars, save the farm-supply journey, arrival, fermentation start
(arrival + eight seconds), and completion. `beerReadyAt` matches completion for
the existing exactly-once lifecycle/porter settlement. The farmer is locked only
until fermentation starts. Reloads and hidden tabs never postpone any phase.
Reduced motion holds the rest pose and steady foam. Presentation objects are
disposed on redraw/shutdown and the worker uses the shared farmer shadow.
The temporary brewery orientation toolbar control and its state/scene entry point
have been removed. Real construction retains the shared footprint preview. On every move,
use the candidate loading tile: B selects the left/bottom shell, C the right/top
shell. Brewery access is an exception to nearest-road output selection: whenever
any eligible connected loading road supports B, prefer it and the detailed original
shell over C. Shared `findLoadingTile` enforces this in the preview and server
construction, excluding reserved/occupied access and unfinished/disconnected roads.
`breweryLoadingCorner` determines B/C by distance to the two output corners.
Respect the selected saved loading tile for orientation; no road defaults to B.
This gives the original shell north of the main road and the second shell south.
Built breweries also select their shell from saved loading access and use the same
inventory-driven vessel composition, with a shell-specific foreground wall mask. Finished beer
uses that orientation's B/C corner, the shared chip/outline, and `production_delivery`
pickup/store flow. Deliveries resume from the farmer/farm popup and use estate
storage capacity. Reuse the existing beer-jars asset for output and carrying;
groat supply uses the approved flour-bag carrying frames. River collection and
brewery water/jar supply controls preserve the existing recipe and capacities.
Production is now playable.
