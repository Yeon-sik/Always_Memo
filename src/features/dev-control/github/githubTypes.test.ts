import { describe, expect, it } from "vitest";

import { getRemoteVerificationState } from "./githubTypes";

describe("GitHub remote verification state", () => {
  const remoteHead = "a".repeat(40);

  it.each([
    ["verified-latest", remoteHead, remoteHead, null],
    ["verified-latest", remoteHead, remoteHead.slice(0, 7), null],
    ["changed-since-verification", remoteHead, "b".repeat(40), null],
    ["no-verification", remoteHead, null, null],
    ["no-verification", remoteHead, "not-a-sha", null],
    ["remote-error", remoteHead, remoteHead, "network failed"],
  ])("returns %s without changing Project state", (expected, remote, verified, error) => {
    expect(getRemoteVerificationState(remote, verified, error)).toBe(expected);
  });

  it("treats a missing remote HEAD as a remote error when verification exists", () => {
    expect(getRemoteVerificationState(null, remoteHead)).toBe("remote-error");
  });
});
