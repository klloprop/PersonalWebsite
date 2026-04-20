/**
 * github.ts — GitHub API integration for content editing.
 *
 * Reads and writes markdown files in the repository via the GitHub REST API.
 * After writes, optionally triggers a Vercel deploy hook to rebuild the site.
 *
 * Required environment variables:
 *   GITHUB_TOKEN        — Fine-grained PAT with Contents read/write permission
 *   GITHUB_OWNER        — Repository owner (e.g. "myuser")
 *   GITHUB_REPO         — Repository name (e.g. "my-website")
 *   GITHUB_BRANCH       — Branch to commit to (default: "main")
 *   GITHUB_PATH_PREFIX  — Subdirectory prefix if the Astro project is not at repo root (e.g. "adorable-accretion")
 *   VERCEL_DEPLOY_HOOK  — Vercel deploy hook URL (optional, triggers rebuild)
 */

function getConfig() {
	return {
		token: import.meta.env.GITHUB_TOKEN as string,
		owner: import.meta.env.GITHUB_OWNER as string,
		repo: import.meta.env.GITHUB_REPO as string,
		branch: (import.meta.env.GITHUB_BRANCH as string) || 'main',
		pathPrefix: (import.meta.env.GITHUB_PATH_PREFIX as string) || '',
		deployHook: import.meta.env.VERCEL_DEPLOY_HOOK as string | undefined,
	};
}

/** Prepend the repo subdirectory prefix to a project-relative path. */
function repoPath(projectPath: string): string {
	const { pathPrefix } = getConfig();
	return pathPrefix ? `${pathPrefix}/${projectPath}` : projectPath;
}

function apiUrl(path: string): string {
	const { owner, repo } = getConfig();
	return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
}

function headers(): Record<string, string> {
	const { token } = getConfig();
	return {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github.v3+json',
		'Content-Type': 'application/json',
		'X-GitHub-Api-Version': '2022-11-28',
	};
}

/**
 * Read a file from the repository.
 * Returns the UTF-8 content and the SHA (needed for updates).
 */
export async function readFile(
	path: string,
): Promise<{ content: string; sha: string } | null> {
	const { branch } = getConfig();
	const fullPath = repoPath(path);
	const url = `${apiUrl(fullPath)}?ref=${encodeURIComponent(branch)}`;
	const res = await fetch(url, { headers: headers() });

	if (res.status === 404) return null;
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`GitHub API error ${res.status}: ${text}`);
	}

	const data = await res.json();
	const content = Buffer.from(data.content, 'base64').toString('utf-8');
	return { content, sha: data.sha };
}

/**
 * Create or update a file in the repository.
 * Pass `sha` when updating an existing file (prevents accidental overwrites).
 */
export async function writeFile(
	path: string,
	content: string,
	message: string,
	sha?: string,
): Promise<{ sha: string; path: string }> {
	const { branch } = getConfig();
	const body: Record<string, string> = {
		message,
		content: Buffer.from(content, 'utf-8').toString('base64'),
		branch,
	};
	if (sha) body.sha = sha;

	const fullPath = repoPath(path);
	const res = await fetch(apiUrl(fullPath), {
		method: 'PUT',
		headers: headers(),
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`GitHub API error ${res.status}: ${text}`);
	}

	const data = await res.json();
	return { sha: data.content.sha, path: data.content.path };
}

/**
 * Delete a file from the repository.
 */
export async function deleteFile(
	path: string,
	message: string,
	sha: string,
): Promise<void> {
	const { branch } = getConfig();
	const fullPath = repoPath(path);
	const res = await fetch(apiUrl(fullPath), {
		method: 'DELETE',
		headers: headers(),
		body: JSON.stringify({ message, sha, branch }),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`GitHub API error ${res.status}: ${text}`);
	}
}

/**
 * Trigger a Vercel deploy hook to rebuild the site.
 * Returns true if the hook was triggered successfully, false if no hook is configured.
 */
export async function triggerDeploy(): Promise<boolean> {
	const { deployHook } = getConfig();
	if (!deployHook) return false;

	const res = await fetch(deployHook, { method: 'POST' });
	return res.ok;
}
