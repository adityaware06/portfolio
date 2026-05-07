import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { fetchGithubRepos, pickRepos } from "./githubUtils.js";

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="live-clock" role="timer" aria-live="polite" aria-atomic="true">
      <span className="live-clock__date">{dateStr}</span>
      <span className="live-clock__time">{timeStr}</span>
    </div>
  );
}

const NAV_LINKS = [
  { href: "#about", label: "About" },
  { href: "#experience", label: "Experience" },
  { href: "#abi", label: "ABI" },
  { href: "#skills", label: "Skills" },
  { href: "#projects", label: "GitHub" },
  { href: "#education", label: "Education" },
  { href: "#achievements", label: "Awards" },
  { href: "#contact", label: "Contact" },
];

function useHeaderScroll() {
  useEffect(() => {
    const header = document.querySelector(".site-header");
    const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

function useScrollSpy(profileReady) {
  useEffect(() => {
    if (!profileReady) return;
    const sections = document.querySelectorAll("main section[id]");
    const navLinks = document.querySelectorAll(".site-nav a[href^='#']");
    if (!sections.length || !navLinks.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
          });
        });
      },
      { rootMargin: "-18% 0px -52% 0px", threshold: 0 }
    );

    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [profileReady]);
}

function markInViewVisible() {
  document.querySelectorAll(".reveal, .reveal--child").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) el.classList.add("is-visible");
  });
}

function useReveal(profile, projectCards) {
  useLayoutEffect(() => {
    if (!profile) return;
    markInViewVisible();
  }, [profile, projectCards]);

  useEffect(() => {
    if (!profile) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("is-visible");
        });
      },
      { rootMargin: "0px 0px 0px 0px", threshold: 0.01 }
    );

    const observeAll = () => {
      document.querySelectorAll(".reveal, .reveal--child").forEach((el) => {
        io.observe(el);
      });
    };

    observeAll();
    const id = requestAnimationFrame(() => {
      observeAll();
      markInViewVisible();
    });
    const t = window.setTimeout(markInViewVisible, 250);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
      io.disconnect();
    };
  }, [profile, projectCards]);
}

function SectionHead({ kicker, title, id }) {
  return (
    <div className="section-head">
      <span className="section-kicker">{kicker}</span>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

function ProjectCard({ project }) {
  const stars =
    project.stars == null || project.stars === "" ? null : (
      <span className="meta">{String(project.stars)} ★</span>
    );
  const lang = project.language ? <span className="meta">{project.language}</span> : null;

  return (
    <article className="project-card glass-card reveal reveal--child">
      <header>
        <h3>
          <a href={project.url} target="_blank" rel="noopener noreferrer">
            {project.name}
          </a>
        </h3>
        <div className="meta-group">
          {lang}
          {stars}
        </div>
      </header>
      <p>{project.description}</p>
      {project.topics?.length > 0 && (
        <div className="topics">
          {project.topics.slice(0, 5).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
    </article>
  );
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectCards, setProjectCards] = useState([]);
  const [projectsStatus, setProjectsStatus] = useState("");
  const [projectsStatusClass, setProjectsStatusClass] = useState("loading");

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setMenuOpen((o) => !o);
  }, []);

  useHeaderScroll();
  useScrollSpy(!!profile);
  useReveal(profile, projectCards);

  useEffect(() => {
    const raw = import.meta.env.BASE_URL || "/portfolio/";
    const base = raw.endsWith("/") ? raw : `${raw}/`;
    const urls = [`${base}data/profile.json`, "/portfolio/data/profile.json"];

    const tryFetch = (i) => {
      if (i >= urls.length) {
        setLoadError("Could not load profile data.");
        return;
      }
      fetch(urls[i], { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load profile");
          return res.json();
        })
        .then((data) => {
          setProfile(data);
          const m = data.meta || {};
          if (m.siteTitle) document.title = m.siteTitle;
          const desc = document.querySelector('meta[name="description"]');
          if (desc && m.siteDescription) desc.setAttribute("content", m.siteDescription);
        })
        .catch(() => tryFetch(i + 1));
    };

    tryFetch(0);
  }, []);

  useEffect(() => {
    if (!profile) return;

    let cancelled = false;
    const manual = profile.projectsManual || [];
    const username = profile.github?.username || "";

    setProjectsStatus("Loading GitHub repositories…");
    setProjectsStatusClass("loading");

    (async () => {
      const result = await fetchGithubRepos(username);
      if (cancelled) return;

      let cards = [];
      if (result.ok && result.repos.length) {
        cards = pickRepos(result.repos, profile);
        setProjectsStatus(`Showing ${cards.length} public repositories (via GitHub API).`);
        setProjectsStatusClass("");
      } else if (result.ok && !result.repos.length) {
        setProjectsStatus("No public repositories returned for this user. Showing fallback links from configuration.");
        setProjectsStatusClass("");
        cards = manual.slice();
      } else {
        setProjectsStatusClass("banner");
        const rateLimited = result.status === 403;
        setProjectsStatus(
          rateLimited
            ? "GitHub API rate-limited this browser session. Showing configured fallback projects — try again later or open your profile on GitHub."
            : "Could not load GitHub repositories from the API. Showing fallback projects from site configuration."
        );
        cards = manual.slice();
      }

      if (!cards.length) cards = manual.slice();
      setProjectCards(cards);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    document.querySelector(".site-header")?.classList.toggle("menu-open", menuOpen);
  }, [menuOpen]);

  if (loadError) {
    return (
      <>
        <LiveClock />
        <div className="wrap" style={{ padding: "4rem 0" }}>
          <p className="banner">{loadError}</p>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <LiveClock />
        <div className="wrap" style={{ padding: "4rem 0" }}>
          <p className="loading">Loading portfolio…</p>
        </div>
      </>
    );
  }

  const p = profile.person;
  const initials = p.avatarInitials || p.name.slice(0, 2).toUpperCase();
  const statData = [
    { k: "Experience", v: "2.9+ yrs" },
    { k: "Location", v: p.location || "—" },
    { k: "Employer", v: "Amdocs" },
    { k: "Focus", v: "ETL · BI" },
  ];

  const githubHref = p.links?.find((l) => l.label === "GitHub")?.url || "https://github.com/adityaware";
  const year = new Date().getFullYear();

  const certs = profile.certifications || [];

  return (
    <>
      <LiveClock />
      <div className="page-bg" aria-hidden="true">
        <div className="page-bg__grid" />
        <span className="orb orb--1" />
        <span className="orb orb--2" />
        <span className="orb orb--3" />
      </div>

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="wrap header-inner">
          <a href="#home" className="brand" onClick={closeMenu}>
            <span className="brand-mark">{initials}</span>
            <span>{p.name}</span>
          </a>

          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="nav-list"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={toggleMenu}
          >
            <span className="nav-toggle__bar" aria-hidden="true" />
            <span className="nav-toggle__bar" aria-hidden="true" />
            <span className="nav-toggle__bar" aria-hidden="true" />
          </button>

          <nav className={`site-nav ${menuOpen ? "is-open" : ""}`} aria-label="Primary">
            <ul id="nav-list">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href} onClick={closeMenu}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="wrap">
        <section className="hero section reveal" id="home" aria-labelledby="hero-title">
          <div className="hero-grid">
            <div>
              <p className="eyebrow">Data engineering &amp; BI</p>
              <h1 id="hero-title">{p.name}</h1>
              <p className="role-chips" aria-label="Target roles">
                {(p.targetRoles || []).map((role) => (
                  <span key={role} className="role-chip">
                    {role}
                  </span>
                ))}
              </p>
              <p className="tagline">{p.tagline}</p>
              <div className="actions">
                {(p.links || []).map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    className={link.label === "Email" ? "btn btn-primary" : "btn btn-ghost"}
                    rel="noopener noreferrer"
                    target={link.url.startsWith("http") ? "_blank" : undefined}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <aside className="hero-card glass-card" aria-label="Highlights">
              <h2>At a glance</h2>
              <div className="stat-row">
                {statData.map((s) => (
                  <div key={s.k} className="stat">
                    <strong>{s.v}</strong>
                    <span>{s.k}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="section reveal" id="about" aria-labelledby="about-heading">
          <SectionHead kicker="Profile" title="About" id="about-heading" />
          <div className="prose">
            {(profile.about || []).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>

        <section className="section reveal" id="experience" aria-labelledby="exp-heading">
          <SectionHead kicker="Work" title="Experience" id="exp-heading" />
          <div className="timeline">
            {(profile.experience || []).map((job) => (
              <article key={job.role + job.period} className="job glass-card">
                <header>
                  <h3>{job.role}</h3>
                  <span className="company">{job.company}</span>
                  <span className="period">{job.period}</span>
                </header>
                <ul>
                  {(job.bullets || []).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {profile.featuredProject && (
          <section className="section reveal" id="abi" aria-labelledby="abi-heading">
            <SectionHead kicker="Spotlight" title="Featured project" id="abi-heading" />
            <article className="feature-project glass-card">
              <header className="feature-head">
                <h3>{profile.featuredProject.title}</h3>
                <div className="topics">
                  {(profile.featuredProject.tags || []).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </header>
              <ul className="feature-list">
                {(profile.featuredProject.bullets || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </article>
          </section>
        )}

        <section className="section reveal" id="skills" aria-labelledby="skills-heading">
          <SectionHead kicker="Toolkit" title="Technical skills" id="skills-heading" />
          <div className="skill-grid">
            {(profile.skills || []).map((cat) => (
              <article key={cat.category} className="skill-card glass-card">
                <h3>{cat.category}</h3>
                <ul>
                  {(cat.items || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {certs.length > 0 && (
          <section className="section reveal" id="certs" aria-labelledby="certs-heading">
            <SectionHead kicker="Credentials" title="Certifications" id="certs-heading" />
            <ul className="list-plain">
              {certs.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="section reveal" id="projects" aria-labelledby="projects-heading">
          <SectionHead kicker="Code" title="GitHub projects" id="projects-heading" />
          <p className="prose github-intro">
            Public repositories from your GitHub profile load here automatically. If the API rate-limits, fallback cards
            from configuration are shown.
          </p>
          <div id="projects-status" className={projectsStatusClass || undefined} role="status" aria-live="polite">
            {projectsStatus}
          </div>
          <div className="project-grid">
            {projectCards.map((proj) => (
              <ProjectCard key={proj.name + proj.url} project={proj} />
            ))}
          </div>
        </section>

        <section className="section reveal" id="education" aria-labelledby="edu-heading">
          <SectionHead kicker="Academics" title="Education" id="edu-heading" />
          <ul className="edu-list">
            {(profile.education || []).map((e) => (
              <li key={e.degree + e.period} className="edu-item glass-card">
                <strong>{e.degree}</strong> — {e.school}{" "}
                <span className="edu-meta">
                  {e.period}
                  {e.detail ? ` · ${e.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="section reveal" id="achievements" aria-labelledby="ach-heading">
          <SectionHead kicker="Highlights" title="Achievements" id="ach-heading" />
          <ul className="achievement-list">
            {(profile.achievements || []).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>

        <section className="section reveal section--contact" id="contact" aria-labelledby="contact-heading">
          <SectionHead kicker="Hello" title="Contact" id="contact-heading" />
          <div className="split">
            <div className="prose">
              <p>
                Open to ETL Developer, Data Analyst, and Data Engineer roles. Prefer email for first contact.
              </p>
              <ul className="list-plain">
                <li>
                  <a href={`mailto:${p.email}`}>
                    Email: {p.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${String(p.phone).replace(/\s/g, "")}`}>Phone: {p.phone}</a>
                </li>
                <li>
                  <a href={githubHref} target="_blank" rel="noopener noreferrer">
                    GitHub: {githubHref.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              </ul>
            </div>
            <div className="hero-card glass-card">
              <h2>Declaration</h2>
              <p className="muted-small">
                I hereby declare that the information provided above is true to the best of my knowledge and belief.
              </p>
              <p className="muted-small">
                <strong>Place:</strong> Pune
              </p>
              <p className="muted-small">
                <strong>{p.name}</strong>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-row">
          <span>
            © {year} {p.name}
          </span>
          <div className="footer-links">
            {(p.links || []).map((link) => (
              <a
                key={link.label}
                href={link.url}
                target={link.url.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
