"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildApiUrl } from "@/lib/api-base";
import {
  Wrench,
  ArrowLeft,
  ArrowRight,
  Mail,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

type Step = "email" | "sent";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [delivery, setDelivery] = useState<"email" | "dev-console" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = (await res.json()) as {
        data?: {
          ok?: boolean;
          message?: string;
          passwordResetDelivery?: "dev-console";
        } | null;
        error?: { message?: string } | null;
      };
      if (!res.ok || body.error) {
        setError(body.error?.message ?? "Something went wrong. Try again.");
        setLoading(false);
        return;
      }
      setDelivery(body.data?.passwordResetDelivery ?? "email");
      setInfoMessage(
        typeof body.data?.message === "string"
          ? body.data.message
          : "If an account exists for this email, we've sent password reset instructions. Please check your inbox and spam folder."
      );
      setStep("sent");
    } catch {
      setError("Network error — is the API running?");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-700">
        {/* Animated background shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-cyan-400/15 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04] bg-grid-light" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <Wrench className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Prime Detailers
            </span>
          </div>

          <div className="space-y-8 max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
              Don&apos;t worry,
              <br />
              <span className="text-emerald-200">we&apos;ve got you.</span>
            </h2>
            <p className="text-emerald-100/80 text-lg leading-relaxed">
              Account recovery is quick and secure. You&apos;ll be back to
              managing your business in no time.
            </p>

            <div className="grid grid-cols-1 gap-4 pt-2">
              {[
                {
                  icon: Mail,
                  title: "Email Verification",
                  desc: "Secure link sent directly to your inbox",
                },
                {
                  icon: KeyRound,
                  title: "Reset in Seconds",
                  desc: "Choose a new password and you're back",
                },
                {
                  icon: ShieldCheck,
                  title: "Account Protected",
                  desc: "Your data stays safe throughout the process",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.07] backdrop-blur-sm border border-white/10 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 shrink-0">
                    <feature.icon className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{feature.title}</p>
                    <p className="text-emerald-200/70 text-sm mt-0.5">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-emerald-200/50 text-sm">
            &copy; {new Date().getFullYear()} Prime Detailers. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-12 lg:hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-lg shadow-primary/25">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Prime Detailers
            </span>
          </div>

          {/* Back to login */}
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to sign in</span>
          </Link>

          {step === "email" ? (
            <>
              <div className="space-y-2 mb-8">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-6">
                  <KeyRound className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Forgot your password?
                </h1>
                <p className="text-muted-foreground">
                  No worries. Enter the email associated with your account and
                  we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="h-11 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 px-4 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl text-sm font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending link...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Send reset link
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div
                className={
                  delivery === "dev-console"
                    ? "flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/35 mx-auto mb-6"
                    : "flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto mb-6"
                }
              >
                <CheckCircle2
                  className={
                    delivery === "dev-console"
                      ? "w-8 h-8 text-amber-600 dark:text-amber-400"
                      : "w-8 h-8 text-emerald-600 dark:text-emerald-400"
                  }
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
                {delivery === "dev-console" ? "Backend link — not email" : "Request received"}
              </h1>
              <p
                className={
                  delivery === "dev-console"
                    ? "text-foreground mb-4 text-sm leading-relaxed px-1 text-left rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/30 py-3 px-3"
                    : "text-muted-foreground mb-4 text-sm leading-relaxed px-1"
                }
              >
                {infoMessage}
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Address used:
              </p>
              <p className="text-sm font-medium text-foreground bg-slate-100 dark:bg-slate-800 inline-block px-4 py-2 rounded-xl mb-8">
                {email}
              </p>

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Need a different account?
                </p>
                <Button
                  variant="outline"
                  className="rounded-xl h-11 px-6"
                  onClick={() => {
                    setStep("email");
                    setEmail("");
                    setError(null);
                    setInfoMessage("");
                    setDelivery(null);
                  }}
                >
                  Try a different email
                </Button>
              </div>

            </div>
          )}

          <p className="text-center text-xs text-muted-foreground/60 mt-10 lg:hidden">
            Prime Detailers v1.0 &middot; Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}
