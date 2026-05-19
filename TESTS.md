# Tests — Lumina Document Summarizer

## Running Tests

```powershell
# Backend (from backend/ with venv activated)
.\.venv\Scripts\Activate.ps1
pytest                                    # 82 tests
pytest --cov=. --cov-report=term-missing  # with coverage

# Frontend unit/component (from frontend/)
npm test           # 55 tests
npm run test:coverage

# E2E (from frontend/ — requires both dev servers running)
npx playwright test
npx playwright test --ui   # interactive debug mode
```

---

## Backend — pytest (`backend/tests/`)

**82 tests · 0.22 s**

### `test_auth.py` (7 tests)
Tests the `get_current_user` and `require_auth` FastAPI dependencies.
- Returns `None` when no `Authorization` header is present
- Returns `None` when Supabase raises an exception
- Returns `None` when the Supabase response has no user
- Returns a valid `AuthUser` for a well-formed token
- Sets `is_anonymous=True` for anonymous Supabase sessions
- `require_auth` raises 401 when the user is `None`
- `require_auth` passes through a valid `AuthUser`

### `test_documents.py` (7 tests)
Tests `GET /documents` and `DELETE /account`.
- `GET /documents` returns 401 with no auth
- Returns the documents list and quota for a real user
- Anonymous users always get quota 1 regardless of profile
- Defaults quota to 4 when no profile row exists
- `DELETE /account` returns 401 with no auth
- Deletes all S3 files then removes the Supabase user
- Succeeds cleanly when the user has no documents

### `test_upload.py` (9 tests)
Tests `POST /upload` — quota enforcement, S3 handling, and counter tracking.
- Returns 401 with no auth
- Rejects non-PDF files with 400
- Returns 403 `quota_exceeded` when an anonymous user already has 1 document
- Returns 403 `quota_exceeded` when a real user is at their quota
- Returns 200 with `document_id` on a successful upload
- Calls `increment_documents_used` for real users
- Does not call `increment_documents_used` for anonymous users
- Returns 500 when the S3 upload fails
- Returns 500 when saving document metadata to the DB fails

### `test_process.py` (10 tests)
Tests `/process-document`, `/generate-cards`, cache-status, and cache-delete endpoints.
- `/process-document` returns cached summary/quiz immediately on cache hit
- Calls Gemini and saves the result when cache is empty
- Returns 404 when the document doesn't exist
- Returns 500 when Gemini returns `None`
- `/generate-cards` returns cached flashcards immediately on cache hit
- Calls Gemini to generate cards and saves cache on miss
- Returns 404 when document doesn't exist
- `GET /cache-status` returns correct `has_summary` / `has_flashcards` flags
- `DELETE /cache/summary` returns `{"ok": True}`
- `DELETE /cache/flashcards` returns `{"ok": True}`

### `test_ask.py` (6 tests)
Tests `POST /ask` — the RAG Q&A endpoint.
- Returns 200 with answer and citations when chunks are found
- Returns 404 when no relevant chunks match the query
- Returns 500 when `generate_answer` returns `None`
- Uses `document_id` as the rate-limit key when there is no auth
- Uses `user_id` as the rate-limit key when the user is authenticated
- Falls back to OpenAI when Gemini raises an exception

### `test_rate_limit.py` (5 tests)
Tests `check_question_rate_limit` — the in-memory 20 questions/hour rolling window.
- Allows exactly 20 requests within the hour window
- Blocks the 21st request and returns `allowed=False`
- Calculates the correct `retry_after` seconds (time until oldest request expires)
- Old timestamps outside the 1-hour window are evicted so new requests succeed
- `/ask` returns 429 with `retry_after` in the response body when rate-limited

### `test_pdf_utils.py` (6 tests)
Tests `extract_text_from_pdf` and `extract_chunks_from_pdf` using a real in-memory PDF built with PyMuPDF.
- `extract_text` returns a non-empty string for a valid PDF
- `extract_chunks` returns a list of dicts for a valid PDF
- Each chunk has `content` (str) and `metadata.page_number` (int)
- No chunk spans more than one page
- `extract_text` returns an empty string for invalid bytes
- `extract_chunks` returns an empty list for invalid bytes

### `test_s3_utils.py` (8 tests)
Tests all S3 helpers with a mocked boto3 client.
- `upload_to_s3` returns the filename on success
- `upload_to_s3` returns `None` on `ClientError`
- `download_from_s3` returns bytes on success
- `download_from_s3` returns `None` on `ClientError`
- `create_presigned_url` returns a URL string
- `create_presigned_url` returns `None` on `ClientError`
- `delete_from_s3` returns `True` on success
- `delete_from_s3` returns `False` on `ClientError`

### `test_db_utils.py` (15 tests)
Tests all `db_utils` functions with a mocked Supabase client chain.
- `get_supabase_client` raises when env vars are not set
- `save_document_metadata` returns the inserted row on success
- `get_profile` returns a dict on success
- `get_profile` returns `None` on exception
- `search_chunks` returns a list of chunks on success
- `search_chunks` returns an empty list on exception
- `save_document_chunks` inserts the correct number of rows
- `get_document_cache` returns the cache dict
- `save_document_cache` returns `True` on success
- `clear_summary_cache` nulls the `summary` and `quiz` columns
- `clear_flashcards_cache` nulls the `flashcards` column
- `get_user_document_filenames` returns a list of filename strings
- `increment_documents_used` calls the correct Supabase RPC
- `get_user_documents` returns documents ordered by creation date
- `get_document_content` returns the content string

### `test_gemini_utils.py` (6 tests)
Tests AI generation functions with mocked Gemini and OpenAI clients.
- `generate_summary_and_quiz` returns `{summary, quiz}` on Gemini success
- Falls back to OpenAI when Gemini raises an exception
- Returns `None` when both Gemini and OpenAI fail
- `generate_flashcards` returns the correct `{flashcards}` structure
- `generate_answer` returns `{answer, citations}`
- `generate_answer` includes page context in the prompt

### `test_embedding_utils.py` (3 tests)
Tests `embed_texts` with a mocked OpenAI client.
- Returns a list of 1536-dim float vectors
- Uses model `text-embedding-3-small`
- Handles batch input (multiple texts in one call)

---

## Frontend — Jest + React Testing Library (`frontend/tests/`)

**55 tests · ~5 s**

### `tests/lib/api.test.ts` (18 tests)
Tests all functions in `lib/api.ts` with a mocked `fetch` and Supabase client.
- Attaches `Authorization: Bearer <token>` header when a session exists
- Omits the auth header when no session is present
- `ensureAnonymousSession` calls `signInAnonymously` when no session exists
- `ensureAnonymousSession` skips sign-in when a session already exists
- `uploadDocument` POSTs to `/upload` and returns the document ID
- `listDocuments` returns the documents array and quota object
- `processDocument` POSTs with the correct body
- `processDocument` returns a cached result on a second call (module-level cache)
- `generateCards` POSTs and returns the flashcards array
- `clearSummaryCache` invalidates the in-memory cache and sends DELETE
- `clearFlashcardsCache` invalidates the in-memory cache and sends DELETE
- `askQuestion` POSTs and returns answer + citations
- `askQuestion` throws `RateLimitError` with a `retryAfter` value on a 429 response
- `RateLimitError` has the correct `name` and `retryAfter` properties
- `getPdfUrl` returns a URL string
- `deleteAccount` sends a DELETE request
- `lookupWord` correctly encodes special characters in the URL
- Throws a plain `Error` with the response text on any other non-OK status

### `tests/components/auth-modal.test.tsx` (15 tests)
Tests the `AuthModal` component — email OTP flow and Google OAuth, for both `signin` and `upgrade` modes.
- Renders the email input in the initial step
- Google button calls `signInWithOAuth` in `signin` mode
- Google button calls `linkIdentity` (not `signInWithOAuth`) in `upgrade` mode
- Send button is disabled when the email field is empty
- Send button is enabled after a valid email is typed
- Transitions to the OTP entry step after `signInWithOtp` succeeds
- Shows an error message when `signInWithOtp` returns an error
- Upgrade mode falls back to OTP when `updateUser` returns an "already exists" error
- Verify button is disabled when the OTP is shorter than 6 digits
- Calls `verifyOtp` with `type: "email"` on submit
- Retries `verifyOtp` with `type: "signup"` when the email type fails
- Calls `onSuccess` after a successful OTP verification
- Shows a verify error when both OTP types fail
- Filters non-numeric characters from the OTP input
- Calls `onDismiss` when the close (×) button is clicked

### `tests/components/nudge-banner.test.tsx` (6 tests)
Tests the `NudgeBanner` component — a sign-up prompt that appears 15 seconds after analysis completes for anonymous users. Uses `jest.useFakeTimers`.
- Renders nothing when `analysisComplete` is `false`
- Renders nothing for a non-anonymous authenticated user even after 15 s
- Not visible before the 15 s timer fires
- Appears after exactly 15 s for an anonymous user with analysis complete
- Hides immediately when the auth state changes to authenticated (sign-in event)
- Opens `AuthModal` when the "Login / Sign Up" button is clicked

### `tests/components/flashcard-deck.test.tsx` (16 tests)
Tests the `FlashcardDeck` component — card flipping, navigation, and API integration.
- Shows a loading skeleton when no `initialCards` are provided and the fetch is pending
- Does not show the skeleton when `initialCards` are provided
- Renders the first card's question text
- Shows the correct card counter ("1 / N")
- Flips to show the answer when the card is clicked
- Previous button is disabled on the first card
- Next button is disabled on the last card
- Clicking Next advances to the next card and resets the flip state
- Restart button resets back to the first card
- Calls `generateCards` with the correct `documentId` when no `initialCards` are given
- Shows an error state when `generateCards` rejects
- Shows an empty state when the API returns an empty array

---

## E2E — Playwright (`frontend/tests/e2e/`)

Require both dev servers running (`npm run dev` on port 3000 and uvicorn on port 8000).

### `happy-path.spec.ts`
Full upload-to-answer flow: upload a real PDF, wait for analysis, read summary/quiz, generate flashcards, flip a card, ask a question, check citation badge.

### `auth-upgrade.spec.ts`
Auth modal and nudge banner flows: sign-in link opens the modal, nudge banner appears 15 s after analysis for anonymous users, modal closes on backdrop click, successful sign-in redirects to `/dashboard`.

### `access-control.spec.ts`
Route guards: unauthenticated and anonymous users are redirected away from `/dashboard`; home page is accessible and shows the upload zone.

### `rate-limit.spec.ts`
Uses `page.route()` to mock the `/ask` endpoint. Verifies that a 429 response shows a rate-limit error in the chat UI, a 500 shows a generic error, and a 200 renders the answer text.
