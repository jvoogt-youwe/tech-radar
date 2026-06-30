# Youwe Tech Radar

An interactive technology radar for Youwe. It visualises the technologies, platforms,
tools and frameworks Youwe uses, trials and assesses — grouped by quadrant and ring —
straight from a single source table in Confluence.

The radar is a static front-end (D3) served by Vercel, with a small serverless
function that reads the Confluence source table and exposes it as JSON to the app.

> Built on Thoughtworks' open-source [Build Your Own Radar](https://github.com/thoughtworks/build-your-own-radar) (AGPL-3.0), adapted by Youwe to read from Confluence and to use the Youwe design-system styling.

## How it works

```
Browser ──▶ /api/radar (Vercel function) ──▶ Confluence REST API ──▶ JSON ──▶ radar (D3)
```

- **Data source** — the Confluence page _"Tech Radar – Source Table"_ holds one row per technology.
- **Proxy** — [api/radar.js](api/radar.js) fetches that page server-side (with a read-only token), parses the table and returns radar-ready JSON. The token never reaches the browser.
- **Front-end** — [src/util/factory.js](src/util/factory.js) loads `/api/radar` and renders the radar.

A browser cannot call Confluence directly (CORS + authentication), which is why the
serverless proxy exists. It also caches the response at the edge so Confluence is not
hit on every page load.

## The source table

Maintain the radar by editing the table on the Confluence source page. Columns map to
the radar as follows:

| Confluence column   | Radar field     | Notes                                              |
| ------------------- | --------------- | -------------------------------------------------- |
| Technology          | `name`          | Blip label                                         |
| Quadrant            | `quadrant`      | Techniques / Platforms / Tools / Languages & Frameworks |
| Ring                | `ring`          | Adopt / Trial / Assess / Caution                   |
| Status              | `status`        | e.g. active / candidate                            |
| Owner               | `owner`         | Owning guild / team                                |
| Review Date         | `reviewDate`    |                                                    |
| Confluence Page URL | `confluenceUrl` | Linked from the blip detail                        |
| Notes               | `description`   | Shown in the blip detail                           |
| Moved               | `isNew`         | `2` marks a blip as new this cycle                 |

Quadrant and ring names are case-insensitive and `Languages-and-Frameworks` /
`Languages & Frameworks` are treated the same. The legacy ring name **Hold** is
normalised to **Caution**.

## Environment variables

Set these in the Vercel project (Production + Preview). Only `CONFLUENCE_TOKEN` is secret.

```
CONFLUENCE_BASE_URL=https://confluence.youweagency.com
CONFLUENCE_PAGE_ID=<id of the source-table page>
CONFLUENCE_TOKEN=<read-only Confluence Personal Access Token>
```

Optional, to override the defaults:

```
RINGS='["Adopt", "Trial", "Assess", "Caution"]'
QUADRANTS='["Techniques", "Platforms", "Tools", "Languages & Frameworks"]'
GTM_ID=<Google Tag Manager id>
```

For local development put the same variables in a `.env` file (it is git-ignored).
Create the Confluence token under _Confluence → Profile → Settings → Personal Access Tokens_.

## Local development

The front-end is bundled with [webpack](https://webpack.js.org/); the `/api` route runs as a Vercel function.

```bash
npm install
npm run dev        # front-end only on http://localhost:8080 (no /api)
vercel dev         # full stack incl. /api/radar (requires the Vercel CLI + .env)
```

Use `vercel dev` when you need live Confluence data locally — `npm run dev` does not
serve the serverless function.

Other tasks:

```bash
npm run quality      # linter + unit tests
npm run build:prod   # production build into dist/
```

## Deployment

The project deploys to Vercel. Config lives in [vercel.json](vercel.json): webpack builds
the static `dist/`, and Vercel automatically serves `api/radar.js` as a serverless function.
Pushing to `main` triggers a new deployment. Remember to redeploy after changing
environment variables.

## Theming

Colours follow the Youwe Design System (neutral + primary ramps) and are defined in
[src/stylesheets/_colors.scss](src/stylesheets/_colors.scss). A navy-tinted dark mode is
applied automatically via `prefers-color-scheme` in
[src/stylesheets/_darkmode.scss](src/stylesheets/_darkmode.scss).

## Credits & licence

This project is a fork of [Build Your Own Radar](https://github.com/thoughtworks/build-your-own-radar)
by Thoughtworks and is distributed under the **AGPL-3.0** licence (see [LICENSE.md](LICENSE.md)).
