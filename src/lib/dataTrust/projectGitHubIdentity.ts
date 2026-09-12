export interface ProjectGitHubIdentityFields {
  githubRepositoryId: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
}

function cleanIdentityPart(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

const GITHUB_COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const GITHUB_CANONICAL_COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function isGitHubCommitSha(value: string | null | undefined): boolean {
  return typeof value === "string" && GITHUB_COMMIT_SHA_PATTERN.test(value.trim());
}

export function normalizeGitHubCommitForStorage(
  value: string | null | undefined,
  canonicalCandidates: readonly (string | null | undefined)[] = [],
): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;

  // Keep invalid legacy/user-entered values lossless. They are treated as
  // unverified by read-model comparisons instead of being silently discarded.
  if (!isGitHubCommitSha(normalized)) return normalized;

  const abbreviated = normalized.toLowerCase();
  const canonical = canonicalCandidates.find((candidate) => {
    const candidateValue = candidate?.trim().toLowerCase() ?? "";
    return (
      GITHUB_CANONICAL_COMMIT_SHA_PATTERN.test(candidateValue) &&
      candidateValue.startsWith(abbreviated)
    );
  });

  return canonical?.trim().toLowerCase() ?? abbreviated;
}

/**
 * A GitHub identity is useful only as a complete tuple. Partial values are
 * discarded so local snapshots and sync rows cannot point at an ambiguous
 * external repository.
 */
export function normalizeProjectGitHubIdentity(
  githubRepositoryId: string | null | undefined,
  githubOwner: string | null | undefined,
  githubRepo: string | null | undefined,
): ProjectGitHubIdentityFields {
  const normalized = {
    githubRepositoryId: cleanIdentityPart(githubRepositoryId),
    githubOwner: cleanIdentityPart(githubOwner),
    githubRepo: cleanIdentityPart(githubRepo),
  };

  if (
    !normalized.githubRepositoryId ||
    !normalized.githubOwner ||
    !normalized.githubRepo
  ) {
    return {
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    };
  }

  return normalized;
}
