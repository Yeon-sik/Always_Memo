export interface ProjectGitHubIdentityFields {
  githubRepositoryId: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
}

function cleanIdentityPart(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
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
