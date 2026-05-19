"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2, X, Mail } from "lucide-react"

interface AuthModalProps {
  onSuccess: () => void
  onDismiss: () => void
  subtitle?: string
  mode?: "signin" | "upgrade"
}

type Step = "main" | "otp" | "sent"

export function AuthModal({ onSuccess, onDismiss, subtitle, mode = "signin" }: AuthModalProps) {
  const [step, setStep] = useState<Step>("main")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleGoogle() {
    setLoading(true)
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined
    if (mode === "upgrade") {
      await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
    } else {
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })
    }
  }

  async function handleSendOtp() {
    if (!email.trim()) return
    setLoading(true)
    setError("")

    if (mode === "upgrade") {
      // Convert anonymous → real user: send magic link to confirm email ownership
      const { error } = await supabase.auth.updateUser(
        { email: email.trim() },
        { emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined },
      )
      if (error) {
        // Email already belongs to an existing account — fall back to OTP sign-in
        if (error.message.toLowerCase().includes("already")) {
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: false },
          })
          setLoading(false)
          if (otpError) { setError(otpError.message); return }
          setStep("otp")
          return
        }
        setLoading(false)
        setError(error.message)
        return
      }
      setLoading(false)
      setStep("sent")
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      })
      setLoading(false)
      if (error) { setError(error.message); return }
      setStep("otp")
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) return
    setLoading(true)
    setError("")
    const token = otp.trim()
    const emailVal = email.trim()

    // "email" = existing user sign-in, "signup" = new user confirmation
    let { error } = await supabase.auth.verifyOtp({ email: emailVal, token, type: "email" })
    if (error) {
      const { error: signupError } = await supabase.auth.verifyOtp({ email: emailVal, token, type: "signup" })
      error = signupError
    }

    setLoading(false)
    if (error) { setError(error.message); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onDismiss}>
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border bg-card p-6 shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>

        {step === "main" && (
          <>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Sign in to Lumina</h2>
              <p className="text-sm text-muted-foreground">
                {subtitle ?? "Get 3 more free documents and save this one to your account."}
              </p>
            </div>

            <div className="space-y-3">
              <Button className="w-full gap-2" onClick={handleGoogle} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : (
                  <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                disabled={loading}
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                variant="outline"
                className="mx-auto flex gap-2 w-48"
                onClick={handleSendOtp}
                disabled={loading || !email.trim()}
              >
                {loading
                  ? <><Loader2 className="size-4 animate-spin" /><span>Sending…</span></>
                  : <><span>{mode === "upgrade" ? "Send magic link" : "Send code"}</span><Send className="size-4" /></>
                }
              </Button>
            </div>
          </>
        )}

        {step === "otp" && (
          <>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </p>
            </div>

            <div className="space-y-3">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                disabled={loading}
                autoFocus
                className="text-center tracking-widest text-lg font-mono"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleVerifyOtp} disabled={loading || otp.length < 6}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify"}
              </Button>
              <button
                onClick={() => { setStep("main"); setOtp(""); setError("") }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Use a different email
              </button>
            </div>
          </>
        )}

        {step === "sent" && (
          <>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Check your inbox</h2>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to{" "}
                <span className="font-medium text-foreground">{email}</span>. Click it to create your account.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">The link expires in 10 minutes.</p>
            </div>
            <button
              onClick={() => { setStep("main"); setEmail(""); setError("") }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  )
}
