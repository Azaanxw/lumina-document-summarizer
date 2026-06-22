import type { Metadata } from "next"
import Link from "next/link"
import { CopyEmail } from "@/components/copy-email"

export const metadata: Metadata = {
  title: "Terms of Service",
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <Link href="/" className="text-muted-foreground hover:text-foreground text-xs">← Back to Lumina</Link>

      <h1 className="mt-6 text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-1 text-muted-foreground">Last updated: May 2026</p>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Using Lumina</h2>
        <p className="text-muted-foreground">Lumina is an AI-powered PDF study tool. By using Lumina you agree to these terms. If you do not agree, do not use the service.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Acceptable use</h2>
        <p className="text-muted-foreground">You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Upload documents containing illegal content</li>
          <li>Attempt to reverse-engineer, scrape, or abuse the service</li>
          <li>Share your account with others</li>
          <li>Use the service for any purpose that violates applicable law</li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Your content</h2>
        <p className="text-muted-foreground">You retain ownership of the documents you upload. By uploading, you grant Lumina a limited licence to process them solely to provide the service. You are responsible for ensuring you have the right to upload any document you submit.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Service availability</h2>
        <p className="text-muted-foreground">Lumina is provided as-is. We do not guarantee uninterrupted availability or that AI-generated content will be accurate. Do not rely solely on Lumina&apos;s output for critical decisions.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Account termination</h2>
        <p className="text-muted-foreground">You may delete your account at any time from the dashboard. We reserve the right to suspend accounts that violate these terms.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Changes</h2>
        <p className="text-muted-foreground">We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-semibold text-base">Contact</h2>
        <p className="text-muted-foreground">Questions about these terms? Contact us at <CopyEmail email="support@luminasummarizer.com" />.</p>
      </section>
    </main>
  )
}
