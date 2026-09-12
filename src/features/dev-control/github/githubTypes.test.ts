import { describe, expect, it } from "vitest";

import { getRemoteVerificationState } from "./githubTypes";

describe("GitHub remote verification state", () => {
  it.each([
    ["verified-latest", "head", "head", null],
    ["changed-since-verification", "new-head", "old-head", null],
    ["no-verification", "head", null, null],
    ["remote-error", "head", "head", "network failed"],
  ])("returns %s without changing Project state", (expected, remote, verified, error) => {
    expect(getRemoteVerificationState(remote, verified, error)).toBe(expected);
  });

  it("treats a missing remote HEAD as a remote error when verification exists", () => {
    expect(getRemoteVerificationState(null, "verified-sha")).toBe("remote-error");
  });
});
