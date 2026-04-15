"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wrench,
  Eye,
  EyeOff,
  ArrowRight,
  Car,
  Gauge,
  Shield,
  Smartphone,
  Mail,
} from "lucide-react";

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<"email" | "mobile">("email");
  const [email, setEmail] = useState("rajesh.kumar@primedetailers.in");
  const [password, setPassword] = useState("password");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleSendOtp = async () => {
    if (!mobile || mobile.length < 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setOtpSent(true);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (loginMethod === "mobile") {
      if (otp === "1234") {
        const success = await login("rajesh.kumar@primedetailers.in", "password");
        if (success) window.location.assign("/dashboard");
        else setError("Could not sign in. Is the API running on port 4000?");
      } else {
        setError("Invalid OTP. Use 1234 for demo.");
      }
    } else {
      const success = await login(email, password);
      if (success) {
        window.location.assign("/dashboard");
      } else {
        setError("Invalid email or password");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-linear-to-br from-blue-600 via-indigo-600 to-violet-700">
        {/* Animated background shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-violet-400/15 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
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
              Manage your business
              <br />
              <span className="text-blue-200">smarter, not harder.</span>
            </h2>
            <p className="text-blue-100/80 text-lg leading-relaxed">
              The all-in-one platform to streamline operations, track services,
              and grow your automotive business.
            </p>

            <div className="grid grid-cols-1 gap-4 pt-2">
              {[
                {
                  icon: Car,
                  title: "Vehicle Tracking",
                  desc: "Complete service history at your fingertips",
                },
                {
                  icon: Gauge,
                  title: "Real-time Dashboard",
                  desc: "Monitor KPIs and daily operations live",
                },
                {
                  icon: Shield,
                  title: "Secure & Reliable",
                  desc: "Enterprise-grade data protection",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.07] backdrop-blur-sm border border-white/10 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 shrink-0">
                    <feature.icon className="w-5 h-5 text-blue-200" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{feature.title}</p>
                    <p className="text-blue-200/70 text-sm mt-0.5">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-blue-200/50 text-sm">
            &copy; {new Date().getFullYear()} Prime Detailers. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-blue-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-8">
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

          <div className="space-y-2 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              Enter your credentials to access your dashboard
            </p>
          </div>

          {loginMethod === "email" ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@primedetailers.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 px-4 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 px-4 pr-11 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl text-sm font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign in
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Login with Mobile */}
              <button
                type="button"
                onClick={() => { setLoginMethod("mobile"); setError(""); setOtpSent(false); }}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm font-medium text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                Login with Mobile OTP
              </button>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-sm font-medium">
                    Mobile Number
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex items-center justify-center h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm text-muted-foreground shrink-0">
                      +91
                    </div>
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="9876543210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      required
                      maxLength={10}
                      className="h-11 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 px-4 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {!otpSent ? (
                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    className="w-full h-11 rounded-xl text-sm font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
                    disabled={loading || mobile.length < 10}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending OTP...
                      </span>
                    ) : (
                      "Send OTP"
                    )}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="otp" className="text-sm font-medium">
                          Enter OTP
                        </Label>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          Resend OTP
                        </button>
                      </div>
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter 4-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        required
                        maxLength={4}
                        className="h-11 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 px-4 text-center text-lg tracking-[0.5em] font-mono transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        OTP sent to +91-{mobile.slice(0, 2)}****{mobile.slice(-2)}
                      </p>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 rounded-xl text-sm font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
                      disabled={loading || otp.length < 4}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Verifying...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Verify & Sign in
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                  </>
                )}
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Back to Email */}
              <button
                type="button"
                onClick={() => { setLoginMethod("email"); setError(""); }}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm font-medium text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Login with Email
              </button>
            </>
          )}

          <div className="mt-6 p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/40">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Demo Credentials
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/60 w-14 shrink-0">Email</span>
                <code className="text-xs bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border font-mono">
                  rajesh.kumar@primedetailers.in
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/60 w-14 shrink-0">Pass</span>
                <code className="text-xs bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border font-mono">
                  password
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/60 w-14 shrink-0">OTP</span>
                <code className="text-xs bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border font-mono">
                  1234 (any mobile)
                </code>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary font-medium hover:text-primary/80 transition-colors"
            >
              Sign up
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground/60 mt-6 lg:hidden">
            Prime Detailers v1.0 &middot; Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}
