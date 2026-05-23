import type { Metadata } from "next"
import Link from "next/link"
import { CopyEmail } from "@/components/copy-email"

export const metadata: Metadata = {
  title: "Privacy Policy — Lumina",
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <Link href="/" className="text-muted-foreground hover:text-foreground text-xs">← Back to Lumina</Link>

      <h1 className="mt-6 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-1 text-muted-foreground">Last updated: May 2026</p>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">What we collect</h2>
        <p>When you use Lumina, we collect:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Your email address and name if you sign in via Google or email</li>
          <li>The PDF files you upload, temporarily stored to generate study materials</li>
          <li>AI-generated content (summaries, quizzes, flashcards) associated with your documents</li>
          <li>Basic usage data (document count, rate limit records) to operate the service</li>
        </ul>
        <p>If you use Lumina without signing in, we create an anonymous session. Anonymous sessions and their documents are automatically deleted after 30 days.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">How we use your data</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>To generate summaries, quizzes, flashcards, and answers from your PDFs</li>
          <li>To store your documents so you can access them across sessions</li>
          <li>To enforce usage limits and prevent abuse</li>
        </ul>
        <p>We do not sell your data to third parties.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Third-party services</h2>
        <p className="text-muted-foreground">Lumina uses the following services to operate:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><span className="text-foreground">OpenAI</span> — generates vector embeddings from your document text to power search</li>
          <li><span className="text-foreground">Google Gemini</span> — generates summaries, quizzes, flashcards, and answers</li>
          <li><span className="text-foreground">AWS S3</span> — stores your uploaded PDF files</li>
          <li><span className="text-foreground">Supabase</span> — stores document metadata, user accounts, and authentication</li>
          <li><span className="text-foreground">Sentry</span> — captures application errors to help us fix bugs</li>
        </ul>
        <p className="text-muted-foreground">Your document content is sent to OpenAI and Google Gemini solely to provide the service features. It is not used to train their models under our agreements.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Data retention</h2>
        <p className="text-muted-foreground">Your documents and account data are retained until you delete your account. You can delete your account and all associated data at any time from the dashboard. Anonymous sessions are deleted after 30 days of inactivity.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Contact</h2>
        <p className="text-muted-foreground">For any privacy questions, contact us at <CopyEmail email="support@luminasummarizer.com" />.</p>
      </section>
    </main>
  )
}
