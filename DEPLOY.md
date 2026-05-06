# GitHub Pages (fix blank site)

This app is **React + Vite**. The files GitHub must serve are the **built output** in the **`docs/`** folder, not the repo root.

1. Repo → **Settings** → **Pages**
2. **Build and deployment** → **Source**: *Deploy from a branch*
3. **Branch**: `main` → **Folder**: **`/docs`** (not `/ (root)`)
4. Save. Wait 1–2 minutes, then open: `https://adityaware06.github.io/portfolio/`

If **Folder** is left on **`/ (root)`**, the root `index.html` loads `/src/main.jsx`, which does not exist on Pages → **blank page**.

After any change to `src/` or `public/data/profile.json`, run **`npm run build`** and commit the updated **`docs/`** folder before pushing.
