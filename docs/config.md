# Configuratie

De server (`packages/server`) wordt geconfigureerd via environment-variabelen. Alle
variabelen worden op één plek ingelezen: `packages/server/src/config.ts`.

| Variabele  | Default   | Uitleg                                                                 |
| ---------- | --------- | ----------------------------------------------------------------------- |
| `PORT`     | `3000`    | TCP-poort waarop de HTTP-server luistert. Moet een positief geheel getal zijn. |
| `DATA_DIR` | `./data`  | Map waar persistente data wordt opgeslagen. Wordt aangemaakt als die nog niet bestaat. Bevat sinds stap 2 het SQLite-databasebestand `data.db` (plus WAL-bestanden `data.db-wal`/`data.db-shm`). |
| `SCHEMA_PATH` | `./schema.yaml` | Pad naar `schema.yaml`, gebruikt door `kern schema check`/`apply` (en `kern init`/`kern types`) én door de content-API (sinds stap 4) om collectie-validators te bouwen. De default is cwd-relatief — precies waar `kern init` het bestand neerzet in een verse installatiemap (stap 14). De monorepo's eigen `dev`/`schema:check`/`schema:apply`-scripts zetten dit expliciet op `../../schema.yaml` (packages/server/package.json), omdat die vanuit `packages/server` draaien tegen de schema.yaml in de projectroot. |
| `CACHE_CONTROL` | `public, max-age=0, must-revalidate` | Waarde van de `Cache-Control`-header op alle delivery-GET's (`/api/v1/content/...`), sinds stap 4. |
| `NODE_ENV` | (leeg) | Op `production` gezet: sessie- en CSRF-cookies krijgen het `Secure`-attribuut (alleen over HTTPS verstuurd). Sinds stap 5. |
| `SESSION_TTL_DAYS` | `7` | Glijdende sessieduur in dagen: elke geauthenticeerde request via een sessie verlengt `expires_at` met deze waarde. Moet een positief getal zijn. Sinds stap 5. |
| `KERN_ADMIN_EMAIL` | (leeg) | E-mailadres voor de allereerste admin-account, alleen gebruikt bij het opstarten wanneer de `users`-tabel nog leeg is. Moet samen met `KERN_ADMIN_PASSWORD` gezet zijn. Sinds stap 5. |
| `KERN_ADMIN_PASSWORD` | (leeg) | Wachtwoord voor de allereerste admin-account, zie `KERN_ADMIN_EMAIL`. Zonder deze variabelen en zonder interactieve terminal wordt er geen admin aangemaakt (waarschuwing in de log); de server start dan gewoon op — een admin kan later nog via de API of een herstart met deze env-vars worden aangemaakt. Sinds stap 5. |
| `TRUST_PROXY` | `0` | Aantal vertrouwde reverse-proxy-hops vóór Kern CMS; bepaalt waar de rate limiter (o.a. `/auth/login`) het client-IP vandaan haalt. Zie de aparte paragraaf hieronder. Sinds stap 5b, hop-aantal sinds stap 5c. |
| `MEDIA_MAX_UPLOAD_MB` | `20` | Maximale bestandsgrootte voor een media-upload (`POST /api/v1/manage/media`) in megabytes. Een groter bestand krijgt `413 Payload Too Large`. Sinds stap 6. |
| `MEDIA_MAX_SOURCE_MEGAPIXELS` | `50` | Pixelplafond (breedte × hoogte, in miljoenen pixels) voor een bronafbeelding vóórdat die getransformeerd mag worden (`GET /media/:id?w=...`) — decompressie-bom-bescherming. Een bron erboven geeft `422` en wordt niet gedecodeerd; het origineel blijft gewoon ongewijzigd op te vragen. Sinds stap 6. |
| `SCHEDULE_CHECK_INTERVAL_SECONDS` | `30` | Hoe vaak (in seconden) de interne scheduler controleert op verstreken geplande publicaties (`scheduled_publish_at`). Sinds stap 7. |
| `VERSION_THROTTLE_SECONDS` | `300` | Volgt een create/PATCH-save binnen dit aantal seconden op de vorige versie van dezelfde gebruiker, dan wordt die laatste versie overschreven in plaats van een nieuwe rij aan te maken. Sinds stap 7. |
| `VERSION_MAX_PER_DOCUMENT` | `50` | Maximum aantal bewaarde versies per document; erboven worden de oudste opgeruimd (publicatieversies het laatst). Sinds stap 7. |
| `PREVIEW_TOKEN_TTL_MINUTES` | `30` | Levensduur van een preview-token (`POST /api/v1/manage/:collection/:id/preview-token`). Sinds stap 7. |
| `WEBHOOK_TIMEOUT_SECONDS` | `10` | Timeout per bezorgpoging naar een webhook-URL. Sinds stap 8. |
| `WEBHOOK_RETRY_BACKOFF_SECONDS` | `10,60,300` | Kommagescheiden wachttijden vóór elke hernieuwde poging na een mislukte bezorging. Het aantal waarden bepaalt het aantal retries — dus 3 waarden betekent in totaal 4 pogingen (1 origineel + 3 retries). Sinds stap 8. |
| `WEBHOOK_DELIVERY_INTERVAL_SECONDS` | `5` | Hoe vaak de interne bezorg-sweep controleert op openstaande (nieuwe of te hernieuwen) webhook-bezorgingen. Sinds stap 8. |
| `WEBHOOK_DELIVERY_RETENTION_DAYS` | `30` | Afgehandelde (`success`/`failed`) rijen in `webhook_deliveries` ouder dan dit aantal dagen worden opgeruimd door dezelfde interne opruimtaak als sessies/preview-tokens. Sinds stap 8b. |
| `BACKUP_INTERVAL_HOURS` | `24` | Interval voor geplande backups (`kern backup`'s logica, uitgevoerd door `kern start` zelf) in hele uren. `0` schakelt geplande backups uit — `kern backup` blijft dan gewoon handmatig bruikbaar. Sinds stap 14. |
| `BACKUP_KEEP` | `7` | Aantal geplande backups dat bewaard blijft onder `${DATA_DIR}/backups/`; de oudste worden na elke geplande run opgeruimd. Geldt niet voor handmatige `kern backup [pad]`-aanroepen met een expliciet pad. Sinds stap 14. |
| `HSTS` | `false` | Op `true` gezet: stuurt `Strict-Transport-Security` mee op elke response. Alleen inschakelen als er daadwerkelijk TLS vóór Kern CMS staat (een reverse proxy/load balancer) — de server zelf kan dat niet detecteren. Zie de "Security-headers"-sectie hieronder. Sinds stap 14. |

## Voorbeeld

```bash
PORT=4000 DATA_DIR=/var/lib/kern-cms bun run dev
```

Ontbrekende variabelen vallen terug op hun default. Een ongeldige `PORT` (geen getal, of
`<= 0`) laat de server direct bij het opstarten falen met een duidelijke foutmelding.

## Eerste admin-account (first-run)

Bij het opstarten controleert de server of de `users`-tabel leeg is. Is dat zo, dan:

1. Zijn `KERN_ADMIN_EMAIL` en `KERN_ADMIN_PASSWORD` beide gezet → die admin wordt direct aangemaakt (handig voor Docker/CI, non-interactief).
2. Anders, en de server draait in een interactieve terminal (TTY) → een prompt op stdin vraagt om e-mailadres en wachtwoord.
3. Anders → een waarschuwing in de log; er wordt niemand aangemaakt. Beheer dit dan later handmatig (via een herstart met de env-vars hierboven, of — als er al een andere admin bestaat — via `POST /api/v1/manage/users`).

Op elke volgende start is de `users`-tabel niet meer leeg, dus gebeurt er niets: dit
first-run-mechanisme kan nooit een tweede keer een admin aanmaken.

Wachtwoorden (bij aanmaken, bij wijzigen, en via `KERN_ADMIN_PASSWORD`) moeten minstens 8
tekens lang zijn; verder wordt er geen sterktebeleid afgedwongen (zie
`docs/review-besluiten-stap-1-5.md`, stap 5b).

## TRUST_PROXY (client-IP en rate limiting)

`TRUST_PROXY` is een **hop-aantal**, geen aan/uit-schakelaar: hoeveel reverse proxies vóór
Kern CMS vertrouwd worden om hun eigen adres aan `X-Forwarded-For` toe te voegen.

- **`0` (default)**: de header wordt volledig genegeerd; het echte socketadres van de
  verbinding (Bun's `server.requestIP()`) wordt gebruikt. Een client kan dit niet vervalsen.
- **`n` (n ≥ 1)**: de **n-de waarde van rechts** in `X-Forwarded-For` wordt gebruikt (1 = de
  laatste waarde, 2 = een-na-laatste, enz.) — nooit zomaar de eerste waarde. Reden: een proxy
  *voegt* zijn eigen adres toe aan wat er al in de header stond, dus een client die zelf al
  een `X-Forwarded-For: nep` meestuurt, ziet die na één hop terug als `nep, echt` — de eerste
  waarde blijft door de client bepaald. Alleen de rechterkant is door je eigen infrastructuur
  toegevoegd en dus te vertrouwen.

**Voorbeelden:**
- Eén reverse proxy direct vóór Kern CMS → `TRUST_PROXY=1`.
- CDN → load balancer → Kern CMS (twee hops die allebei toevoegen) → `TRUST_PROXY=2`.

**Een verkeerd hop-aantal is actief onveilig in beide richtingen:** te laag (bijv. `1` waar
het er 2 zijn) laat nog steeds een door de client beïnvloede waarde door; te hoog (bijv. `2`
waar het er 1 is) leest een positie die niet bestaat of die de client zelf controleert. Heeft
`X-Forwarded-For` minder waarden dan het geconfigureerde hop-aantal, dan valt Kern CMS terug
op het socketadres en logt een waarschuwing — dat voorkomt een crash, maar is zelf ook een
teken dat de configuratie niet klopt met de werkelijke proxy-topologie.

**Backwards-compatibiliteit:** `TRUST_PROXY=true`/`false` uit stap 5b werken nog (als `1`
resp. `0`), maar zijn gedeprecieerd — bij gebruik verschijnt een waarschuwing in de log met de
suggestie om een expliciet hop-aantal te zetten.

## CORS

Er wordt bewust **geen** CORS-middleware gezet: de API is same-origin-only. Er is nog geen
admin-UI (die komt in stap 9), dus er is momenteel geen legitieme cross-origin
browseraanroeper om toe te staan; API-key-clients (server-naar-server, `Authorization: Bearer
...`) worden door CORS sowieso niet geraakt. Heroverweeg dit zodra stap 9's admin-UI bestaat:
draait die op een ander origin dan de API, dan is een expliciet, smal CORS-beleid nodig in
plaats van stilzwijgen. Zie ook het commentaar bij `createApp()` in `src/app.ts`.

## Media-API (stap 6)

- **Beheer vereist auth, serveren niet.** `POST/GET/PATCH/DELETE /api/v1/manage/media` zitten
  achter dezelfde sessie-/API-key-auth als de rest van `/api/v1/manage`. `GET /media/:id`
  (buiten `/api/v1`, zie hieronder) is publiek — afbeeldingen moeten via een kale `<img>`-tag
  laadbaar zijn. **Geaccepteerd gevolg:** een geüpload-maar-nergens-gebruikt bestand is
  ophaalbaar door wie het (UUID-)id kent of raadt. Er is geen aparte "publiceer dit bestand"-stap.
- **Route buiten `/api/v1`**: dit was een expliciete instructie voor stap 6, ook al noemt
  `docs/technisch-document-cms.md` §5 letterlijk `/api/v1/media/*`. Zie
  `docs/review-notes.md` voor deze discrepantie.
- **Opslag is content-addressed**: elk bestand staat op schijf onder zijn eigen SHA-256-hash
  (`${DATA_DIR}/media/<hash>`), nooit onder de bestandsnaam — die is alleen metadata.
  Getransformeerde varianten staan in `${DATA_DIR}/media-cache/<hash>-<paramhash>.<ext>` en zijn
  voor altijd cachebaar (`Cache-Control: public, max-age=31536000, immutable` + `ETag`), want
  een gegeven hash+parameters kan nooit naar andere bytes gaan wijzen.
- **Dedupe-keuze: één record per hash**, niet één record per upload met een gedeelde hash. Een
  tweede upload van identieke bytes levert het bestaande record terug (`200`, niet `201`) in
  plaats van een nieuwe rij aan te maken. Een `UNIQUE`-index op `media.hash` (migratie 005)
  maakt dit ook race-vrij: twee gelijktijdige uploads van hetzelfde bestand kunnen nooit allebei
  een rij wegschrijven.
- **Verwijzingen vanuit `schema.yaml`-velden van het type `media` worden niet gecontroleerd** —
  noch bij het verwijderen van media, noch ergens anders. Een document kan na een `DELETE` een
  dangling media-id bevatten; dat is bekend, geaccepteerd gedrag voor v1, geen bug.
- **Alleen rasterformaten**: jpeg, png, webp, avif, gif. SVG wordt expliciet geweigerd
  (XSS-risico via een ingesloten `<script>`); mimetype wordt altijd op de werkelijke bytes
  gecontroleerd (via de bestaande magick-wasm-adapter uit stap 1b), nooit op de
  client-`Content-Type` of bestandsextensie.
- **`StorageAdapter`** (`src/media/storage.ts`) is de enige plek die bestanden leest/schrijft;
  vandaag alleen lokaal, maar de interface (`get/put/delete/exists/list`) is bewust hetzelfde
  shape als S3's kernoperaties, zodat een S3-implementatie er later naast kan zonder de rest
  van de media-API aan te raken.

## Drafts, publiceren, versies & preview (stap 7)

- **Geplande publicatie** (`POST`/`DELETE /api/v1/manage/:collection/:id/schedule`) zet/wist
  `documents.scheduled_publish_at` + `scheduled_publish_by`. Een interne scheduler
  (`src/versions/scheduler.ts`) controleert elke `SCHEDULE_CHECK_INTERVAL_SECONDS` op verstreken
  publicaties én éénmalig direct bij het opstarten (`src/index.ts`) — dat laatste maakt een
  publicatie die tijdens downtime had moeten vuren alsnog uitvoerbaar zodra de server terug is
  ("herstart-bestendig"). Zowel de handmatige publish-route als de scheduler-sweep roepen
  dezelfde interne `publishDocumentAndRecordVersion()` aan (`src/versions/publish-service.ts`) —
  dat is het ene aanhaakpunt voor stap 8's `document.published`-webhook.
- **Versiegeschiedenis**: elke succesvolle create/PATCH legt een rij vast in
  `document_versions`, met een throttle (`VERSION_THROTTLE_SECONDS`) die een snelle opeenvolging
  van saves door dezelfde gebruiker samenvoegt tot één versie — voorbereiding op stap 10's
  autosave. Publiceren en herstellen (restore) omzeilen de throttle altijd: het zijn bewuste,
  losse mijlpalen. Retentie (`VERSION_MAX_PER_DOCUMENT`) ruimt de oudste gewone versies het
  eerst op; een publicatieversie verdwijnt pas als er geen gewone versie meer over is.
- **Restore slaat schemavalidatie bewust over**: de hersteldata wordt exact (byte-gelijk)
  teruggezet, ook als `schema.yaml` intussen zou zijn gewijzigd op een manier waardoor die oude
  data niet meer zou valideren. `published_data` blijft ongemoeid tot een nieuwe, expliciete
  publish.
- **Preview-tokens** (`POST /api/v1/manage/:collection/:id/preview-token`, `PREVIEW_TOKEN_TTL_MINUTES`)
  zijn 256-bit opaque tokens, gehasht opgeslagen (zelfde stijl als API-keys). `GET
  /api/v1/preview/:collection/:id?token=...` is publiek (het token ís de credential) en toont de
  huidige draft-data; verkeerd token, verlopen token, verkeerd document of onbekend document
  geven allemaal exact dezelfde `404` — er lekt geen onderscheid. Verlopen tokens worden
  opgeruimd in dezelfde interval-hygiëne als sessies.
- **`preview`-attribuut in `schema.yaml`** (stap 11 deel 3) — niet te verwarren met de
  preview-tokens hierboven, waar dit attribuut juist gebruik van maakt: een optionele URL-template
  per collectie/singleton, bijvoorbeeld:
  ```yaml
  collections:
    posts:
      preview: "http://localhost:4321/preview/posts/{slug}?token={token}"
  ```
  De admin-editor vervangt `{id}`, `{slug}` en `{token}` (dat laatste met een vers aangevraagd
  preview-token, zie hierboven) en opent het resultaat in een splitscherm-iframe naast het
  formulier — alleen zichtbaar als het attribuut is ingesteld. Verplicht http(s) (afgedwongen door
  de metaschema, `schema:check`/`schema:apply` geven een harde fout bij bv. een relatief pad); de
  `{token}`-placeholder is optioneel maar sterk aanbevolen — `schema:check`/`schema:apply` geven
  een waarschuwing (geen fout) als hij ontbreekt, want zonder token kan de ontvangende frontend
  geen conceptversie opvragen bij de preview-API. Het voorbeeld-frontend (stap 13) implementeert de
  ontvangende kant (`/preview/:collection/:slug`-achtige routes die het token doorgeven aan `GET
  /api/v1/preview/...`).

## Webhooks (stap 8)

- **Beheer** (`/api/v1/manage/webhooks`, alleen admin): CRUD + `GET .../deliveries` (paginatie,
  nieuwste eerst) + `POST .../test` (stuurt een `webhook.test`-event, negeert `active`/`events`,
  wacht op en rapporteert de uitkomst rechtstreeks — een bewuste uitzondering op de
  "nooit blokkeren"-regel, want dit is een expliciete, eenmalige testactie, geen routineverkeer).
- **`secret` staat in platte tekst in de database**, in tegenstelling tot API-keys (die alleen
  een hash bewaren). Bewust: de server moet elke bezorging met dit secret ondertekenen (HMAC),
  dus moet de oorspronkelijke waarde terug te lezen zijn — hashen zou dat onmogelijk maken.
  Hashen is alleen zinvol wanneer de server een door de cliënt aangeleverde waarde ertegen
  vergelijkt (zoals bij een API-key); hier bewijst de server juist zélf zijn identiteit aan de
  ontvanger.
- **Geen SSRF-allowlist op de webhook-URL** — alleen `http(s)` wordt afgedwongen. Kern CMS is
  self-hosted met één operator-model: wie admin is, kan toch al bij `schema.yaml`, de
  mediamap en het databasebestand zelf, dus een allowlist op *welke* http(s)-host een admin een
  webhook naar mag laten wijzen zou geen echte grens toevoegen. Bewuste v1-keuze, geen omissie.
- **Events**: `document.published`, `document.updated` (bij elke succesvolle create/PATCH/
  restore), `document.deleted`, `media.uploaded` (alleen bij een echte nieuwe upload, niet bij
  een dedupe-hit). Payload is compact (`{ event, timestamp, data: { collection?, id, slug? } }`)
  — geen volledige documentinhoud, dus geen lek van draftdata en kleine payloads. Events vuren
  altijd ná de bijbehorende geslaagde databasewijziging.
- **Bezorging is sweep-gebaseerd, niet fire-and-forget-in-dezelfde-tick**: `enqueueEvent()` doet
  alleen een synchrone rij-insert (geen netwerk-I/O, blokkeert dus nooit de API-respons); de
  daadwerkelijke HTTP-poging gebeurt door een interne sweep die elke
  `WEBHOOK_DELIVERY_INTERVAL_SECONDS` draait (plus eenmalig bij het opstarten). Dat is dezelfde
  vorm als stap 7's publicatieplanner en maakt retries/backoff met een nepklok testbaar zonder
  échte wachttijden.
- **HMAC-handtekening**: `X-Kern-Signature` is HMAC-SHA256 over `timestamp + "." + body` met het
  webhook-secret; `X-Kern-Timestamp` zit ook los in de headers, zodat de ontvanger replay kan
  detecteren. Timeout per poging: `WEBHOOK_TIMEOUT_SECONDS`. Bij falen (netwerkfout of non-2xx):
  oplopende backoff (`WEBHOOK_RETRY_BACKOFF_SECONDS`); na het aantal geconfigureerde retries
  krijgt de bezorging status `failed`.
- **Herstart-bestendig, ook na een onnette stop**: een bezorging die nog `in_progress` stond
  (het proces stierf midden in een poging) wordt bij het opstarten eenmalig teruggezet naar
  `pending` (`resetStuckDeliveries()`) vóórdat de sweep weer gaat zoeken naar openstaand werk —
  anders zou zo'n rij nooit meer worden opgepikt (`getDueDeliveries()` selecteert alleen
  `pending`).

## OpenAPI & API-documentatie (stap 8)

- **`GET /api/docs/openapi.json`** wordt bij elke aanvraag opnieuw opgebouwd uit de op dat moment
  geladen `SchemaRegistry` (`src/openapi/spec.ts`) — er wordt niets naar schijf weggeschreven of
  gecachet. De registry zelf wordt alleen bij het opstarten opgebouwd (ongewijzigd sinds stap 3/4),
  dus `bun run schema:apply` gevolgd door een herstart is wat een nieuwe collectie in de spec laat
  verschijnen; er is geen aparte "regenereer de spec"-stap om te vergeten.
- **Zod → JSON Schema** via `z.toJSONSchema()`, een ingebouwde functie van de `zod`-package zelf
  (v4, MIT-licentie) — geen aparte conversiebibliotheek nodig. Dit hergebruikt exact dezelfde
  Zod-validators die de schema-engine al bouwt voor runtime-validatie (`src/schema/validators.ts`),
  dus request-/responseschema's kunnen nooit uit de pas lopen met de daadwerkelijke validatie.
- **`GET /api/docs`** toont [Redoc](https://github.com/Redocly/redoc) (`redoc.standalone.js`,
  MIT-licentie), vendored als één bestand in `src/openapi/vendor/` en volledig ingebed via Bun's
  `with { type: "text" }`-assetembedding — dit werkt identiek in `bun run dev` en in de
  gecompileerde `bun build --compile`-binary, zonder dat er ooit een CDN wordt aangeroepen om de
  viewer zelf te laden. Gekozen boven Swagger UI (Apache-2.0, meerdere losse bestanden) en Scalar
  (geen betrouwbaar vendorbare single-file-build) vanwege de eenvoud van één script-tag. Bekende,
  geaccepteerde beperking: diep in de geminificeerde Redoc-bundle zit één cosmetisch
  `<img src="https://cdn.redoc.ly/...">`-verzoek (een klein "Redocly"-logo) dat bij offline
  gebruik gewoon stil faalt (`onError`-fallback) zonder de rest van de viewer te breken — de
  door Kern CMS zelf geserveerde pagina bevat geen enkele andere externe `<script src>`/
  `<link href>`-verwijzing. Licentie genoteerd voor `THIRD-PARTY-LICENSES.md` (stap 14).
- **`securitySchemes`** in de spec documenteren welke auth-vorm elke route accepteert
  (sessiecookie + CSRF-header, of een Bearer-API-key) — puur documentatief, de daadwerkelijke
  afdwinging blijft bij `auth/middleware.ts`.

## Veldlabels (`label` per veld, stap 11-addendum)

Elk veld in `schema.yaml` mag optioneel een `label` krijgen, bijvoorbeeld:

```yaml
fields:
  title: { type: text, required: true, label: "Titel" }
```

De admin-formuliergenerator toont dit label in plaats van een uit de technische veldnaam
afgeleide fallback (`title` → "Title"). Zonder `label` verandert er niets aan het bestaande
gedrag. Puur cosmetisch: het label wordt nergens gevalideerd of opgeslagen als data, en een
wijziging in alleen het label verschijnt in `schema:diff` als een gewone, niet-destructieve
wijziging (net als elke andere niet-type-wijziging aan een veld).

## De `kern`-CLI (stap 14)

Eén binary, subcommando's via handgeschreven argv-parsing (`packages/server/src/index.ts` +
`src/cli/*.ts` — geen CLI-framework-dependency):

- `kern` / `kern start` — start de server (bestaande first-run-flow, migraties, schema laden).
- `kern init` — schrijft `schema.yaml` (het meegeleverde voorbeeldschema, embedded in de binary
  via `with { type: "text" }`, dus geen bestandssysteemtoegang tot de repo nodig) en maakt
  `${DATA_DIR}` aan in de huidige map, als die nog niet bestaan. Overschrijft nooit een bestaand
  `schema.yaml`.
- `kern backup [pad]` — `VACUUM INTO` (bewezen te werken tegen een live, open WAL-database — zie
  `docs/review-notes.md`) schrijft een consistente `data.db`-kopie naar `[pad]/data.db`, plus een
  kopie van `${DATA_DIR}/media` naar `[pad]/media`. Bewuste keuze: een **map**, geen archief (geen
  ingebouwde zip/tar in Bun, en een map is zonder extra tooling terug te zetten op elk platform).
  `${DATA_DIR}/media-cache` wordt nooit meegenomen — dat is een regenereerbare
  transformatiecache, geen brondata. Zonder `[pad]` komt de backup in
  `${DATA_DIR}/backups/kern-backup-<tijdstempel>/` terecht.
- `kern restore <pad> [--yes]` — zet `<pad>/data.db` en `<pad>/media` terug over `${DATA_DIR}`
  heen (media-cache blijft ongemoeid). Vraagt om bevestiging tenzij `--yes`. Weigert als er een
  `kern start` tegen dezelfde `${DATA_DIR}` lijkt te draaien: `kern start` schrijft bij het
  opstarten `${DATA_DIR}/.kern.lock` met zijn eigen PID (en ruimt dat bestand op bij een schone
  afsluiting); `kern restore` beschouwt de server alleen als "actief" wanneer dat PID nog leeft —
  een lockbestand van een oneigenlijk afgesloten proces (kill -9, stroomuitval) blokkeert een
  restore dus niet permanent.
- `kern types [--out pad]` — genereert TypeScript-interfaces uit het actieve schema (één per
  collectie/singleton, plus een zelfstandige — niet van `@kern-cms/shared` afhankelijke — kopie
  van de richtext-documenttypes), zodat de output ook compileert in een extern consumerend
  project. Zonder `--out` gaat de output naar stdout.
- `kern migrate [up|down|status]` en `kern schema check|apply` — dezelfde onderliggende logica als
  de bestaande `bun run migrate`/`schema:check`/`schema:apply`-scripts, nu ook bereikbaar vanuit de
  gepackagede binary.
- `kern --version` / `kern --help`.

Geplande backups (`BACKUP_INTERVAL_HOURS`/`BACKUP_KEEP` hierboven) draaien binnen `kern start`
zelf, in dezelfde interval-hygiëne-groep als de sessie-/preview-token-/webhook-opruiming.

## Security-headers (stap 14)

Toegepast op **elke** response (`src/api/security-headers.ts`), ook op 401/404/503's — de
middleware wikkelt de hele app in, niet alleen de succesvolle paden:

- **`X-Content-Type-Options: nosniff`** — altijd.
- **`Referrer-Policy: strict-origin-when-cross-origin`** — altijd.
- **`X-Frame-Options: DENY`** — overal, **behalve** op `/media/*`: afbeeldingen moeten
  embedbaar blijven (bijv. in een `<iframe>`/`<object>` van een consumerende frontend), en er
  staat geen sessie-/CSRF-state op die route om via clickjacking te stelen.
- **`Strict-Transport-Security`** — alleen als `HSTS=true` (zie hierboven); anders afwezig. De
  server kan zelf niet weten of er TLS voor staat, dus dit is bewust een operator-keuze, geen
  default.
- **`Content-Security-Policy`** — alleen op `/admin` en `/admin/*` (de JSON-API en `/media` hebben
  geen HTML/script-context om te beschermen). Baseline `default-src 'self'`, met twee bewuste,
  gedocumenteerde versoepelingen:
  - `style-src 'self' 'unsafe-inline'` — Tiptap/ProseMirror (de blok-editor, stap 11) zet tijdens
    het draaien inline `style`-attributen op cursor-/decoratie-elementen; daar bestaat geen
    statische hash voor (in tegenstelling tot het ene statische inline `<script>` hieronder).
  - `frame-src https: http:` — de live-preview-iframe (stap 11 deel 3) laadt een willekeurige,
    per-schema-geconfigureerde operator-frontend-URL (het `preview`-veld); die origin is niet
    statisch te kennen, dus kan `frame-src` niet tot `'self'` beperkt blijven zonder de feature
    voor elke echte configuratie (incl. het meegeleverde Astro-voorbeeld, een andere origin in
    dev) te breken.
  - `script-src` blijft strikt `'self'` plus een **sha256-hash** (geen `'unsafe-inline'`) van het
    ene statische inline `<script>` dat `index.html` bevat (de donkere-modus-flits-preventie) —
    berekend uit de daadwerkelijk ingebedde build, dus nooit stale bij een toekomstige wijziging
    van dat scriptje.

Getest in `test/api/security-headers.test.ts`, inclusief de media-/preview-uitzonderingen; de
admin-e2e-suite (stap 14 deel D) bewijst daarnaast dat de admin functioneel blijft werken onder
deze exacte CSP (incl. de richtext-editor en de preview-iframe).

## Playwright-smoke-suite / release-poort (stap 14 deel D)

`bun run test:e2e` (root) bouwt eerst de admin-bundel + gecompileerde `kern`-binary
(`bun run build:binary`) en draait daarna één doorlopende Playwright-flow
(`packages/e2e/tests/smoke.spec.ts`) tegen die binary op een verse, tijdelijke `DATA_DIR`
(`packages/e2e/.tmp-data`, opgeruimd door Playwright's `globalTeardown`) — nooit tegen de
dev-server. Dit is de release-poort: hij bewijst dat de admin end-to-end werkt tegen precies het
artefact dat ook wordt uitgeleverd (incl. de CSP hierboven).

De flow: inloggen (first-run-admin via `KERN_ADMIN_EMAIL`/`KERN_ADMIN_PASSWORD`) → document
aanmaken → media uploaden → richtext bewerken (paragraaf/kop/afbeelding via de picker) →
publiceren → delivery-API toont het → preview openen → schema-builder (veld toevoegen +
toepassen) → nieuw veld zichtbaar in het formulier → singleton bewerken + versie herstellen.
Elke stap in het testbestand benoemt in commentaar welke van de zes historische UI-bugklassen
(stap 10-12, zie `docs/review-notes.md`) hij bewaakt: resolver-hang, useFieldArray-vastloper,
dialog-CSS, versie-cache, hooks-volgorde, index-commentaarverlies.

Draaitijd: ~10 seconden (los van de build ervoor). Losstaand package (`packages/e2e`, geen
workspace-dependency van server/admin) zodat `bun test`/`tsc` in de andere packages de
Playwright-suite nooit meenemen — root's `test`-script sluit `packages/e2e/**` daarom expliciet
uit, net als `packages/admin/**`.
