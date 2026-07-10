# create-kern-cms

De officiële installer voor **Kern CMS** — een snel, minimaal, self-hosted headless CMS
dat als één enkel programma draait: geen database-server, geen runtime-installatie, geen
configuratieoverdaad.

Deze installer downloadt de juiste kant-en-klare `kern`-binary voor jouw platform van
GitHub Releases, verifieert de SHA-256-checksum, en zet een nieuw project voor je klaar.

## Snel starten

```bash
npx create-kern-cms@latest mijn-site
cd mijn-site
./kern start
```

Dat is alles. Bij de eerste start vraagt Kern om een admin-e-mailadres en wachtwoord, en
staat de admin daarna op `http://localhost:3000/admin`. De API draait op `/api/v1`, met
interactieve documentatie op `/api/docs`.

## Vereisten

- **Node.js ≥ 18** — alleen nodig om dit installatiecommando te draaien (via `npx`).

Kern CMS zélf heeft geen Node of Bun nodig: de gedownloade binary is een standalone
executable.

## Opties

```
create-kern-cms [map] [opties]

  map                doelmap (default: huidige map); wordt aangemaakt als hij niet bestaat

  --force            sta toe dat de doelmap al bestanden bevat
  --no-init          plaats alleen de binary, sla "kern init" over
  -v, --version      toont de installer-versie
  -h, --help         toont de hulptekst
```

## Ondersteunde platforms

Linux (x64/arm64), macOS (x64/arm64) en Windows (x64). Voor andere platforms kun je een
binary handmatig downloaden via de [Releases](https://github.com/kern-cms/kern/releases).

## Meer informatie

Zie het hoofdproject op **[github.com/kern-cms/kern](https://github.com/kern-cms/kern)**
voor documentatie over configuratie, deployment en de API.

## Licentie

MIT
