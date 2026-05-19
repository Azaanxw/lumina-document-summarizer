import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthModal } from '@/components/auth-modal'
import { supabase } from '@/lib/supabase'

const mockOnSuccess = jest.fn()
const mockOnDismiss = jest.fn()

function renderModal(mode: 'signin' | 'upgrade' = 'signin') {
  return render(
    <AuthModal onSuccess={mockOnSuccess} onDismiss={mockOnDismiss} mode={mode} />
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Render & initial state
// ---------------------------------------------------------------------------

it('renders sign in heading in main step', () => {
  renderModal()
  expect(screen.getByText('Sign in to Lumina')).toBeInTheDocument()
})

it('renders default subtitle when no subtitle prop provided', () => {
  renderModal()
  expect(screen.getByText(/Get 3 more free documents/)).toBeInTheDocument()
})

it('renders custom subtitle when provided', () => {
  render(<AuthModal onSuccess={mockOnSuccess} onDismiss={mockOnDismiss} subtitle="Custom sub" />)
  expect(screen.getByText('Custom sub')).toBeInTheDocument()
})

it('renders Send code button text in signin mode', () => {
  renderModal('signin')
  expect(screen.getByText('Send code')).toBeInTheDocument()
})

it('renders Send magic link button text in upgrade mode', () => {
  renderModal('upgrade')
  expect(screen.getByText('Send magic link')).toBeInTheDocument()
})

it('renders dismiss button with aria-label Dismiss', () => {
  renderModal()
  expect(screen.getByLabelText('Dismiss')).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Dismiss
// ---------------------------------------------------------------------------

it('calls onDismiss when X button is clicked', async () => {
  renderModal()
  await userEvent.click(screen.getByLabelText('Dismiss'))
  expect(mockOnDismiss).toHaveBeenCalledTimes(1)
})

it('calls onDismiss when backdrop overlay is clicked', async () => {
  renderModal()
  // The outer fixed div is the backdrop
  const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
  await userEvent.click(backdrop)
  expect(mockOnDismiss).toHaveBeenCalled()
})

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

it('calls signInWithOAuth when Google button clicked in signin mode', async () => {
  renderModal('signin')
  await userEvent.click(screen.getByRole('button', { name: /Continue with Google/i }))
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
    expect.objectContaining({ provider: 'google' })
  )
})

it('calls linkIdentity when Google button clicked in upgrade mode', async () => {
  renderModal('upgrade')
  await userEvent.click(screen.getByRole('button', { name: /Continue with Google/i }))
  expect(supabase.auth.linkIdentity).toHaveBeenCalledWith(
    expect.objectContaining({ provider: 'google' })
  )
})

// ---------------------------------------------------------------------------
// Email OTP flow
// ---------------------------------------------------------------------------

it('send button disabled when email input is empty', () => {
  renderModal()
  const sendBtn = screen.getByRole('button', { name: /Send code/i })
  expect(sendBtn).toBeDisabled()
})

it('send button enabled after typing valid email', async () => {
  renderModal()
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@test.com')
  const sendBtn = screen.getByRole('button', { name: /Send code/i })
  expect(sendBtn).not.toBeDisabled()
})

it('transitions to otp step after sendOtp succeeds in signin mode', async () => {
  jest.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({ error: null } as never)
  renderModal('signin')
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@test.com')
  await userEvent.click(screen.getByRole('button', { name: /Send code/i }))
  await waitFor(() => expect(screen.getByText('Check your email')).toBeInTheDocument())
})

it('shows error message when signInWithOtp returns error', async () => {
  jest.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
    error: { message: 'Rate limit exceeded' },
  } as never)
  renderModal('signin')
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@test.com')
  await userEvent.click(screen.getByRole('button', { name: /Send code/i }))
  await waitFor(() => expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument())
})

it('upgrade mode transitions to sent step after updateUser succeeds', async () => {
  jest.mocked(supabase.auth.updateUser).mockResolvedValueOnce({ error: null } as never)
  renderModal('upgrade')
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@test.com')
  await userEvent.click(screen.getByRole('button', { name: /Send magic link/i }))
  await waitFor(() => expect(screen.getByText('Check your inbox')).toBeInTheDocument())
})

// ---------------------------------------------------------------------------
// OTP verification
// ---------------------------------------------------------------------------

it('disables verify button when otp shorter than 6 digits', async () => {
  jest.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({ error: null } as never)
  renderModal('signin')
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@test.com')
  await userEvent.click(screen.getByRole('button', { name: /Send code/i }))
  await waitFor(() => screen.getByPlaceholderText('000000'))
  await userEvent.type(screen.getByPlaceholderText('000000'), '123')
  expect(screen.getByRole('button', { name: /Verify/i })).toBeDisabled()
})

it('calls onSuccess after successful OTP verification', async () => {
  jest.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({ error: null } as never)
  jest.mocked(supabase.auth.verifyOtp).mockResolvedValue({ error: null } as never)
  renderModal('signin')
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@test.com')
  await userEvent.click(screen.getByRole('button', { name: /Send code/i }))
  await waitFor(() => screen.getByPlaceholderText('000000'))
  await userEvent.type(screen.getByPlaceholderText('000000'), '123456')
  await userEvent.click(screen.getByRole('button', { name: /Verify/i }))
  await waitFor(() => expect(mockOnSuccess).toHaveBeenCalledTimes(1))
})

it('filters non-numeric characters from OTP input', async () => {
  jest.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({ error: null } as never)
  renderModal('signin')
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@test.com')
  await userEvent.click(screen.getByRole('button', { name: /Send code/i }))
  await waitFor(() => screen.getByPlaceholderText('000000'))
  const otpInput = screen.getByPlaceholderText('000000') as HTMLInputElement
  fireEvent.change(otpInput, { target: { value: 'abc123' } })
  expect(otpInput.value).toBe('123')
})

it('returns to main step when Use a different email is clicked in otp step', async () => {
  jest.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({ error: null } as never)
  renderModal('signin')
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@test.com')
  await userEvent.click(screen.getByRole('button', { name: /Send code/i }))
  await waitFor(() => screen.getByText('Use a different email'))
  await userEvent.click(screen.getByText('Use a different email'))
  expect(screen.getByText('Sign in to Lumina')).toBeInTheDocument()
})
