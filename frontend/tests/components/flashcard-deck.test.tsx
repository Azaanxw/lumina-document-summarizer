import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlashcardDeck } from '@/components/flashcard-deck'
import * as api from '@/lib/api'

jest.mock('@/lib/api', () => ({
  generateCards: jest.fn(),
  clearFlashcardsCache: jest.fn(),
}))

const MOCK_CARDS: api.Flashcard[] = [
  { question: 'What is photosynthesis?', answer: 'The process by which plants make food.' },
  { question: 'What is mitosis?', answer: 'Cell division resulting in two identical cells.' },
]

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

it('shows skeleton loading state when no initialCards provided and fetch is pending', () => {
  jest.mocked(api.generateCards).mockReturnValue(new Promise(() => {}))
  render(<FlashcardDeck documentId="doc-1" />)
  // Skeleton is rendered as animated divs — presence of the loading container
  expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
})

it('does not show skeleton when initialCards are provided', () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Successful render with initialCards
// ---------------------------------------------------------------------------

it('renders first card question when initialCards provided', () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  expect(screen.getByText('What is photosynthesis?')).toBeInTheDocument()
})

it('shows card counter as 1 / 2 for two initial cards', () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  expect(screen.getByText('1 / 2')).toBeInTheDocument()
})

it('shows Question label on front face', () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  expect(screen.getByText('Question')).toBeInTheDocument()
})

it('shows click to reveal answer hint', () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  expect(screen.getByText('Click to reveal answer')).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

it('prev button is disabled on the first card', () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  expect(screen.getByRole('button', { name: /Prev/i })).toBeDisabled()
})

it('next button is disabled on the last card', async () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  await userEvent.click(screen.getByRole('button', { name: /Next/i }))
  expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled()
})

it('clicking Next advances to second card and shows counter 2 / 2', async () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  await userEvent.click(screen.getByRole('button', { name: /Next/i }))
  expect(screen.getByText('2 / 2')).toBeInTheDocument()
  expect(screen.getByText('What is mitosis?')).toBeInTheDocument()
})

it('restart button resets to first card', async () => {
  render(<FlashcardDeck documentId="doc-1" initialCards={MOCK_CARDS} />)
  await userEvent.click(screen.getByRole('button', { name: /Next/i }))
  expect(screen.getByText('2 / 2')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Restart/i }))
  expect(screen.getByText('1 / 2')).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Fetch from API
// ---------------------------------------------------------------------------

it('calls generateCards with documentId when no initialCards', async () => {
  jest.mocked(api.generateCards).mockResolvedValueOnce({ flashcards: MOCK_CARDS })
  render(<FlashcardDeck documentId="doc-fetch" />)
  await waitFor(() => expect(api.generateCards).toHaveBeenCalledWith('doc-fetch'))
})

it('renders cards returned by generateCards API call', async () => {
  jest.mocked(api.generateCards).mockResolvedValueOnce({ flashcards: MOCK_CARDS })
  render(<FlashcardDeck documentId="doc-1" />)
  await waitFor(() => expect(screen.getByText('What is photosynthesis?')).toBeInTheDocument())
})

it('shows error message when generateCards rejects', async () => {
  jest.mocked(api.generateCards).mockRejectedValueOnce(new Error('Network error'))
  render(<FlashcardDeck documentId="doc-1" />)
  await waitFor(() => expect(screen.queryByText(/Failed to load flashcards/i)).toBeInTheDocument())
})

it('shows empty state when API returns empty array', async () => {
  jest.mocked(api.generateCards).mockResolvedValueOnce({ flashcards: [] })
  render(<FlashcardDeck documentId="doc-1" />)
  await waitFor(() => expect(screen.getByText('No flashcards generated.')).toBeInTheDocument())
})
