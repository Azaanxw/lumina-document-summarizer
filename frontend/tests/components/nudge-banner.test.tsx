import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NudgeBanner } from '@/components/nudge-banner'
import { supabase } from '@/lib/supabase'

function mockAnonymousSession() {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { is_anonymous: true } } },
    error: null,
  } as never)
}

function mockAuthenticatedSession() {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { is_anonymous: false } } },
    error: null,
  } as never)
}

// Flush all pending microtasks/promises so that state updates from async effects land
async function flushPromises() {
  await act(async () => {
    await new Promise<void>((resolve) => globalThis.queueMicrotask(resolve))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })
})

afterEach(() => {
  jest.useRealTimers()
})

// ---------------------------------------------------------------------------
// Visibility rules
// ---------------------------------------------------------------------------

it('renders nothing when analysisComplete is false', async () => {
  mockAnonymousSession()
  const { container } = render(<NudgeBanner analysisComplete={false} />)
  await flushPromises()
  await act(async () => { jest.advanceTimersByTime(20_000) })
  expect(container.firstChild).toBeNull()
})

it('renders nothing for authenticated non-anonymous user even after 15s', async () => {
  mockAuthenticatedSession()
  render(<NudgeBanner analysisComplete={true} />)
  await flushPromises()
  await act(async () => { jest.advanceTimersByTime(20_000) })
  expect(screen.queryByText(/Enjoying Lumina/i)).not.toBeInTheDocument()
})

it('not visible before 15s timer fires for anonymous user', async () => {
  mockAnonymousSession()
  render(<NudgeBanner analysisComplete={true} />)
  await flushPromises()
  await act(async () => { jest.advanceTimersByTime(14_999) })
  expect(screen.queryByText(/Enjoying Lumina/i)).not.toBeInTheDocument()
})

it('appears after 15s for anonymous user with analysis complete', async () => {
  mockAnonymousSession()
  render(<NudgeBanner analysisComplete={true} />)
  // Flush getSession promise → isAnonymous becomes true → second effect runs → setTimeout registered
  await flushPromises()
  // Now fire the 15s timeout
  await act(async () => { jest.advanceTimersByTime(15_000) })
  expect(screen.getByText(/Enjoying Lumina/i)).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Auth state change
// ---------------------------------------------------------------------------

it('hides when auth state changes to authenticated', async () => {
  const callbacks: Array<(event: string, session: unknown) => void> = []
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
    callbacks.push(cb)
    return { data: { subscription: { unsubscribe: jest.fn() } } } as never
  })
  mockAnonymousSession()

  render(<NudgeBanner analysisComplete={true} />)
  await flushPromises()
  await act(async () => { jest.advanceTimersByTime(15_000) })
  expect(screen.getByText(/Enjoying Lumina/i)).toBeInTheDocument()

  // Simulate sign-in via auth state change
  await act(async () => {
    callbacks[0]?.('SIGNED_IN', { user: { is_anonymous: false } })
  })
  expect(screen.queryByText(/Enjoying Lumina/i)).not.toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Modal interaction
// ---------------------------------------------------------------------------

it('opens AuthModal when Login / Sign Up button is clicked', async () => {
  mockAnonymousSession()
  render(<NudgeBanner analysisComplete={true} />)
  await flushPromises()
  await act(async () => { jest.advanceTimersByTime(15_000) })
  const btn = screen.getByRole('button', { name: /Login \/ Sign Up/i })
  const user = userEvent.setup({ delay: null, advanceTimers: (ms) => jest.advanceTimersByTime(ms) })
  await act(async () => { await user.click(btn) })
  expect(screen.getByText('Sign in to Lumina')).toBeInTheDocument()
})
