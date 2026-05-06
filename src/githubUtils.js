export function mapRepoToCard(repo) {
  return {
    name: repo.name,
    description: repo.description || "No description provided.",
    url: repo.html_url,
    language: repo.language || "",
    stars: repo.stargazers_count,
    topics: repo.topics || [],
  };
}

export async function fetchGithubRepos(username) {
  if (!username) return { ok: false, repos: [] };
  const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=30&type=owner`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return { ok: false, status: res.status, repos: [] };
    const data = await res.json();
    return { ok: true, repos: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, repos: [] };
  }
}

export function pickRepos(rawRepos, cfg) {
  const gh = cfg.github || {};
  let repos = rawRepos.slice();
  if (gh.excludeForks) repos = repos.filter((r) => !r.fork);
  const pinned = gh.pinnedRepos || [];
  const max = gh.maxRepos || 6;
  const pinnedSet = new Set(pinned);
  const pinnedList = [];
  const rest = [];
  repos.forEach((r) => {
    if (pinnedSet.has(r.name)) pinnedList.push(r);
    else rest.push(r);
  });
  pinnedList.sort((a, b) => pinned.indexOf(a.name) - pinned.indexOf(b.name));
  return pinnedList.concat(rest).slice(0, max).map(mapRepoToCard);
}
