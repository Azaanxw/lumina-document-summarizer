# Frontend — Document Summarizer (Lumina)

## Overview

Next.js 16 App Router frontend for Lumina. Lets users upload PDFs, then study them via AI-generated summaries, quizzes, flashcards, and RAG-powered Q&A. Includes a dictionary popup for any selected word. Phase 5 adds Supabase auth (Google OAuth + Magic Link OTP), guest upload flow with post-analysis nudge banner, document claiming, and per-user quota display.

## Directory Structure

```
frontend/
├── app/
│   ├── globals.css                  # Tailwind 4 + OKLch CSS vars + dark mode — DO NOT TOUCH
│   ├── layout.tsx                   # Root layout — Geist font, metadata
│   ├── page.tsx                     # Landing page — upload zone + wordmark
│   ├── dashboard/
│   │   └── page.tsx                 # Document grid, quota indicator, sign-out
│   └── document/
│       └── [id]/
│           └── page.tsx             # Study tools — Summary/Quiz, Flashcards, Ask tabs + NudgeBanner
├── components/
│   ├── upload-zone.tsx              # Drag-and-drop PDF uploader
│   ├── document-card.tsx            # Card for a document in the dashboard grid
│   ├── summary-view.tsx             # Summary paragraphs + interactive quiz; fires onLoaded callback
│   ├── flashcard-deck.tsx           # 3D flip flashcard carousel
│   ├── qa-chat.tsx                  # Chat-style Q&A with citation badges
│   ├── citation-badge.tsx           # "Page N" chip shown below Q&A answers
│   ├── dictionary-popup.tsx         # Word-selection popup using Free Dictionary API
│   ├── auth-modal.tsx               # Google OAuth + Magic Link OTP modal (2-step: combined options → OTP verify)
│   ├── nudge-banner.tsx             # Post-analysis sign-in prompt (15s delay, no dismiss); handles claim on auth
│   ├── user-menu.tsx                # Profile icon + dropdown (Sign out / Delete account with confirmation)
│   └── ui/                          # shadcn/ui components (base-nova style)
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── scroll-area.tsx
│       ├── tabs.tsx
│       ├── skeleton.tsx
│       ├── badge.tsx
│       └── separator.tsx
├── lib/
│   ├── api.ts                       # Typed fetch layer — auto auth headers, guest token, claim
│   ├── supabase.ts                  # Supabase browser client (createBrowserClient)
│   ├── errors.ts                    # Friendly error message mapping
│   └── utils.ts                     # cn() helper (clsx + tailwind-merge)
├── middleware.ts                    # Protects /dashboard — redirects unauthenticated users to /
├── .env.local                       # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
├── components.json                  # shadcn config — style: base-nova, @base-ui/react
├── next.config.ts
├── tailwind.config (inline via CSS) # Tailwind 4 — configured in globals.css
└── package.json
```

---

## Tech Stack

| Item | Detail |
|---|---|
| Framework | Next.js 16.2.6 — App Router |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 — `@import` syntax, no `@tailwind` directives |
| Components | shadcn/ui `base-nova` style — uses `@base-ui/react` primitives, **not** Radix UI |
| Icons | lucide-react |
| Font | Geist (loaded via `next/font/google` in layout.tsx) |
| Auth | `@supabase/supabase-js` + `@supabase/ssr` — Google OAuth + Magic Link OTP |

---

## Auth Model

- **Guests**: upload freely, no account needed. `guest_token` (UUID) returned by `/upload` is stored in `localStorage` keyed as `lumina_guest_{documentId}` and held in the `api.ts` module as `_guestToken` for the current session. All requests include `X-Guest-Token` header when a guest token is active.
- **Authenticated users**: session managed by Supabase (`createBrowserClient`). All requests include `Authorization: Bearer <token>` header automatically via `getAuthHeaders()` in `api.ts`.
- **Claiming**: after sign-in, `NudgeBanner` calls `claimDocument(documentId, guestToken)` → `POST /documents/{id}/claim`. On success the guest_token is removed from localStorage.
- **Dashboard protection**: `middleware.ts` uses `createServerClient` to validate the session cookie and redirects unauthenticated users to `/`.

---

## Files

### `lib/supabase.ts`
Exports a singleton `supabase` browser client created via `createBrowserClient`. Imported by `api.ts`, `auth-modal.tsx`, `nudge-banner.tsx`, `dashboard/page.tsx`, and `document/[id]/page.tsx`.

```ts
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

---

### `lib/api.ts`
All fetch calls. Reads `NEXT_PUBLIC_API_URL` as the base URL. Every function throws on non-2xx.

**Guest token management:**

| Export | Description |
|---|---|
| `setGuestToken(token)` | Sets the module-level `_guestToken` variable (called on upload and on page load from localStorage) |
| `getStoredGuestToken(documentId)` | Reads `lumina_guest_{documentId}` from localStorage |

`getAuthHeaders()` (internal) — async; reads Supabase session for `Authorization` header and `_guestToken` for `X-Guest-Token`. Merged into every `request()` call automatically.

**Types exported:**

| Type | Shape |
|---|---|
| `DocumentMeta` | `{ id: string; filename: string; created_at: string }` |
| `QuizQuestion` | `{ question: string; options: string[]; answer: string }` |
| `Flashcard` | `{ question: string; answer: string }` |
| `Citation` | `{ page_number: number; snippet: string }` |
| `Quota` | `{ used: number; total: number }` |

**Functions exported:**

| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `uploadDocument(file)` | POST | `/upload` | `{ document_id, filename, guest_token }` — stores guest_token in localStorage automatically |
| `claimDocument(documentId, guestToken)` | POST | `/documents/{id}/claim` | `void` — removes guest_token from localStorage on success |
| `deleteAccount()` | DELETE | `/account` | `void` — call then `supabase.auth.signOut()` + redirect |
| `listDocuments()` | GET | `/documents` | `{ documents: DocumentMeta[], quota: Quota }` |
| `processDocument(documentId)` | POST | `/process-document` | `{ summary: string, quiz: QuizQuestion[] }` |
| `generateCards(documentId)` | POST | `/generate-cards` | `{ flashcards: Flashcard[] }` |
| `askQuestion(documentId, question)` | POST | `/ask` | `{ answer: string, citations: Citation[] }` |
| `lookupWord(word)` | GET | `/dictionary/{word}` | `{ word, phonetic, definition, example, synonyms }` |
| `getCacheStatus(documentId)` | GET | `/documents/{id}/cache-status` | `{ has_summary, has_flashcards }` |

---

### `middleware.ts` *(root of frontend/)*
Protects `/dashboard`. Uses `createServerClient` from `@supabase/ssr` to read the session from request cookies. Redirects unauthenticated users to `/`. Also refreshes and syncs auth cookies on every matched request.

```ts
export const config = { matcher: ['/dashboard/:path*'] }
```

---

### `app/layout.tsx`
Root layout. Loads Geist and Geist Mono via `next/font/google`. Metadata: `title: "Lumina"`.

---

### `app/page.tsx` — Landing Page
**Client component.** Full-viewport centered layout:
- "Lumina" wordmark + tagline
- `<UploadZone>` — on success, calls `router.push('/document/${id}')`
- Link to `/dashboard` for returning users

---

### `app/dashboard/page.tsx` — Dashboard
**Client component.** Requires authentication (enforced by `middleware.ts`).

- On mount: fetches `listDocuments()` for documents + quota; fetches session from Supabase for user email.
- 401 response from `/documents` triggers `router.replace('/')` as a client-side fallback.
- Header row: document count ("N of 4 free documents used") + user email + **Sign out** button (`supabase.auth.signOut()`).
- If `quota.used >= quota.total`: shows a graceful "You've reached your free document limit. Thank you for using Lumina." card instead of the upload zone.
- Document grid: `DocumentCard` components.

---

### `app/document/[id]/page.tsx` — Document Detail
**Client component.** Gets document ID via `useParams<{ id: string }>()`.

- On mount: reads `lumina_guest_{id}` from localStorage and calls `setGuestToken()` to restore the module-level variable after a page refresh.
- Tracks `summaryLoaded` state — set to `true` via `onLoaded` callback from `<SummaryView>`.
- Renders `<NudgeBanner documentId={id} analysisComplete={summaryLoaded} />` above the Tabs, inside the scrollable study tools area.
- Split layout: PDF viewer (left 40%) + study tools + ask panel (right 60%).

---

## Components

### `components/auth-modal.tsx`
**Client component.** Props: `onSuccess: () => void`, `onDismiss: () => void`, `subtitle?: string`.

Fixed overlay modal with backdrop blur. Two internal steps:

| Step | UI | Auth call |
|---|---|---|
| `main` | Google button + "or" divider + email input + "Send code" button | Google: `signInWithOAuth({ provider: 'google' })`; Email: `signInWithOtp({ email })` → moves to `otp` |
| `otp` | Numeric OTP input (6 digits, mono font) + "Verify" button + "Resend code" (returns to `main`) | `supabase.auth.verifyOtp({ email, token, type: 'email' })` |

`subtitle` prop allows callers to customize the helper text (e.g. landing page uses "Sign in to access your documents.").
Calls `onSuccess()` after a successful OTP verification. Google OAuth causes a page redirect — the `onAuthStateChange` listener in `NudgeBanner` handles the claim on return.

---

### `components/nudge-banner.tsx`
**Client component.** Props: `documentId: string`, `analysisComplete: boolean`.

Shown only when: `analysisComplete && !session && guestToken exists`. **No dismiss option** — banner stays until the user signs in.

- Appears 15 seconds after `analysisComplete` becomes `true` (via `setTimeout`). If the user is already authenticated the timer never fires.
- On mount: calls `supabase.auth.getSession()` and sets up `supabase.auth.onAuthStateChange`. On `SIGNED_IN` event, calls `claimDocument()`. Uses a `hasClaimed` ref to prevent double-claiming.
- States:
  - Hidden: timer has not elapsed yet
  - Default: banner card with "Enjoying Lumina?" message + single "Login / Sign Up" button
  - `claiming`: spinner + "Saving document to your account…"
  - `claimed`: green checkmark + "Document saved to your account."
- Renders `<AuthModal>` inline when the button is clicked.

### `components/user-menu.tsx`
**Client component.** Props: `userEmail: string`, `onSignOut: () => void`, `onDeleteAccount: () => void`.

Profile circle avatar (first letter of email) shown in the document page header when authenticated. Click opens a dropdown:
- User email (read-only label)
- Sign out
- Delete account → inline confirmation ("This will permanently delete all your documents.") with "Delete everything" / "Cancel" buttons.

Closes on outside click via `document.addEventListener("mousedown", ...)` in a `useEffect`.

---

### `components/summary-view.tsx`
**Client component.** Props: `documentId: string`, `onLoaded?: () => void`.

- Calls `processDocument(documentId)` on mount.
- Fires `onLoaded?.()` when summary data resolves successfully — used by the document page to show the nudge banner only after analysis is complete.
- Loading spinner, error state, structured summary rendering, interactive quiz carousel.

---

### `components/upload-zone.tsx`
**Client component.** Props: `onSuccess(documentId: string)`.

Handles drag-and-drop and click-to-browse. `uploadDocument()` now returns `{ document_id, filename, guest_token }` — guest_token is stored in localStorage automatically inside the API function.

Before uploading, checks `supabase.auth.getSession()` and `hasExistingGuestDocument()`. If the user is a guest who already has a document in localStorage, enters `guest_limit` state instead of uploading — shows a sign-in prompt via `AuthModal`. After successful auth, resets to `idle` so the user can upload as an authenticated user.

| State | Visual |
|---|---|
| `idle` | Dashed border, upload icon |
| `dragging` | Border highlights to primary |
| `uploading` | Spinner + "Uploading and processing…" |
| `success` | Green checkmark |
| `error` | Red icon + message + "Click to try again" |
| `guest_limit` | LogIn icon + "You've used your free document" + "Sign in to continue" button |

---

### `components/document-card.tsx`
Strips UUID prefix from S3 filename. Formats `created_at`. "Open" navigates to `/document/[id]`.

---

### `components/flashcard-deck.tsx`
CSS 3D flip animation. Prev/Next navigation. Accepts optional `initialCards` prop to skip re-fetching when cards were preloaded by the parent.

---

### `components/qa-chat.tsx`
Chat UI with message history in component state. `ScrollArea` auto-scrolls to latest answer. Each answer shows `CitationBadge` chips. Shows inline rate limit error when backend returns 429.

---

### `components/citation-badge.tsx`
Presentational. Renders `<Bookmark> Page N` chip with `title={snippet}` tooltip.

---

### `components/dictionary-popup.tsx`
Attaches global `mouseup`/`mousedown`/`keydown` listeners. Single-word selection only. Positions popup below selection range. Supports nested synonym lookups.

---

## Design System

All colours from CSS custom properties in `globals.css`. Never hardcode hex/rgb.

| Token | Usage |
|---|---|
| `bg-background` / `text-foreground` | Page base |
| `text-muted-foreground` | Secondary labels |
| `border` | All borders |
| `bg-muted` | Subtle surface |
| `bg-card` | Card surfaces |
| `primary` / `primary-foreground` | CTA buttons, active states |
| `destructive` | Errors |

Dark mode: add `class="dark"` to `<html>`.

---

## Running Locally

```powershell
npm install
npm run dev
```

App at `http://localhost:3000`. Backend must be running at `http://localhost:8000`.

---

## Environment Variables

**`.env.local`** — never committed.

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

---

## Key Next.js 16 Patterns Used

- **`useParams<{ id: string }>()`** — dynamic route params in Client Components
- **`"use client"`** — added only to components that use hooks, event handlers, or browser APIs
- **Turbopack** — default in v16, no flags needed
- **`keepMounted`** on `TabsContent` — keeps panel in DOM after first activation
- **`middleware.ts`** at project root — runs on Edge runtime, intercepts `/dashboard` requests before they reach the page
