(function () {
  "use strict";

  function el(tag, className, html) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHero(profile) {
    const p = profile.person;
    document.getElementById("brand-initials").textContent = p.avatarInitials || p.name.slice(0, 2).toUpperCase();
    document.getElementById("brand-name").textContent = p.name;
    document.getElementById("hero-title").textContent = p.name;

    const chips = document.getElementById("role-chips");
    chips.innerHTML = "";
    (p.targetRoles || []).forEach((role) => {
      chips.appendChild(el("span", "role-chip", escapeHtml(role)));
    });

    document.getElementById("hero-tagline").textContent = p.tagline || "";

    const actions = document.getElementById("hero-actions");
    actions.innerHTML = "";
    (p.links || []).forEach((link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.className = link.label === "Email" ? "btn btn-primary" : "btn btn-ghost";
      a.textContent = link.label;
      a.rel = "noopener noreferrer";
      if (link.url.startsWith("http")) a.target = "_blank";
      actions.appendChild(a);
    });

    const stats = document.getElementById("hero-stats");
    stats.innerHTML = "";
    const statData = [
      { k: "Experience", v: "2.9+ yrs" },
      { k: "Location", v: p.location || "—" },
      { k: "Employer", v: "Amdocs" },
      { k: "Focus", v: "ETL · BI" },
    ];
    statData.forEach((s) => {
      const d = el("div", "stat");
      d.innerHTML = `<strong>${escapeHtml(s.v)}</strong><span>${escapeHtml(s.k)}</span>`;
      stats.appendChild(d);
    });
  }

  function renderAbout(profile) {
    const body = document.getElementById("about-body");
    body.innerHTML = "";
    (profile.about || []).forEach((para) => {
      body.appendChild(el("p", "", escapeHtml(para)));
    });
  }

  function renderExperience(profile) {
    const mount = document.getElementById("experience-body");
    mount.innerHTML = "";
    (profile.experience || []).forEach((job) => {
      const art = el("article", "job");
      const header = el("header");
      header.innerHTML = `
        <h3>${escapeHtml(job.role)}</h3>
        <span class="company">${escapeHtml(job.company)}</span>
        <span class="period">${escapeHtml(job.period)}</span>`;
      art.appendChild(header);
      const ul = document.createElement("ul");
      (job.bullets || []).forEach((b) => {
        const li = document.createElement("li");
        li.textContent = b;
        ul.appendChild(li);
      });
      art.appendChild(ul);
      mount.appendChild(art);
    });
  }

  function renderFeatured(profile) {
    const fp = profile.featuredProject;
    const mount = document.getElementById("featured-body");
    if (!fp) {
      mount.remove();
      return;
    }
    const tags = (fp.tags || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("");
    const bullets = (fp.bullets || [])
      .map((b) => `<li>${escapeHtml(b)}</li>`)
      .join("");
    mount.innerHTML = `
      <header class="feature-head">
        <h3>${escapeHtml(fp.title)}</h3>
        <div class="topics">${tags}</div>
      </header>
      <ul class="feature-list">${bullets}</ul>`;
  }

  function renderSkills(profile) {
    const mount = document.getElementById("skills-body");
    mount.innerHTML = "";
    (profile.skills || []).forEach((cat) => {
      const card = el("article", "skill-card");
      const h = document.createElement("h3");
      h.textContent = cat.category;
      card.appendChild(h);
      const ul = document.createElement("ul");
      (cat.items || []).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
      });
      card.appendChild(ul);
      mount.appendChild(card);
    });
  }

  function renderCerts(profile) {
    const list = profile.certifications || [];
    const section = document.getElementById("certs");
    const body = document.getElementById("certs-body");
    if (!list.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    body.innerHTML = "";
    list.forEach((c) => {
      const li = document.createElement("li");
      li.textContent = c;
      body.appendChild(li);
    });
  }

  function mapRepoToCard(repo) {
    return {
      name: repo.name,
      description: repo.description || "No description provided.",
      url: repo.html_url,
      language: repo.language || "",
      stars: repo.stargazers_count,
      topics: repo.topics || [],
    };
  }

  async function fetchGithubRepos(cfg) {
    const username = (cfg.github && cfg.github.username) || "";
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

  function pickRepos(rawRepos, cfg) {
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
    const merged = pinnedList.concat(rest);
    return merged.slice(0, max).map(mapRepoToCard);
  }

  function renderProjectCards(target, cards) {
    target.innerHTML = "";
    cards.forEach((p) => {
      const stars =
        p.stars == null || p.stars === ""
          ? ""
          : `<span class="meta">${escapeHtml(String(p.stars))} ★</span>`;
      const lang = p.language ? `<span class="meta">${escapeHtml(p.language)}</span>` : "";
      const topics = (p.topics || [])
        .slice(0, 5)
        .map((t) => `<span>${escapeHtml(t)}</span>`)
        .join("");
      const topicBlock = topics ? `<div class="topics">${topics}</div>` : "";
      const card = el("article", "project-card");
      card.innerHTML = `
        <header>
          <h3><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.name)}</a></h3>
          <div class="meta-group">${lang}${stars}</div>
        </header>
        <p>${escapeHtml(p.description)}</p>
        ${topicBlock}`;
      target.appendChild(card);
    });
  }

  async function renderProjects(profile) {
    const status = document.getElementById("projects-status");
    const body = document.getElementById("projects-body");
    const manual = profile.projectsManual || [];

    status.textContent = "Loading GitHub repositories…";
    const result = await fetchGithubRepos(profile);
    let cards = [];

    if (result.ok && result.repos.length) {
      cards = pickRepos(result.repos, profile);
      status.textContent = `Showing ${cards.length} public repositories (via GitHub API).`;
    } else if (result.ok && !result.repos.length) {
      status.textContent = "No public repositories returned for this user. Showing fallback links from configuration.";
      cards = manual.slice();
    } else {
      status.className = "banner";
      const rateLimited = result.status === 403;
      status.textContent = rateLimited
        ? "GitHub API rate-limited this browser session. Showing configured fallback projects — try again later or open your profile on GitHub."
        : "Could not load GitHub repositories from the API. Showing fallback projects from site configuration.";
      cards = manual.slice();
    }

    if (!cards.length) cards = manual.slice();
    renderProjectCards(body, cards);
  }

  function renderEducation(profile) {
    const mount = document.getElementById("education-body");
    mount.innerHTML = "";
    (profile.education || []).forEach((e) => {
      const li = el("li", "edu-item");
      const detail = e.detail ? ` · ${escapeHtml(e.detail)}` : "";
      li.innerHTML = `<strong>${escapeHtml(e.degree)}</strong> — ${escapeHtml(e.school)} <span class="edu-meta">${escapeHtml(e.period)}${detail}</span>`;
      mount.appendChild(li);
    });
  }

  function renderAchievements(profile) {
    const mount = document.getElementById("achievements-body");
    mount.innerHTML = "";
    (profile.achievements || []).forEach((a) => {
      const li = document.createElement("li");
      li.textContent = a;
      mount.appendChild(li);
    });
  }

  function renderContact(profile) {
    const p = profile.person;
    const links = document.getElementById("contact-links");
    links.innerHTML = "";
    const items = [
      { label: "Email", href: `mailto:${p.email}`, text: p.email },
      { label: "Phone", href: `tel:${String(p.phone).replace(/\s/g, "")}`, text: p.phone },
      { label: "GitHub", href: p.links.find((l) => l.label === "GitHub")?.url || "https://github.com/adityaware", text: "github.com/adityaware" },
    ];
    items.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = `${item.label}: ${item.text}`;
      if (item.href.startsWith("http")) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      li.appendChild(a);
      links.appendChild(li);
    });
    document.getElementById("signature-line").innerHTML = `<strong>${escapeHtml(p.name)}</strong>`;
  }

  function renderFooter(profile) {
    const y = new Date().getFullYear();
    document.getElementById("footer-copy").textContent = `© ${y} ${profile.person.name}`;
    const fl = document.getElementById("footer-links");
    fl.innerHTML = "";
    (profile.person.links || []).forEach((link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.textContent = link.label;
      if (link.url.startsWith("http")) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      fl.appendChild(a);
    });
  }

  function applyMeta(profile) {
    const m = profile.meta || {};
    if (m.siteTitle) document.title = m.siteTitle;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && m.siteDescription) desc.setAttribute("content", m.siteDescription);
  }

  async function init() {
    const res = await fetch("data/profile.json", { cache: "no-store" });
    if (!res.ok) {
      document.getElementById("projects-status").textContent = "Failed to load profile.json.";
      return;
    }
    const profile = await res.json();
    applyMeta(profile);
    renderHero(profile);
    renderAbout(profile);
    renderExperience(profile);
    renderFeatured(profile);
    renderSkills(profile);
    renderCerts(profile);
    renderEducation(profile);
    renderAchievements(profile);
    renderContact(profile);
    renderFooter(profile);
    await renderProjects(profile);
  }

  init();
})();
