# Taskflow — frontend

React + TypeScript (strict) + Vite. Hand-crafted CSS with design tokens (no UI kit,
no Tailwind). State in Zustand; drag-and-drop via @dnd-kit. See `../SPEC.md` for the
full product/architecture spec — it is the single source of truth.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest (adapter contract suite, migration, position math)
npm run build      # tsc -b && vite build
```

Requires Node 20.12+ (toolchain pinned to versions compatible with Node 20.12:
vite 6, vitest 3, jsdom 26).

## Storage modes

`.env` (see `.env.example`):

- `VITE_STORAGE_MODE=local` (default) — everything in localStorage under the
  versioned envelope key `todo.app.v2`. A one-time v1→v2 migration reads the legacy
  `todo-app-items` key on first boot and never writes or deletes it.
- `VITE_STORAGE_MODE=api` — talks to the Spring Boot backend at
  `VITE_API_BASE_URL` (default `http://localhost:8080/api/v1`) through the exact
  same `StorageAdapter` interface. The shared Vitest contract suite runs against
  both adapters (ApiAdapter over MSW) so the dormant adapter stays honest.

To move local data to the API: sidebar footer → Export, flip the env, restart Vite,
then Import the JSON (upsert-by-id; existing rows are skipped).

## Layout

```
src/
  app/            App shell, providers, error boundary, toasts
  domain/         types, validation, position math, date helpers, pure mutations
  storage/        StorageAdapter interface, LocalStorageAdapter, ApiAdapter,
                  v1→v2 migration, adapter factory
  store/          Zustand store (optimistic updates w/ snapshot rollback),
                  selectors, 5s undo
  features/       tasks (list, row, checkbox, quick-add, edit popover),
                  filters (sidebar, mobile tabs), theme
  components/     Button, IconButton, Popover, DatePicker, Kbd, TagChip, …
  styles/         tokens.css (both themes), base.css
  lib/            keyboard map, classnames
  test/           adapter contract suite, migration + position tests, MSW mock API
```

Keyboard: `N` new · `/` search · `↑/↓` navigate · `E` rename · `D` done ·
`⌫` delete · `0–3` priority · `Alt+↑/↓` reorder · `Esc` clear/close.

Inter variable font is vendored in `public/fonts/` (SIL OFL 1.1).
