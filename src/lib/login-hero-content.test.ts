import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_HERO_DESCRIPTION,
  DEFAULT_LOGIN_HERO_FEATURES,
  DEFAULT_LOGIN_HERO_HEADING,
  normalizeLoginHeroFeatures,
  resolveLoginHeroContent,
} from "./login-hero-content";

describe("resolveLoginHeroContent", () => {
  it("uses defaults when empty / unset", () => {
    const r = resolveLoginHeroContent({});
    expect(r.heading).toBe(DEFAULT_LOGIN_HERO_HEADING);
    expect(r.description).toBe(DEFAULT_LOGIN_HERO_DESCRIPTION);
    expect(r.features).toEqual(DEFAULT_LOGIN_HERO_FEATURES);
  });

  it("hides features when array is empty", () => {
    const r = resolveLoginHeroContent({ features: [] });
    expect(r.features).toEqual([]);
  });

  it("keeps custom heading and features", () => {
    const r = resolveLoginHeroContent({
      heading: "  Hello  ",
      description: "World",
      features: [{ title: "A", description: "B" }, { title: "", description: "skip" }],
    });
    expect(r.heading).toBe("Hello");
    expect(r.description).toBe("World");
    expect(r.features).toEqual([{ title: "A", description: "B" }]);
  });
});

describe("normalizeLoginHeroFeatures", () => {
  it("caps at 3 and coerces fields", () => {
    const raw = [
      { title: "1", description: "a" },
      { title: "2", description: "b" },
      { title: "3", description: "c" },
      { title: "4", description: "d" },
      null,
      { title: 9 },
    ];
    expect(normalizeLoginHeroFeatures(raw)).toEqual([
      { title: "1", description: "a" },
      { title: "2", description: "b" },
      { title: "3", description: "c" },
    ]);
  });
});
