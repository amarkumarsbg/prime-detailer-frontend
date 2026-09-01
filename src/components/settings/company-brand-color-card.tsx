"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Palette, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BRAND_COLOR_PRESETS,
  DEFAULT_BRAND_PRIMARY,
  isValidHex,
  matchingBrandPresetId,
  normalizeHex,
} from "@/lib/brand-color";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings-store";

/**
 * Company brand color picker with live preview.
 * Draft updates CSS vars immediately; Save persists to appSettings.
 */
export function CompanyBrandColorCard() {
  const savedBrand = useSettingsStore((s) => s.brandPrimary);
  const setBrandPrimary = useSettingsStore((s) => s.setBrandPrimary);
  const setBrandPrimaryPreview = useSettingsStore((s) => s.setBrandPrimaryPreview);

  const [draftHex, setDraftHex] = useState(
    () => normalizeHex(savedBrand) ?? DEFAULT_BRAND_PRIMARY
  );
  const [hexInput, setHexInput] = useState(draftHex);

  useEffect(() => {
    const n = normalizeHex(savedBrand) ?? DEFAULT_BRAND_PRIMARY;
    setDraftHex(n);
    setHexInput(n);
  }, [savedBrand]);

  useEffect(() => {
    setBrandPrimaryPreview(draftHex);
    return () => {
      setBrandPrimaryPreview(null);
    };
  }, [draftHex, setBrandPrimaryPreview]);

  const selectedPresetId = matchingBrandPresetId(draftHex);
  const isDirty =
    (normalizeHex(draftHex) ?? "") !== (normalizeHex(savedBrand) ?? DEFAULT_BRAND_PRIMARY);

  const setDraft = (raw: string) => {
    const n = normalizeHex(raw);
    if (!n) return;
    setDraftHex(n);
    setHexInput(n);
  };

  const handleHexBlur = () => {
    if (!isValidHex(hexInput)) {
      toast.error("Invalid color", {
        description: "Use #RGB or #RRGGBB (e.g. #059669).",
      });
      setHexInput(draftHex);
      return;
    }
    setDraft(hexInput);
  };

  const handleSave = () => {
    if (!setBrandPrimary(draftHex)) {
      toast.error("Invalid color");
      return;
    }
    toast.success("Brand color saved", {
      description: `Company theme is now ${normalizeHex(draftHex)}.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Company Brand Color
        </CardTitle>
        <p className="text-sm text-muted-foreground pt-1">
          This is the company-wide accent color. It applies to all branches unless a
          branch-specific override is set later. Changes are previewed live.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 max-w-2xl">
        <div className="space-y-2">
          <Label>Quick Presets</Label>
          <div className="flex flex-wrap gap-2.5">
            {BRAND_COLOR_PRESETS.map((p) => {
              const selected = selectedPresetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={selected}
                  onClick={() => setDraft(p.hex)}
                  className={cn(
                    "size-9 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-foreground scale-110 shadow-sm"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: p.hex }}
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Custom Color</Label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border shadow-sm">
              <span
                className="absolute inset-0"
                style={{ backgroundColor: draftHex }}
                aria-hidden
              />
              <input
                type="color"
                value={draftHex}
                onChange={(e) => setDraft(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Pick custom brand color"
              />
            </label>
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Hex code
              </p>
              <Input
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onBlur={handleHexBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleHexBlur();
                  }
                }}
                className="h-9 w-[8.5rem] font-mono text-sm uppercase"
                spellCheck={false}
                maxLength={7}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Live Preview</Label>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-4">
            <Button type="button" size="sm">
              Primary Button
            </Button>
            <Badge
              variant="outline"
              className="border-primary text-primary"
            >
              Outline Badge
            </Badge>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <span
                className="size-2 rounded-full bg-primary"
                aria-hidden
              />
              Link Text
            </button>
            <Input
              readOnly
              value="Focus ring sample"
              className="h-9 max-w-[11rem] focus-visible:ring-ring"
            />
          </div>
        </div>

        <Button type="button" onClick={handleSave} disabled={!isDirty}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
