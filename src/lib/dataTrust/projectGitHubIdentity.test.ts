import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  isGitHubCommitSha,
  normalizeGitHubCommitForStorage,
  normalizeProjectGitHubIdentity,
} from "./projectGitHubIdentity";

const IDENTITY_CONSTRAINT_NAME = "projects_github_identity_complete";

describe("Project GitHub identity data trust", () => {
  it("normalizes partial identity tuples to the unlinked state", () => {
    expect(normalizeProjectGitHubIdentity("42", "octo", null)).toEqual({
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    });
    expect(normalizeProjectGitHubIdentity("42", "octo", "repo")).toEqual({
      githubRepositoryId: "42",
      githubOwner: "octo",
      githubRepo: "repo",
    });
  });

  it("accepts only 7 to 40 hexadecimal commit values", () => {
    expect(isGitHubCommitSha("a".repeat(7))).toBe(true);
    expect(isGitHubCommitSha("a".repeat(40))).toBe(true);
    expect(isGitHubCommitSha("a".repeat(6))).toBe(false);
    expect(isGitHubCommitSha("not-a-sha")).toBe(false);
  });

  it("keeps the SQL identity constraint in the schema and migration", () => {
    const schema = readFileSync(
      resolve(process.cwd(), "supabase/schema.sql"),
      "utf8",
    );
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260912110000_add_github_repository_identity_constraint_to_projects.sql",
      ),
      "utf8",
    );

    for (const sql of [schema, migration]) {
      expect(sql).toContain(IDENTITY_CONSTRAINT_NAME);
      expect(sql).toContain(
        "github_repository_id is null and github_owner is null and github_repo is null",
      );
      expect(sql).toContain(
        "github_repository_id is not null and github_owner is not null and github_repo is not null",
      );
    }
  });

  it("resolves an abbreviated commit to a canonical observed SHA", () => {
    const canonical = "a".repeat(40);
    expect(normalizeGitHubCommitForStorage(canonical.slice(0, 7), [canonical])).toBe(
      canonical,
    );
    expect(normalizeGitHubCommitForStorage("legacy-value")).toBe("legacy-value");
  });
});
