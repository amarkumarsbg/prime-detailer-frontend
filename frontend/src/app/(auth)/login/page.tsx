"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { Label } from "@/components/ui/label";
import {
  Wrench,
  Eye,
  EyeOff,
  ArrowRight,
  Smartphone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { LoginHeroPanel } from "@/components/shared/login-hero-panel";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { apiGet } from "@/lib/api-client";
import { applyBrandCssVars, DEFAULT_BRAND_PRIMARY } from "@/lib/brand-color";
import {
  DEFAULT_LOGIN_HERO_DESCRIPTION,
  DEFAULT_LOGIN_HERO_FEATURES,
  DEFAULT_LOGIN_HERO_HEADING,
  type LoginHeroFeature,
} from "@/lib/login-hero-content";

type PublicBranding = {
  businessName: string;
  businessLogo: string;
  brandPrimary: string;
  loginBackgroundImage: string;
  loginHeroHeading: string;
  loginHeroDescription: string;
  loginHeroFeatures: LoginHeroFeature[];
};

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<"email" | "mobile">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const login = useAuthStore((s) => s.login);
  const sendLoginOtp = useAuthStore((s) => s.sendLoginOtp);
  const verifyLoginOtp = useAuthStore((s) => s.verifyLoginOtp);
  const verifyOtpLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void apiGet<PublicBranding>("/api/public/branding")
      .then((data) => {
        if (cancelled) return;
        setBranding(data);
        applyBrandCssVars(data.brandPrimary || DEFAULT_BRAND_PRIMARY);
      })
      .catch(() => {
        /* keep default login branding if API is unreachable */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const businessName = branding?.businessName?.trim() || "Prime Detailers";
  const logoUrl = resolveUploadsPublicUrl(branding?.businessLogo);
  const loginBgUrl = resolveUploadsPublicUrl(branding?.loginBackgroundImage);
  const heroHeading = branding?.loginHeroHeading?.trim() || DEFAULT_LOGIN_HERO_HEADING;
  const heroDescription =
    branding?.loginHeroDescription?.trim() || DEFAULT_LOGIN_HERO_DESCRIPTION;
  const heroFeatures =
    branding?.loginHeroFeatures !== undefined
      ? branding.loginHeroFeatures
      : DEFAULT_LOGIN_HERO_FEATURES;

  const runMobileOtpVerify = async (code?: string) => {
    const digits = (code ?? otp).replace(/\D/g, "");
    if (digits.length !== 4 || verifyOtpLock.current) return;
    verifyOtpLock.current = true;
    setError("");
    setLoading(true);
    try {
      const success = await verifyLoginOtp(mobile, digits);
      if (success) {
        const mustChange = useAuthStore.getState().user?.mustChangePassword === true;
        window.location.assign(mustChange ? "/change-password" : "/dashboard");
      } else setError("Invalid or expired OTP, or the server could not be reached.");
    } finally {
      setLoading(false);
      verifyOtpLock.current = false;
    }
  };

  const handleSendOtp = async () => {
    if (!mobile || mobile.length < 10) {
      const msg = "Enter a valid 10-digit mobile number";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError("");
    setLoading(true);
    const result = await sendLoginOtp(mobile);
    setLoading(false);
    if (result.ok) {
      setOtp("");
      setOtpSent(true);
      if (result.delivery === "sms") {
        toast.success("OTP sent to your mobile number");
      } else if (result.devDemoCode) {
        toast.success("Verification code", {
          description: `Use code ${result.devDemoCode} to sign in.`,
          duration: 12_000,
        });
      } else if (result.hint) {
        toast.warning("OTP not sent via SMS", {
          description: result.hint,
          duration: 10_000,
        });
      } else {
        toast.success("OTP ready — check SMS or server logs");
      }
    } else {
      toast.error(result.message);
      setError(result.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMethod === "mobile") {
      await runMobileOtpVerify();
    } else {
      setError("");
      setLoading(true);
      const success = await login(email, password);
      setLoading(false);
      if (success) {
        const mustChange = useAuthStore.getState().user?.mustChangePassword === true;
        window.location.assign(mustChange ? "/change-password" : "/dashboard");
      } else {
        setError("Invalid email or password");
      }
    }
  };

  const BrandMark = ({
    className,
    iconClassName,
  }: {
    className?: string;
    iconClassName?: string;
  }) =>
    logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className={className ?? "h-10 w-10 rounded-xl object-cover"} />
    ) : (
      <div
        className={
          className ??
          "flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm"
        }
      >
        <Wrench className={iconClassName ?? "w-5 h-5"} />
      </div>
    );

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <LoginHeroPanel
        className="hidden lg:flex lg:w-[55%] min-h-screen"
        businessName={businessName}
        logoUrl={logoUrl}
        backgroundUrl={loginBgUrl}
        heading={heroHeading}
        description={heroDescription}
        features={heroFeatures}
      />

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-8">
        <div className="flex-1 flex flex-col justify-center w-full max-w-[420px] mx-auto">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <BrandMark
              className={
                logoUrl
                  ? "h-10 w-10 rounded-xl object-cover shadow-lg"
                  : "flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-lg shadow-primary/25"
              }
              iconClassName="w-5 h-5 text-primary-foreground"
            />
            <span className="text-lg font-semibold tracking-tight">{businessName}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-8">
            Welcome back
          </h1>

          {loginMethod === "email" ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex flex-col gap-2">
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
                    className="h-11 rounded-xl bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 px-4 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-x-3">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs leading-none font-medium text-primary hover:text-primary/80 transition-colors shrink-0 whitespace-nowrap"
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

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              <button
                type="button"
                onClick={() => { setLoginMethod("mobile"); setError(""); setOtp(""); setOtpSent(false); }}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm font-medium text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                Login with Mobile OTP
              </button>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex flex-col gap-2">
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
                      placeholder="Enter your 10-digit mobile number"
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
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-x-3">
                        <Label htmlFor="otp" className="text-sm font-medium">
                          Enter OTP
                        </Label>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="text-xs leading-none font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
                        >
                          Resend OTP
                        </button>
                      </div>
                      <OtpInput
                        value={otp}
                        onChange={setOtp}
                        onComplete={(v) => void runMobileOtpVerify(v)}
                        disabled={loading}
                      />
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

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

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
        </div>

        <p className="text-center text-xs text-muted-foreground/70 mt-8 max-w-[420px] mx-auto">
          Need access? Contact your admin.
        </p>
      </div>
    </div>
  );
}
