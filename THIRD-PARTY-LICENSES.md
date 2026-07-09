# Licenties van derden

Dit bestand wordt gegenereerd door `bun run licenses`
(`packages/server/src/scripts/generate-licenses.ts`) — niet handmatig bewerken, behalve de
hierna volgende curated secties (die worden door het script zelf verzorgd, niet uit een oud
bestand overgenomen).

**Scope**: alléén productie-afhankelijkheden — devDependencies (Biome, Vitest, TypeScript,
`@types/*`, de OpenAPI-spec-validator die alleen in tests draait, enz.) landen nooit in een
gedistribueerd binary of admin-bundel en zijn daarom buiten scope. De onderstaande tabel is de
volledige transitieve productie-afhankelijkheidsboom van `packages/server`, `packages/admin` en
`packages/shared` samen, gewandeld via `bun.lock`.

## Tiptap (`@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`)

- **Gebruikt voor**: de blok-editor van het `richtext`-veldtype in de admin (stap 11).
- **Licentie**: MIT.
- **Copyright**: Tiptap GmbH.
- Alleen `richtext`-inhoud gaat door Tiptap heen; opgeslagen data blijft het eigen, originele
  blokformaat uit `packages/shared/src/richtext.ts` (zie `docs/review-notes.md`'s stap
  11-sectie) — Tiptap's eigen documentmodel wordt nooit persistent opgeslagen.
- Volledige licentietekst: zie de `yaml`/`zod`/overige MIT-pakketten in de tabel onderaan, of
  `node_modules/@tiptap/core/LICENSE` — niet apart herhaald hier (identieke MIT-tekst).

## `yaml` (npm package, gebruikt in zowel `packages/admin` als `packages/server`)

- **Gebruikt voor**: de visuele schema-builder (stap 12, client-side, `packages/admin`) — het
  destijds gebruikte `js-yaml` (server-side, alleen-lezen parsing) bleek in de praktijk geen
  werkende commentaarbehoud-API te hebben (zie `docs/review-notes.md`'s stap 12-sectie voor het
  onderzoek). `yaml` (Eemeli Aro)'s `Document`-API behoudt bestaande commentaren, sleutelvolgorde
  en citatiestijl voor elk pad dat niet wordt aangeraakt.
- **Sinds stap 14 (dependency-audit-consolidatie)**: ook `packages/server`'s eigen
  `schema/parser.ts` (het inlezen van `schema.yaml` bij het opstarten en bij `schema:check`/
  `schema:apply`) gebruikt nu dezelfde `yaml`-bibliotheek (`parse()`, alleen-lezen) in plaats van
  het losse `js-yaml` — één minder YAML-afhankelijkheid in de hele boom, en `parse()` bleek zelfs
  eenvoudiger correct te gebruiken (retourneert uniform `null` voor leeg/whitespace-only/
  alleen-commentaar-invoer, in plaats van `js-yaml`'s inconsistente mix van gooien en `undefined`
  teruggeven).
- **Licentie**: ISC (permissief, vergelijkbaar met MIT).
- **Copyright**: Eemeli Aro.

## Redoc (vendored bundle, geen npm-dependency)

- **Gebruikt voor**: de interactieve OpenAPI-viewer op `/api/docs` (stap 8) —
  `packages/server/src/openapi/vendor/redoc.standalone.js` is een **vendored bestand**, geen
  npm-dependency: het wordt met `with { type: "text" }` ingebed (zie `api/docs.ts`) en verschijnt
  daarom niet in bun.lock of de automatische tabel hieronder.
- **Licentie**: MIT.
- **Copyright**: Redocly (voorheen Rebilly).
- Bron: officiële `redoc` npm-publicatie (`redoc@2.x`, `redoc.standalone.js`); de vendored kopie
  in dit bestand komt bit-voor-bit overeen met dat gepubliceerde bestand.

## Media-adapter: `@imagemagick/magick-wasm` + embedded ImageMagick-core

- **Gebruikt voor**: on-the-fly beeldtransformaties (`GET /media/:id?w=...`, stap 6), en de
  self-check bij het opstarten (`cli/start.ts`).
- **npm-wrapper (`@imagemagick/magick-wasm`)**: Apache-2.0 — al opgenomen in de automatische
  tabel hieronder.
- **Embedded ImageMagick-core (het gecompileerde `magick.wasm`)**: **ImageMagick License**
  (een aparte, Apache-compatibele permissieve licentie — zie
  `docs/adr/002-wasm-image-library.md` §Licenties voor het onderzoek). Deze licentie **vereist
  attributie aan ImageMagick Studio LLC** bij herdistributie, wat dit bestand hierbij is: Kern CMS
  bevat gecompileerde ImageMagick-software van ImageMagick Studio LLC
  (<https://imagemagick.org>), gebruikt onder de ImageMagick License
  (<https://imagemagick.org/script/license.php>). De volledige licentietekst en bijbehorende
  NOTICE (incl. licenties van door ImageMagick zelf meegecompileerde codecs) zijn te vinden in
  `node_modules/@imagemagick/magick-wasm/NOTICE` na `bun install`, en zijn met opzet niet
  letterlijk in dit bestand gekopieerd (het NOTICE-bestand is zelf ruim 4000 regels).

## Alle productie-afhankelijkheden (automatisch gegenereerd)

| Package | Versie | Licentie |
| --- | --- | --- |
| `@hookform/resolvers` | 5.4.0 | MIT |
| `@imagemagick/magick-wasm` | 0.0.41 | Apache-2.0 |
| `@remix-run/router` | 1.23.3 | MIT |
| `@standard-schema/utils` | 0.3.0 | MIT |
| `@tanstack/query-core` | 5.101.2 | MIT |
| `@tanstack/react-query` | 5.101.2 | MIT |
| `@tiptap/core` | 3.27.1 | MIT |
| `@tiptap/extension-blockquote` | 3.27.1 | MIT |
| `@tiptap/extension-bold` | 3.27.1 | MIT |
| `@tiptap/extension-bullet-list` | 3.27.1 | MIT |
| `@tiptap/extension-code` | 3.27.1 | MIT |
| `@tiptap/extension-code-block` | 3.27.1 | MIT |
| `@tiptap/extension-document` | 3.27.1 | MIT |
| `@tiptap/extension-dropcursor` | 3.27.1 | MIT |
| `@tiptap/extension-gapcursor` | 3.27.1 | MIT |
| `@tiptap/extension-hard-break` | 3.27.1 | MIT |
| `@tiptap/extension-heading` | 3.27.1 | MIT |
| `@tiptap/extension-horizontal-rule` | 3.27.1 | MIT |
| `@tiptap/extension-italic` | 3.27.1 | MIT |
| `@tiptap/extension-link` | 3.27.1 | MIT |
| `@tiptap/extension-list` | 3.27.1 | MIT |
| `@tiptap/extension-list-item` | 3.27.1 | MIT |
| `@tiptap/extension-list-keymap` | 3.27.1 | MIT |
| `@tiptap/extension-ordered-list` | 3.27.1 | MIT |
| `@tiptap/extension-paragraph` | 3.27.1 | MIT |
| `@tiptap/extension-strike` | 3.27.1 | MIT |
| `@tiptap/extension-text` | 3.27.1 | MIT |
| `@tiptap/extension-underline` | 3.27.1 | MIT |
| `@tiptap/extensions` | 3.27.1 | MIT |
| `@tiptap/pm` | 3.27.1 | MIT |
| `@tiptap/react` | 3.27.1 | MIT |
| `@tiptap/starter-kit` | 3.27.1 | MIT |
| `@types/use-sync-external-store` | 0.0.6 | MIT |
| `fast-equals` | 5.4.0 | MIT |
| `hono` | 4.12.27 | MIT |
| `js-tokens` | 4.0.0 | MIT |
| `linkifyjs` | 4.3.3 | MIT |
| `loose-envify` | 1.4.0 | MIT |
| `orderedmap` | 2.1.1 | MIT |
| `prosemirror-changeset` | 2.4.1 | MIT |
| `prosemirror-commands` | 1.7.1 | MIT |
| `prosemirror-dropcursor` | 1.8.2 | MIT |
| `prosemirror-gapcursor` | 1.4.1 | MIT |
| `prosemirror-history` | 1.5.0 | MIT |
| `prosemirror-inputrules` | 1.5.1 | MIT |
| `prosemirror-keymap` | 1.2.3 | MIT |
| `prosemirror-model` | 1.25.9 | MIT |
| `prosemirror-schema-list` | 1.5.1 | MIT |
| `prosemirror-state` | 1.4.4 | MIT |
| `prosemirror-tables` | 1.8.5 | MIT |
| `prosemirror-transform` | 1.12.0 | MIT |
| `prosemirror-view` | 1.42.0 | MIT |
| `react` | 18.3.1 | MIT |
| `react-dom` | 18.3.1 | MIT |
| `react-hook-form` | 7.81.0 | MIT |
| `react-router` | 6.30.4 | MIT |
| `react-router-dom` | 6.30.4 | MIT |
| `rope-sequence` | 1.3.4 | MIT |
| `scheduler` | 0.23.2 | MIT |
| `use-sync-external-store` | 1.6.0 | MIT |
| `w3c-keyname` | 2.2.8 | MIT |
| `yaml` | 2.9.0 | ISC |
| `zod` | 4.4.3 | MIT |

_Gegenereerd op 2026-07-05T11:28:50.280Z uit `bun.lock` + elk pakket zijn eigen
`package.json`-`license`-veld. Bij twijfel over een specifieke licentietekst: zie
`node_modules/<package>/LICENSE` na `bun install`._
