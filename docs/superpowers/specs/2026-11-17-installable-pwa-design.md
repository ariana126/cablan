# Installable app (PWA) — design

Small change. Frontend only.

## Intent

Users want to install Cablan on their phones: an icon on the home screen that opens the app
without the browser's address bar and toolbars. Working offline is not part of this.

## Goals, non-goals, anti-goals

- **Goal:** Android (Chrome) and iOS (Safari) can install Cablan. Once installed it opens in its own
  window, under the name «کابلان» with the Cablan icon.
- **Non-goals:** working offline, caching, push notifications, background sync, an in-app
  "install" button.
- **Anti-goal:** anything that could leave a user on an old build after a deploy. That is why
  there's no service worker.

## Approaches

1. **Manifest only — chosen.** A web app manifest plus the iOS meta tags. Current Chrome and Safari
   both let you install a site with a manifest alone, without a service worker. There's no caching
   layer, so nothing can go stale. The cost: with no connection, the installed app shows the
   browser's offline page.
2. `@angular/pwa` (manifest plus Angular's service worker). This adds faster repeat loads and an
   in-app offline screen. The cost is an update-prompt flow, extra nginx rules and more deploy
   risk, all for offline behaviour nobody asked for. Rejected. It's still easy to add later.
3. Manifest plus a hand-written worker that only shows an offline page. It's code we'd maintain
   ourselves for a nicety nobody asked for. Rejected.

## Design

- **`frontend/public/manifest.webmanifest`**
  - `name` and `short_name`: «کابلان»
  - `lang: "fa"` and `dir: "rtl"`
  - `start_url: "/"` and `scope: "/"`
  - `display: "standalone"`
  - `theme_color` and `background_color` taken from the design-system tokens
    (`frontend/design/tokens.json`): `mat-sys-surface` light is `#fcf9f4`.
  - Icons: 192 and 512 PNG with `purpose: "any"`, plus a 512 PNG with `purpose: "maskable"`.
- **`frontend/src/index.html`** links the manifest with `crossorigin="use-credentials"`. Staging
  sits behind Authelia, and a manifest fetched without cookies would be redirected to the Authelia
  login. It also adds:
  - `<meta name="theme-color">` in two copies, one each for light and dark, with `media`
    set to `prefers-color-scheme`;
  - `<link rel="apple-touch-icon">` (180 PNG), `apple-mobile-web-app-capable` and
    `apple-mobile-web-app-title`.
- **nginx** (`frontend/nginx/default.conf.template`): serve `.webmanifest` as
  `application/manifest+json` and with `no-cache`, so a renamed app or new icon reaches installed
  copies.

## Calls I made (correct me)

- **`standalone`, not `fullscreen`.** `standalone` removes the browser's bars but keeps the phone's
  status bar (clock, battery). `fullscreen` hides that too, which suits games, not a work tool.
- **Icons are generated from `public/logo.jpeg`** (200×200): padded onto the surface colour and
  scaled up. The 512 size will be a little soft. If a larger or vector logo exists, the builder
  swaps it in and nothing else changes.
- **The light-theme surface colour is the manifest's colour.** A manifest takes only one theme
  colour. The `theme-color` meta tags in `index.html` handle dark mode on the browsers that read
  them.
- **No Gherkin scenario.** Installability is browser behaviour, not a business rule. The
  acceptance suite has no door for it.

## Left to the builder

- How to generate the icons (an established image tool, not hand-rolled code). Where the icon
  files live under `public/`.
- Whether a unit test is worth adding.
- Verification on the real build: Chrome DevTools → Application → Manifest shows no
  installability errors. `make lint-accessibility` and the other guardrails stay green.
