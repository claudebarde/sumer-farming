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
