import { CopyEmail } from "@/components/copy-email"

export function SiteFooter() {
  return (
    <footer className="mt-auto pt-3 pb-2 text-center text-xs text-muted-foreground border-t w-full">
      <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
      <span className="mx-2 select-none text-muted-foreground/40">|</span>
      <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
      <span className="mx-2 select-none text-muted-foreground/40">|</span>
      <CopyEmail email="support@luminasummarizer.com" label="Support" />
    </footer>
  )
}
