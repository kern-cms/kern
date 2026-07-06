# Kern CMS

Een snel, minimaal, self-hosted headless CMS dat als één enkel programma draait — geen
database-server, geen runtime-installatie, geen configuratieoverdaad. Schema als code,
een gebruiksvriendelijke admin, en één API die klaar is voor elke frontend.

## Snel starten

```bash
npx create-kern-cms@latest mijn-site
cd mijn-site
./kern start
```

Dat is alles. Bij de eerste start vraagt Kern om een admin-e-mailadres en wachtwoord, en
staat de admin daarna op `http://localhost:3000/admin`. De API draait op `/api/v1`, met
interactieve documentatie op `/api/docs`.

Geen Node of Bun nodig om Kern zelf te draaien — de installer hierboven haalt alleen de
juiste kant-en-klare binary voor je platform op. Alleen het installatiecommando zelf
gebruikt Node (via `npx`).

## Alternatieve installatie

Geen `npx`, of liever handmatig?

- **Binary rechtstreeks downloaden**: zie de [Releases](../../releases) van dit
  project, kies de binary voor jouw platform, en draai `./kern init && ./kern start`.
- **Docker**:
  ```bash
  docker run -p 3000:3000 -v $(pwd)/data:/data ghcr.io/your-org/kern-cms:latest
  ```

Zie [`docs/deployment.md`](docs/deployment.md) voor reverse-proxy-voorbeelden,
backup/restore en productie-instellingen.

## Wat je krijgt

- **Schema als code** — je contentmodel leeft in één leesbaar `schema.yaml`-bestand,
  ook te bewerken via een visuele builder in de admin
- **Snelle, veilige API** — REST met filters, sortering, relaties, en automatisch
  gegenereerde OpenAPI-documentatie
- **Redacteursvriendelijke admin** — blok-editor, autosave, versiegeschiedenis met
  herstel, en live preview naast je eigen frontend
- **Media met on-the-fly transformaties** — upload één keer, vraag elke gewenste
  afmeting/formaat op via de URL
- **Webhooks** voor het automatisch herbouwen van statische sites bij publicatie
- **Rollen en API-keys** met scopes, klaar voor zowel redacteuren als geautomatiseerde
  systemen

## Documentatie

- [`docs/config.md`](docs/config.md) — alle instellingen (omgevingsvariabelen)
- [`docs/deployment.md`](docs/deployment.md) — productie-installatie, reverse proxy,
  backups
- `/api/docs` op je draaiende installatie — de volledige, interactieve API-referentie

## Licentie

Zie [`LICENSE`](LICENSE). Gebruikte externe bibliotheken en hun licenties staan in
[`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md).

## Wijzigingen

Zie [`CHANGELOG.md`](CHANGELOG.md).
