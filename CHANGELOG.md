# Changelog

Alle noemenswaardige wijzigingen aan Kern CMS. Formaat losjes naar
[Keep a Changelog](https://keepachangelog.com/); versienummers volgen semver.

## 1.0.3 — 2026-07-09

Herstelt de npm-publicatiestap, die bij 1.0.2 nog crashte.

- **npm-publish faalde op `Cannot find module 'sigstore'`** — de publish-workflow
  in de publieke repo deed `npm install -g npm@latest`, wat npm in-place vervangt en
  zonder de sigstore-module achterlaat (nodig voor provenance bij OIDC-publicatie). De
  workflow gebruikt nu Node 24 met de meegebundelde npm en laat de zelf-upgrade weg.

## 1.0.2 — 2026-07-09

Herstelt een fout in de sync-workflow die 1.0.1's npm-publicatie liet mislukken.

- **Sync kopieerde `create-kern-cms` één map te diep** — de map belandde als
  `packages/create-kern-cms/create-kern-cms/` in de publieke repo, waardoor de
  npm-publish-workflow `package.json` niet vond en faalde. De staging-stap maakt nu
  alleen de parent-map aan, zodat `cp -R` de map op de juiste plek zet.

## 1.0.1 — 2026-07-09

Geen functionele wijzigingen aan het product zelf; deze release herstelt de
publicatieketen zodat een nieuwe versie automatisch in de publieke `kern-cms/kern`-repo
en op npm belandt.

- **Sync naar de publieke repo hersteld** — de sync-workflow wees naar een
  placeholder-doelrepo en verwijderde bovendien de publish-workflow in de doelrepo.
  Beide gefixt; `.github` wordt nu met rust gelaten bij het synchroniseren.
- **Installer-downloadbron gecorrigeerd** — `create-kern-cms` haalde binaries op bij de
  private repo (404 voor gebruikers) in plaats van bij `kern-cms/kern`, waar de releases
  daadwerkelijk gepubliceerd worden.

## 1.0.0 — eerste releasewaardige versie

Alle Must/Should-eisen uit `docs/functioneel-document-cms.md` §5 zijn geïmplementeerd:
schema-engine (YAML → migraties, Zod-validators, TypeScript-types), content-API (delivery +
management, filter/sort/populate/paginatie), auth (sessies + API-keys, rollen), media
(upload/transformatie/cache), drafts/publiceren/versiegeschiedenis/geplande publicatie, webhooks,
OpenAPI-documentatie, een volledige admin-UI (formuliergenerator, richtext-editor, visuele
schema-builder), en distributie als één binary per platform (Linux/macOS, x64/arm64) plus Docker.

Belangrijkste toevoegingen in deze release (stap 14, "releasewaardig maken"):
- **`kern`-CLI**: `init`/`start`/`backup`/`restore`/`types`/`migrate`/`schema check|apply` onder
  één binary, geen los `bun run`-script meer nodig in productie.
- **Geplande backups** (`BACKUP_INTERVAL_HOURS`/`BACKUP_KEEP`).
- **Multi-platform binaries** + Dockerfile (zie `docs/adr/004-multi-platform-binaries.md`).
- **`THIRD-PARTY-LICENSES.md`**, gegenereerd uit de daadwerkelijke dependency-tree.
- **Security-headers** op elke response (nosniff, referrer-policy, X-Frame-Options met
  media-uitzondering, optionele HSTS, CSP op `/admin`).
- **Laadtest** op 100.000 documenten (`docs/load-test-report.md`); p95 gecachete delivery-GET
  ruim onder de 20 ms-doelstelling.
- **Playwright-smoke-suite** (`packages/e2e`) tegen de gecompileerde binary als release-poort,
  met expliciete regressiedekking voor alle zes historische UI-bugklassen uit stap 10-12, plus een
  scenario dat een API-sleutel via de admin-UI aanmaakt en tegen de delivery-API gebruikt.
- Admin-favicon, volledige README/deployment-documentatie, release-checklist.
- **Astro-referentiefrontend** (`examples/astro-blog/`, stap 13): een volledig statische site
  tegen de delivery-API met één on-demand gerenderde conceptvoorbeeld-route, een idempotent
  seed-script en een webhook-rebuild-voorbeeld. Lighthouse 100/100/100/100 (CLS 0) op homepage,
  overzicht en detailpagina; alle CMS-integratiecode in 88 regels (`src/lib/kern.ts`).
- **Admin-UI voor API-sleutels en webhooks** (stap 13-vervolg): de eerder lege
  Instellingen/Webhooks-placeholders zijn vervangen door volwaardige beheerpagina's (sleutels
  aanmaken/intrekken met eenmalig-tonen-dialoog; webhooks aanmaken/bewerken/verwijderen,
  test-versturen, bezorgingslog) — voorheen alleen via curl te doen.
- **Media-bibliotheekpagina**: `/admin/media` was per abuis nog een lege placeholder gebleven
  (stap 10 vulde `CollectionPage`/`SingletonPage` wel, maar deze pagina niet). Vervangen door een
  volwaardig overzicht: grid met thumbnails, uploaden, alt-tekst bewerken, verwijderen, paginatie.
- **`npx create-kern-cms`**: een dunne, Node-only installer (zie `docs/publishing-create-kern-cms.md`)
  die de juiste platform-binary van GitHub Releases downloadt, de SHA-256-checksum verifieert, en
  `kern init` draait — geen los binary-downloaden/uitpakken meer nodig om te starten.

Bekende, bewust openstaande punten (zie `docs/review-notes.md` en `docs/v1.x-kandidaten.md` voor
de volledige onderbouwing):
- Idle-geheugen (180,7 MB) — doel bijgesteld naar < 200 MB (haalt dat ruim); aangewezen oorzaak
  (onvoorwaardelijke WASM-beeldbibliotheek-initialisatie bij elke start) blijft een bewuste
  fail-fast-keuze, lui-initialiseren staat genoteerd als v1.x-kandidaat.
- De gefilterde delivery-query op 100k documenten (p95 143,6 ms) gebruikt niet de optimale index;
  root cause vastgesteld, geen speculatieve indexwijziging doorgevoerd zonder verder onderzoek.
- Docker-build is in de ontwikkelomgeving van deze sessie niet daadwerkelijk uitgevoerd
  (sandbox-netwerkbeleid blokkeert Docker Hub) — vóór de eerste echte release alsnog verifiëren.
- Multi-platform-binaries: alleen linux-x64 daadwerkelijk gedraaid in deze sandbox; de overige
  vier zijn bevestigd te compileren (zie `docs/adr/004-multi-platform-binaries.md`) maar niet
  functioneel getest.
