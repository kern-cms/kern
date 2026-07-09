# Deployment

Dit document beschrijft hoe je Kern CMS in productie zet: los (de binary), via Docker, achter
een reverse proxy, en hoe je een backup terugzet. Zie `docs/config.md` voor de volledige
env-var-referentie.

## Optie 1: `npx create-kern-cms` (aanbevolen quickstart)

```bash
npx create-kern-cms@latest mijn-site
```

Dit is een dunne, Node-only bootstrap (`packages/create-kern-cms/`, zie ook README) — hij draait
zelf onder Node >= 18, maar doet niets anders dan (a) je platform detecteren, (b) de bijbehorende
`kern`-binary + `checksums.txt` downloaden van de release-tag die bij zijn eigen versie hoort
(géén "latest"-resolutie: `npx create-kern-cms@1.2.0` is deterministisch), (c) de SHA-256-checksum
verifiëren en weigeren bij een afwijking, (d) de binary uitvoerbaar maken en (e) `kern init`
draaien in de doelmap. Kern CMS zelf gebruikt op geen enkel moment een Node-runtime — de binary
die de installer plaatst is en blijft een standalone Bun-executable; `npx` is hier alleen het
distributiekanaal.

Nuttige vlaggen: `--force` (installeer ook in een niet-lege map), `--no-init` (plaats alleen de
binary, sla `kern init` over), `--version`/`--help`. Achter een corporate proxy: zet `HTTPS_PROXY`
(of `HTTP_PROXY`) — de installer respecteert die, net als de meeste CLI's.

## Optie 2: de binary rechtstreeks

Handig als `npx` niet beschikbaar is, of je de download liever zelf beheert (bijv. in een
air-gapped omgeving met een intern gespiegeld releasearchief). Download de binary voor je
platform (`kern-linux-x64`, `kern-linux-arm64`, `kern-macos-x64`, `kern-macos-arm64` of
`kern-windows-x64.exe` — zie `docs/adr/004-multi-platform-binaries.md`), controleer de checksum
tegen de `checksums.txt` van diezelfde release (`sha256sum -c checksums.txt`), maak de binary
uitvoerbaar en start:

```bash
chmod +x kern-linux-x64
./kern-linux-x64 init          # schrijft schema.yaml + maakt ./data aan (eenmalig)
KERN_ADMIN_EMAIL=admin@voorbeeld.nl KERN_ADMIN_PASSWORD=een-sterk-wachtwoord \
  PORT=3000 ./kern-linux-x64 start
```

Draai dit als een systemd-service (of gelijkwaardig) zodat een crash automatisch herstart;
`kern start` zelf is stateloos herstartbaar (migraties/schema worden bij elke start opnieuw
gecontroleerd, de geplande-backup-/publicatie-sweeps hervatten vanzelf).

## Optie 3: Docker

```bash
docker build -t kern-cms .
docker volume create kern-data

# Eenmalig: schrijft schema.yaml + de datamap in het volume.
docker run --rm -v kern-data:/data kern-cms init

# Normale start:
docker run -d \
  --name kern-cms \
  -p 3000:3000 \
  -v kern-data:/data \
  -e KERN_ADMIN_EMAIL=admin@voorbeeld.nl \
  -e KERN_ADMIN_PASSWORD=een-sterk-wachtwoord \
  kern-cms
```

Het image zet `DATA_DIR=/data` en `PORT=3000` al (zie `Dockerfile`); het volume bevat na `init`
zowel `schema.yaml` als de SQLite-database + mediamap, dus één volume-mount volstaat. De
`HEALTHCHECK` in het image (`GET /healthz`, elke 30s) laat `docker ps`/orchestrators (Compose,
Kubernetes, Swarm) zien of de container gezond is.

## Reverse proxy (nginx-voorbeeld)

Kern CMS luistert zelf niet op TLS — zet er een reverse proxy voor. Twee dingen moeten expliciet
kloppen: de **body-limiet** (anders krijgt een media-upload een generieke proxyfout in plaats van
Kern CMS's eigen `413`) en **`TRUST_PROXY`** (anders ziet de rate limiter het proxy-adres in
plaats van het echte client-IP, zie `docs/config.md`).

```nginx
server {
    listen 443 ssl;
    server_name voorbeeld.nl;

    ssl_certificate     /etc/letsencrypt/live/voorbeeld.nl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/voorbeeld.nl/privkey.pem;

    # Iets ruimer dan MEDIA_MAX_UPLOAD_MB's default (20 MB, zie docs/config.md) zodat Kern CMS
    # zelf de nette 413 geeft in plaats van nginx een kale verbindingsfout.
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Bijbehorende Kern CMS-configuratie:

```bash
TRUST_PROXY=1   # exact één vertrouwde hop: deze nginx, direct ervoor
HSTS=true       # TLS staat ervoor (deze nginx-config) — pas nu aanzetten, zie docs/config.md
NODE_ENV=production
```

Staat er nog een CDN of load balancer vóór deze nginx (twee hops die allebei hun eigen adres aan
`X-Forwarded-For` toevoegen), verhoog `TRUST_PROXY` naar `2` — zie `docs/config.md`'s
`TRUST_PROXY`-sectie voor waarom een verkeerd hop-aantal in beide richtingen onveilig is.

## Backups terugzetten

```bash
kern backup /pad/naar/backups/2026-01-15    # of zonder pad: ${DATA_DIR}/backups/kern-backup-<tijdstempel>/
```

draait terwijl de server actief is (SQLite `VACUUM INTO` tegen de live WAL-database, zie
`docs/review-notes.md`). Terugzetten:

```bash
# Stop het lopende proces eerst echt (systemctl stop/docker stop/kill) — kern restore
# weigert zolang .kern.lock een nog levend proces aanwijst, zie hieronder.
kern restore /pad/naar/backups/2026-01-15 --yes
kern start
```

`kern restore` weigert zolang het detecteert dat een `kern start` nog tegen dezelfde `DATA_DIR`
draait (via `.kern.lock`, zie `docs/config.md`'s CLI-sectie) — stop de server dus eerst echt.
Zonder `--yes` vraagt het commando om bevestiging voordat de bestaande data overschreven wordt.
Geplande backups (`BACKUP_INTERVAL_HOURS`/`BACKUP_KEEP`, default: elke 24 uur, 7 bewaard) draaien
automatisch binnen `kern start` — zie `docs/config.md`.

## API v1-stabiliteitsbelofte

Kern CMS's `/api/v1/*`-routes blijven stabiel gedurende de hele 1.x-releaselijn: geen breaking
changes (verwijderde velden, veranderde statuscodes, hernoemde routes) zonder een nieuwe
major-versie (`/api/v2`). Nieuwe, optionele velden/routes kunnen wel toegevoegd worden — dat is
per definitie geen breaking change voor bestaande integraties. Zie de README voor het volledige
semver-statement.
