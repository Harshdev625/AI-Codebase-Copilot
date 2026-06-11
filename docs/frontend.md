# Frontend Guide

## Technology Stack

| Package | Purpose |
|---|---|
| Next.js 16 (App Router) | Routing, SSR; calls backend API directly (no Next.js API proxy) |
| React 19 | UI rendering |
| Tailwind CSS v4 | Utility-first styling |
| Zustand | Global client state (auth, workspace, studio) |
| TanStack React Query | Server state, caching, background refetch |
| Framer Motion | Page transitions and animations |
| Monaco Editor | Code and diff viewer |
| Lucide React | Icon system |
| Radix UI | Accessible UI primitives |
| React Virtuoso | Virtualized message list |
| date-fns | Date formatting |

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── (auth)/                 # Login, Register
│   │   ├── (user)/                 # Dashboard, Workspace, Studio
│   │   └── admin/                  # Admin dashboard
│   ├── components/
│   │   ├── layout/                 # AppShell, TopNavbar, PageTransition
│   │   ├── shared/                 # PageHeader, StatCard, ErrorBoundary, Toast
│   │   └── ui/                     # Radix-based primitives (Button, Card, Dialog...)
│   ├── core/
│   │   └── api/                    # Fetch-based API client, error normalisation
│   ├── features/
│   │   ├── auth/                   # Login/register forms, hooks, service
│   │   ├── chat/                   # ChatWorkspace, messages, context panel, patches
│   │   ├── dashboard/              # Stats grid, repository list, quick actions
│   │   ├── explorer/               # File explorer dialog, lazy tree node
│   │   ├── repositories/           # Repository service, hooks, snapshot components
│   │   ├── studio/                 # Unified Copilot Studio (feature-flagged)
│   │   └── workspace/              # Classic workspace shell, Monaco viewers
│   ├── lib/
│   │   ├── auth.ts                 # Token helpers
│   │   ├── feature-flags.ts        # isStudioEnabled() and other flags
│   │   └── utils.ts                # cn(), formatDate()
│   ├── store/
│   │   └── auth-store.ts           # Zustand auth store
│   └── styles/
│       └── globals.css             # Design tokens, animations, responsive utilities
├── middleware.ts                   # Auth guard (protects /dashboard, /studio, /workspace, /admin/*)
└── next.config.ts                  # output: standalone (for Docker)
```

---

## Feature Flags

```typescript
import { isStudioEnabled } from "@/lib/feature-flags";

// Returns true if NEXT_PUBLIC_STUDIO_ENABLED=true
if (isStudioEnabled()) {
  router.push("/studio");
}
```

Always use `isStudioEnabled()` — never read `process.env.NEXT_PUBLIC_STUDIO_ENABLED` directly.

When the flag is off, `middleware.ts` redirects `/studio` → `/workspace`.

### Post-login routing

| Role | Default destination |
|---|---|
| User | `/dashboard` (navigate to `/studio` or `/workspace` from quick actions) |
| Admin | `/admin/dashboard` |

Legacy routes `/chat` and `/repositories` were removed; chat and repository management live inside `/workspace` and `/studio`.

---

## State Architecture

### Auth Store (`useAuthStore`)

```typescript
const { user, token, login, logout } = useAuthStore();
```

Persisted to `localStorage`. Contains the JWT and decoded user profile.

### Workspace Store (`useWorkspaceStore`)

```typescript
const { selectedRepositoryId, activeSessionId, activeSidebarPanel, openTab } = useWorkspaceStore();
```

Drives the classic `/workspace` route. Persisted.

### Studio Store (`useStudioStore`)

```typescript
const { canvasMode, secondaryPanel, activeFilePath, activePatchId, selectedRepositoryId } = useStudioStore();
```

Composite store — merges `WorkspaceState` with Studio-specific state (canvas mode, secondary panel toggle, active file/patch, commit SHA for historical browsing).

---

## API Client

The API client is in `src/core/api/client.ts`. It uses the **Fetch API** (not Axios) and:
- Resolves paths against `getFrontendApiBase()` from `src/lib/api-proxy.ts`
- Strips duplicate `/v1` prefixes when `NEXT_PUBLIC_API_URL` already includes `/v1`
- Attaches `Authorization: Bearer <token>` from `getAccessToken()`
- Normalises errors via `ApiError` and emits `EVENTS.UNAUTHORIZED` on 401

Set `NEXT_PUBLIC_API_URL=http://localhost:8000/v1` in development so the browser calls the FastAPI server directly.

```typescript
import { apiClient } from "@/core/api/client";
const result = await apiClient<PaginatedData<Repository>>("/v1/repositories");
```

Chat streaming uses raw `fetch` against `${API_BASE_URL}/chat/stream` for SSE body parsing.

---

## React Query Keys

Convention: all keys are arrays. Top-level key matches the resource noun.

```typescript
// Repositories
["repositories"]
["repositories", id]
["repositories", id, "insights"]
["repositories", id, "snapshots"]
["repositories", id, "patches"]

// Sessions (chat service uses /v1/chat prefix)
["chat", "sessions"]
["chat", "sessions", id]
["chat", "sessions", id, "messages"]
["sessions", id, "context"]

// Admin
["admin", "users"]
["admin", "metrics"]
```

---

## Component Map

### Chat / Workspace

| Component | Location | Description |
|---|---|---|
| `ChatWorkspace` | `features/chat/components/` | Main workspace layout with session sidebar, canvas, context panel |
| `ChatMessageItemBubble` | `features/chat/components/` | Individual message bubble with markdown rendering |
| `ModeSelector` | `features/chat/components/` | ASK / PLAN / ACT mode picker |
| `ContextPanel` | `features/chat/components/` | Repository insights, token budget, context entries |
| `PatchDiffViewer` | `features/chat/components/` | Shows patch file diffs |
| `PatchReviewEditor` | `features/workspace/components/` | Full patch review with validate/apply workflow |

### Studio

| Component | Location | Description |
|---|---|---|
| `CopilotStudioShell` | `features/studio/components/` | Root studio layout orchestrator |
| `GlobalTopBar` | `features/studio/components/` | Studio top bar with logo, search, profile |
| `StudioNavRail` | `features/studio/components/` | 48px icon rail on the left |
| `StudioSecondaryPanel` | `features/studio/components/` | Panel router (explorer/search/snapshots/patches/tasks/settings) |
| `StudioCanvas` | `features/studio/components/` | Canvas router (chat/editor/diff/patch-review) |
| `StudioSessionSidebar` | `features/studio/components/` | Session list with rename, pin, archive |
| `StudioExplorerPanel` | `features/studio/components/` | File tree with snapshot selector for historical browsing |

### Workspace (Classic)

| Component | Location | Description |
|---|---|---|
| `WorkspaceShell` | `features/workspace/components/` | Classic IDE layout with resizable panels |
| `ActivityBar` | `features/workspace/components/` | Left icon bar |
| `LeftSidebar` | `features/workspace/components/` | Collapsible sidebar with file/session/patch lists |
| `MainEditor` | `features/workspace/components/` | Tab-based content area |
| `MonacoViewer` | `features/workspace/components/` | Read-only Monaco code viewer |
| `MonacoDiffViewer` | `features/workspace/components/` | Side-by-side diff viewer |
| `StatusBar` | `features/workspace/components/` | Bottom status bar with index status |

---

## Responsive Design

The app targets three breakpoints:

| Breakpoint | Target |
|---|---|
| `sm` (640px+) | Tablet portrait |
| `md` (768px+) | Tablet landscape / small laptop |
| `lg` (1024px+) | Desktop |
| `xl` / `2xl` | Ultrawide |

Key responsive behaviors:
- **Mobile**: TopNavbar shows hamburger menu; workspace activity bar hidden
- **Tablet**: Sidebars collapse; breadcrumbs abbreviated
- **Desktop**: Full layout with all panels visible
- **Ultrawide**: Max-width container on dashboard/admin; workspace uses full width

---

## Running Tests

```bash
cd frontend

# Unit tests (CI uses test:coverage)
npm test
npm run test:coverage

# Watch mode
npm run test:watch

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

Playwright E2E spec: `tests/e2e/engineering_workspace.spec.ts` (run via `npx playwright test` when dev server is up). See [testing.md](testing.md).
