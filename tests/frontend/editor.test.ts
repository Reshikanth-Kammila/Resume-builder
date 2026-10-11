import { describe, expect, it, vi } from "vitest";
import { api, ApiError, contentSignature, moveItem } from "../../lib/api";
import type { Resume } from "../../lib/types";

describe("editor identity and save semantics", () => {
  it("reorders items without changing IDs or mutating the original", () => {
    const entries = [{ id: "first" }, { id: "second" }, { id: "third" }];
    expect(moveItem(entries, 0, 2)).toEqual([
      { id: "second" },
      { id: "third" },
      { id: "first" },
    ]);
    expect(entries[0].id).toBe("first");
    expect(moveItem(entries, 0, -1)).toBe(entries);
  });
  it("ledger updates do not create a spurious autosave", () => {
    const resume: Resume = {
      name: "Test Candidate",
      headline: "",
      contacts: [],
      sections: [],
      ledger: [],
    };
    expect(contentSignature(resume)).toBe(
      contentSignature({
        ...resume,
        ledger: [
          {
            text: "Test Candidate",
            source: "DOCX",
            source_id: "name",
            revision_id: null,
          },
        ],
      }),
    );
    expect(contentSignature(resume)).not.toBe(
      contentSignature({ ...resume, name: "Confirmed edit" }),
    );
  });
  it("surfaces conflict errors instead of reporting a successful save", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ detail: "The master changed in another window." }),
            { status: 409 },
          ),
        ),
    );
    await expect(
      api("/master", { method: "PUT", body: "{}" }),
    ).rejects.toMatchObject({
      status: 409,
      message: "The master changed in another window.",
    });
    vi.unstubAllGlobals();
  });
  it("handles network failures without fake results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Not ready", { status: 503 })),
    );
    try {
      await api("/exports");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as Error).message).toContain("local server is unavailable");
    }
    vi.unstubAllGlobals();
  });
});
