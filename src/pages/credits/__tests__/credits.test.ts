import { describe, expect, it } from "vitest";

import { TEAM_MEMBERS, initialsOf } from "../team";

describe("TEAM_MEMBERS", () => {
  it("lists exactly the four Plumbers of UTS members", () => {
    expect(TEAM_MEMBERS.map((m) => m.name)).toEqual([
      "Bo Zhao",
      "Chi Sum Lau",
      "Eunkwang Shin",
      "Jadyn Braganza",
    ]);
  });

  it("assigns Bachelor of IT only to Chi Sum Lau, Master of AI to the rest", () => {
    for (const member of TEAM_MEMBERS) {
      const expected = member.name === "Chi Sum Lau" ? "Bachelor of IT" : "Master of AI";
      expect(member.degree, member.name).toBe(expected);
    }
  });

  it("points every member at a canonical LinkedIn profile URL", () => {
    const linkedinByName: Record<string, string> = {
      "Bo Zhao": "https://www.linkedin.com/in/bo-zhao-334550364/",
      "Chi Sum Lau": "https://www.linkedin.com/in/chi-sum-grace-lau-008950245/",
      "Eunkwang Shin": "https://www.linkedin.com/in/gracefullight/",
      "Jadyn Braganza": "https://www.linkedin.com/in/jadyn-braganza/",
    };

    for (const member of TEAM_MEMBERS) {
      expect(member.linkedin, member.name).toBe(linkedinByName[member.name]);
      const url = new URL(member.linkedin);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("www.linkedin.com");
      expect(url.pathname.startsWith("/in/")).toBe(true);
    }
  });

  it("has unique names and unique LinkedIn URLs", () => {
    expect(new Set(TEAM_MEMBERS.map((m) => m.name)).size).toBe(TEAM_MEMBERS.length);
    expect(new Set(TEAM_MEMBERS.map((m) => m.linkedin)).size).toBe(TEAM_MEMBERS.length);
  });
});

describe("initialsOf", () => {
  it("derives initials from the first and last name parts", () => {
    expect(initialsOf("Bo Zhao")).toBe("BZ");
    expect(initialsOf("Chi Sum Lau")).toBe("CL");
    expect(initialsOf("Eunkwang Shin")).toBe("ES");
    expect(initialsOf("Jadyn Braganza")).toBe("JB");
  });

  it("handles a single name and surrounding whitespace", () => {
    expect(initialsOf("Madonna")).toBe("M");
    expect(initialsOf("  bo   zhao  ")).toBe("BZ");
  });

  it("returns an empty string for an empty name", () => {
    expect(initialsOf("")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });
});
