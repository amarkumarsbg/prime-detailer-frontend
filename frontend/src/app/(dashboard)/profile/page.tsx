"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { Branch, User } from "@/types";
import { apiPatch, apiPost, apiPostForm, ApiError } from "@/lib/api-client";
import { PASSWORD_POLICY_HINT, validateStrongPassword } from "@/lib/password-policy";
import { toast } from "sonner";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { getInitials } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Phone,
  Building2,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Camera,
  CheckCircle2,
  Save,
} from "lucide-react";

type AuthSessionResponse = { accessToken: string; user: User; branch: Branch | null };

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export default function ProfilePage() {
  const { user, currentBranch, applyAuthPayload } = useAuthStore();
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");

  const [avatarUploading, setAvatarUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
  }, [user?.id, user?.name]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (JPEG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Photo must be 5 MB or smaller.");
      return;
    }
    const fd = new FormData();
    fd.append("avatar", file);
    setAvatarUploading(true);
    try {
      const payload = await apiPostForm<AuthSessionResponse>("/api/auth/me/avatar", fd);
      applyAuthPayload(payload);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload photo.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const payload = await apiPatch<AuthSessionResponse>("/api/auth/me", {
        name: name.trim(),
      });
      applyAuthPayload(payload);
      setProfileSaved(true);
      toast.success("Profile updated");
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    const strengthMsg = validateStrongPassword(newPassword);
    if (strengthMsg) {
      setPasswordError(strengthMsg);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      const payload = await apiPost<AuthSessionResponse>("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      applyAuthPayload(payload);
      setPasswordSaved(true);
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not update password.";
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!user) return null;

  const avatarSrc = resolveUploadsPublicUrl(user.avatar);

  const infoItems = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: Phone, label: "Phone", value: user.phone },
    { icon: Shield, label: "Role", value: user.role },
    { icon: Building2, label: "Branch", value: currentBranch?.name ?? "—" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="My Profile" description="Manage your account settings and preferences" />

      {/* Profile Banner */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="h-32 bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 relative">
          <div className="absolute inset-0 opacity-[0.06] bg-grid-light-sm" />
        </div>
        <CardContent className="relative px-4 sm:px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={handleAvatarFileChange}
            />
            <div className="relative group">
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarFileInputRef.current?.click()}
                className="relative rounded-full border-0 bg-transparent p-0 cursor-pointer disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={avatarUploading ? "Uploading photo" : "Change profile photo"}
              >
                <Avatar className="w-24 h-24 border-4 border-background shadow-lg pointer-events-none">
                  {avatarSrc ? (
                    <AvatarImage src={avatarSrc} alt="" className="object-cover" key={avatarSrc} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden
                >
                  {avatarUploading ? (
                    <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </span>
              </button>
            </div>
            <div className="sm:pb-1 flex-1">
              <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.role} &middot; {currentBranch?.name}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full font-medium sm:mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </div>
          </div>

          <Separator className="my-5" />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0 mt-0.5">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSave} className="space-y-5 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="profileName" className="text-sm font-medium">Full name</Label>
                  <Input
                    id="profileName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Change your photo by clicking your picture at the top (JPEG, PNG, WebP, or GIF, max 5 MB).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileEmail" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="profileEmail"
                    type="email"
                    value={user.email}
                    disabled
                    className="h-10 rounded-lg bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profilePhone" className="text-sm font-medium">Phone number</Label>
                  <Input
                    id="profilePhone"
                    type="tel"
                    value={user.phone}
                    disabled
                    className="h-10 rounded-lg bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email and phone can only be changed by an administrator.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Role</Label>
                  <Input value={user.role} disabled className="h-10 rounded-lg bg-muted" />
                  <p className="text-xs text-muted-foreground">Role can only be changed by a super admin.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Branch</Label>
                  <Input value={currentBranch?.name ?? ""} disabled className="h-10 rounded-lg bg-muted" />
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={profileSaving} className="rounded-lg">
                    {profileSaving ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Save changes
                      </span>
                    )}
                  </Button>
                  {profileSaved && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Saved successfully
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-5 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-sm font-medium">Current password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="h-10 rounded-lg pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium">New password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="h-10 rounded-lg pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword" className="text-sm font-medium">Confirm new password</Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-10 rounded-lg"
                  />
                </div>

                {newPassword.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {[
                      {
                        label: "Policy requirements",
                        met: validateStrongPassword(newPassword) === null,
                      },
                      { label: "Passwords match", met: confirmPassword.length > 0 && newPassword === confirmPassword },
                    ].map((check) => (
                      <div key={check.label} className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className={`w-3.5 h-3.5 transition-colors ${check.met ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`} />
                        <span className={check.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>

                {passwordError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{passwordError}</p>
                  </div>
                )}

                <Separator />

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={passwordSaving} className="rounded-lg">
                    {passwordSaving ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Updating...
                      </span>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                  {passwordSaved && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Password updated
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
