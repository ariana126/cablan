# Installable App (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cablan installable on Android and iOS home screens, opening standalone, with no service worker.

**Architecture:** A static web app manifest and icons under `frontend/public/` (copied verbatim to the build root by `angular.json`'s `public` asset glob), linked from `src/index.html` with the iOS meta tags; nginx serves the manifest with the right type and `no-cache`.

**Tech Stack:** Angular 21 (`@angular/build:application`), Vitest + jsdom, nginx 1.27-alpine.

**Spec:** `docs/superpowers/specs/2026-11-17-installable-pwa-design.md`

## Global Constraints

- No service worker, no `@angular/pwa`, no `@angular/service-worker`.
- `name` and `short_name`: `کابلان`; `lang: "fa"`, `dir: "rtl"`; `start_url: "/"`, `scope: "/"`; `display: "standalone"`.
- `theme_color` and `background_color`: `#fcf9f4` (`mat-sys-surface` light). `<meta name="theme-color">` is `#fcf9f4` for `(prefers-color-scheme: light)` and `#15130f` for `(prefers-color-scheme: dark)`.
- Manifest link carries `crossorigin="use-credentials"` (staging is behind Authelia).
- Icons generated from `frontend/public/logo.jpeg` with an established image tool (no hand-rolled image code); padded onto `#fcf9f4`. The maskable icon keeps the logo inside the central 80% safe zone.
- Only `frontend/` files change, all through the `frontend-engineer` agent.

## Review Focus

1. **Staging behind Authelia:** the manifest request must send cookies; without `crossorigin="use-credentials"` it gets a 302 to the login and installability fails silently. Pinned by the index.html spec in Task 2.
2. **Production MIME type:** if nginx serves `.webmanifest` as `application/octet-stream`, some browsers ignore it. Pinned by the `curl -I` check on the production image in Task 2.
3. **A stale manifest after a rename or icon change:** the manifest must be `Cache-Control: no-cache`. Same `curl -I` check.
4. **A broken icon path:** every `src` in the manifest must exist under `public/` and have the size it declares. Pinned by the manifest spec in Task 1.
5. **A cropped maskable icon on Android:** the logo must sit in the safe zone. Checked by eye at maskable.app, or in DevTools' maskable preview, in Task 2.

---

### Task 1: Manifest and icons

**Files:**
- Create: `frontend/public/manifest.webmanifest`
- Create: `frontend/public/icons/icon-192.png` (192×192), `icon-512.png` (512×512), `icon-maskable-512.png` (512×512), `apple-touch-icon.png` (180×180)
- Test: `frontend/src/app/pwa-manifest.spec.ts` (or wherever `frontend/CLAUDE.md` puts app-wide specs)

**Interfaces:**
- Produces: the manifest at `/manifest.webmanifest`, and `/icons/apple-touch-icon.png`, for Task 2 to link.

- [ ] **Step 1: Write the failing spec.** It reads `public/manifest.webmanifest` from disk and parses it as JSON. It asserts every Global Constraints manifest value exactly, then:
  - `icons` contains `{src:"icons/icon-192.png", sizes:"192x192", type:"image/png", purpose:"any"}`;
  - the same for `icon-512.png` at `512x512`;
  - `{src:"icons/icon-maskable-512.png", sizes:"512x512", type:"image/png", purpose:"maskable"}`;
  - for each icon, the file exists under `public/` and its PNG header's width × height matches `sizes` (bytes 16–23 of the IHDR chunk; no image library needed).
- [ ] **Step 2: Run the frontend unit tests.** Expected: FAIL, because the manifest is missing.
- [ ] **Step 3: Generate the four PNGs and write the manifest.** Use relative icon `src`s, as above.
- [ ] **Step 4: Run the frontend unit tests.** Expected: PASS.

### Task 2: Link it from index.html and serve it correctly

**Files:**
- Modify: `frontend/src/index.html` (the `<head>`)
- Modify: `frontend/nginx/default.conf.template`
- Test: extend Task 1's spec, or a sibling spec, to read `src/index.html`

**Interfaces:**
- Consumes: `manifest.webmanifest` and `icons/apple-touch-icon.png` from Task 1.

- [ ] **Step 1: Write the failing spec.** It parses `src/index.html` with `DOMParser`. It asserts:
  - `link[rel=manifest]` has `href="manifest.webmanifest"` and `crossorigin="use-credentials"`;
  - there are two `meta[name=theme-color]` tags with the media queries and colours from Global Constraints;
  - `link[rel=apple-touch-icon]` has `href="icons/apple-touch-icon.png"`;
  - `meta[name=apple-mobile-web-app-capable]` is `content="yes"`;
  - `meta[name=apple-mobile-web-app-title]` is `content="کابلان"`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Add the tags to `index.html`.** Keep the file's comment style: say why `use-credentials` is there.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Add a `location ~* \.webmanifest$` block to nginx.** It sets `Cache-Control "no-cache"` and the `application/manifest+json` type (`default_type` inside `types {}`, or whatever the image's `mime.types` lacks). Add a comment saying why, beside the `index.html` block.
- [ ] **Step 6: Verify on the production image.** Run `make frontend/build-prod`, run that image, and `curl -I /manifest.webmanifest`. Expected: `200`, `Content-Type: application/manifest+json` and `Cache-Control: no-cache`. `curl -I /icons/icon-512.png` should give `200 image/png`.
- [ ] **Step 7: Check installability in a browser.** Against the dev server, Chrome DevTools → Application → Manifest should list no installability errors. Check the maskable preview too.
- [ ] **Step 8: Run the cheap checks locally.** `make format`, `make lint`, `make lint-styles` and the frontend unit tests should all be green. Run `make fix-violations` first if needed. The full guardrails run goes through the wip-branch CI (`CLAUDE.local.md`), done by the orchestrator.
- [ ] **Step 9: Leave changes uncommitted.** The orchestrator commits after CI is green.
