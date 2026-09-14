# Helfereinteilung – Ornemer Raugeisthexen

Produktiv einsetzbare Web-Anwendung zur Helfereinteilung der **Ornemer
Raugeisthexen**, zunächst für den **Weltcup Skispringen Titisee-Neustadt
2026**, technisch aber für beliebige weitere Vereinsveranstaltungen ausgelegt.

## Inhaltsverzeichnis

1. [Projektübersicht](#projektübersicht)
2. [Technische Architektur](#technische-architektur)
3. [Projektstruktur](#projektstruktur)
4. [GitHub Einrichtung](#github-einrichtung)
5. [Supabase Einrichtung](#supabase-einrichtung)
6. [Datenbank-Migrationen](#datenbank-migrationen)
7. [Row Level Security (RLS)](#row-level-security-rls)
8. [Supabase Auth & Admin anlegen](#supabase-auth--admin-anlegen)
9. [E-Mail-Versand konfigurieren](#e-mail-versand-konfigurieren)
10. [Lokale Entwicklung](#lokale-entwicklung)
11. [Cloudflare Einrichtung & Deployment](#cloudflare-einrichtung--deployment)
12. [Environment Variables](#environment-variables)
13. [Domain verbinden](#domain-verbinden)
14. [Logo austauschen](#logo-austauschen)
15. [Farben ändern](#farben-ändern)
16. [Neue Veranstaltung erstellen](#neue-veranstaltung-erstellen)
17. [CSV- und Excel-Export](#csv--und-excel-export)
18. [Tests](#tests)
19. [Backup](#backup)
20. [Sicherheitskonzept (Kurzüberblick)](#sicherheitskonzept-kurzüberblick)

---

## Projektübersicht

Mitglieder melden sich **ohne Login, ohne App, ohne Benutzerkonto** über
einen per WhatsApp verschickten Link für eine oder mehrere Helferschichten
an. Der Vorstand verwaltet Veranstaltungen, Schichten, Vorstandsmitglieder/
Schichtchefs und Anmeldungen über einen geschützten Adminbereich, inklusive
Live-Übersicht, Auswertungen, Druckansicht sowie CSV- und Excel-Export.

Die Anwendung ist **mobile-first** gebaut (die öffentliche Anmeldung wird
überwiegend im WhatsApp-In-App-Browser auf dem Smartphone genutzt) und
funktioniert vollständig ohne native App.

## Technische Architektur

| Baustein | Technologie |
|---|---|
| Quellcode & Versionsverwaltung | GitHub |
| Hosting (Frontend) | Cloudflare Pages |
| Datenbank | Supabase (PostgreSQL) |
| Authentifizierung (Adminbereich) | Supabase Auth |
| Live-Aktualisierung | Supabase Realtime (Broadcast from Database) |
| Kritische Buchungslogik | PostgreSQL-Funktionen (RPC), transaktionssicher |
| E-Mail-Versand | Supabase Edge Function + Resend API |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Excel-Export | ExcelJS (client-seitig im Adminbereich) |

Es kommt **bewusst keine zusätzliche Backend-Plattform** zum Einsatz. Alle
kritischen Regeln (Kapazitätsprüfung, Überbuchungsschutz, Rechteprüfung)
leben direkt in PostgreSQL (Trigger + RPC-Funktionen + RLS), sodass sie
unabhängig vom Frontend gelten – das Frontend ist niemals die einzige
Sicherheitsinstanz.

## Projektstruktur

```
/
├── src/
│   ├── components/     Wiederverwendbare UI-Komponenten (öffentlich + admin)
│   ├── pages/
│   │   ├── public/      Öffentliche Seiten (Startseite, Anmeldung, Änderungslink)
│   │   └── admin/       Geschützter Adminbereich
│   ├── services/        Supabase-Client + typisierte Zugriffsfunktionen
│   ├── utils/            Zeit-, Kapazitäts-, Statistik-, Export-Hilfsfunktionen
│   ├── context/          React Context (Auth, App-Einstellungen)
│   └── types/            TypeScript-Typen passend zum DB-Schema
├── public/
│   └── assets/           Logo, statische Dateien
│   └── _headers          Cloudflare Security-Header (Workers Static Assets)
├── supabase/
│   ├── migrations/       Vollständiges DB-Schema, RLS, Trigger, RPCs (SQL)
│   ├── functions/        Supabase Edge Function (E-Mail-Versand)
│   ├── seed.sql           Startdaten für den Weltcup 2026
│   └── config.toml
├── scripts/
│   └── create_admin.sql   Hilfsskript zum Anlegen des ersten Admin-Profils
├── tests/                 Unit- und Integrationstests (Vitest)
├── .env.example
└── README.md
```

## GitHub Einrichtung

1. Neues (privates) GitHub-Repository anlegen, z.B. `raugeisthexen-helfereinteilung`.
2. Diesen Projektordner hochladen:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<dein-verein>/raugeisthexen-helfereinteilung.git
   git push -u origin main
   ```
3. `.env` **niemals** committen (ist bereits in `.gitignore` ausgeschlossen).

## Supabase Einrichtung

1. Auf [supabase.com](https://supabase.com) ein neues Projekt anlegen (Region
   z.B. Frankfurt/EU für DSGVO-Nähe).
2. Unter **Project Settings → API** die `Project URL` und den `anon public`
   Key notieren – diese kommen in `.env` bzw. später in die Cloudflare
   Environment Variables.
3. Supabase CLI installieren und Projekt verknüpfen:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <dein-projekt-ref>
   ```
4. **Realtime aktivieren:** Unter **Project Settings → Realtime** sicherstellen,
   dass Realtime für das Projekt aktiv ist (Standard bei neuen Projekten).
   Die Live-Aktualisierung nutzt die "Broadcast from Database"-Funktion
   (`realtime.send`, siehe `0007_realtime.sql`), die in aktuellen
   Supabase-Projekten standardmäßig verfügbar ist. Sollte sie in einem
   älteren Projekt fehlen, im Dashboard-Chat/Support ein Update anfragen –
   die restliche Anwendung funktioniert auch ohne Realtime einwandfrei,
   Belegungszahlen aktualisieren sich dann erst beim nächsten Laden der Seite.

## Datenbank-Migrationen

Alle Migrationen liegen in `supabase/migrations/` und bauen aufeinander auf
(Schema → Funktionen/Trigger → RLS → öffentliche View → Buchungs-RPCs →
Admin-RPCs → Realtime).

**Remote ausführen:**
```bash
supabase db push
```

**Seed-Daten (Weltcup 2026) einspielen:**
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" -f supabase/seed.sql
# oder einfacher im Supabase Dashboard: SQL Editor -> Inhalt von supabase/seed.sql einfügen -> Run
```

**Lokale Entwicklung mit Supabase CLI (optional, empfohlen für Tests):**
```bash
supabase start        # startet lokale Supabase-Instanz inkl. lokaler DB
supabase db reset      # führt alle Migrationen + seed.sql lokal aus
```

> Wichtig (siehe Aufgabenstellung Abschnitt 85/86): Die Seed-Daten sind nur
> Startwerte. Sämtliche Schichten, Kapazitäten, Tage und Veranstaltungen
> werden **vollständig dynamisch aus der Datenbank geladen** und können
> jederzeit über den Adminbereich verändert werden, ohne Code anzupassen.

## Row Level Security (RLS)

RLS ist für **alle** Tabellen aktiv (siehe `0003_rls.sql`). Kernprinzip:

- Anonyme Nutzer sehen **niemals** Helfernamen, Kontaktdaten, Bemerkungen
  oder Admin-Informationen direkt aus den Tabellen.
- Der Belegungsstatus für die öffentliche Seite kommt ausschließlich aus der
  View `public_shift_status`, die nur aggregierte, nicht-personenbezogene
  Zahlen liefert (siehe `0004_public_view.sql`).
- Buchung, Änderung und Stornierung durch Helfer laufen ausschließlich über
  `SECURITY DEFINER`-RPC-Funktionen mit Edit-Token-Prüfung
  (`0005_booking_rpc.sql`).
- Admin-Rollen (`admin`, `viewer`) werden über die Tabelle `admin_profiles`
  gesteuert; `admin` darf schreiben, `viewer` nur lesen.

## Supabase Auth & Admin anlegen

Es gibt **keine öffentliche Admin-Registrierung**. Der erste Admin wird
manuell freigeschaltet:

1. Im Supabase Dashboard unter **Authentication → Users** einen Benutzer
   anlegen ("Add user", E-Mail + Passwort, oder Einladung per E-Mail).
2. `scripts/create_admin.sql` öffnen, E-Mail-Adresse und Namen anpassen.
3. Im Supabase SQL Editor ausführen.
4. Ab sofort kann sich dieser Benutzer unter `/admin/login` anmelden und hat
   die Rolle `admin`. Weitere Admins/Viewer werden anschließend bequem im
   Adminbereich selbst oder erneut per SQL (`admin_profiles`) angelegt.

Rollen:
- **admin**: volle Verwaltung (Veranstaltungen, Schichten, Vorstand, Helfer,
  Export, Einstellungen).
- **viewer**: nur Lesezugriff, Auswertungen, Druckansicht, Export – keine
  Änderungen.
- **shift_leader**: Datenmodell ist vorbereitet (Spalte `board_member_id` in
  `admin_profiles`), die Funktion ist für Version 1 bewusst **nicht**
  freigeschaltet (siehe Aufgabenstellung Abschnitt 65).

## E-Mail-Versand konfigurieren

E-Mails (Bestätigung an Helfer, Benachrichtigung an Vorstand/Schichtchef)
laufen über die Edge Function `supabase/functions/send-notification` und den
Dienst [Resend](https://resend.com) (kostenloses Kontingent ausreichend für
Vereinsbetrieb).

1. Bei Resend eine Absenderdomain verifizieren (oder für den Test die
   Standard-Domain `onboarding@resend.dev` nutzen).
2. API-Key erzeugen.
3. Edge Function deployen und Secrets setzen:
   ```bash
   supabase functions deploy send-notification
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
   supabase secrets set MAIL_FROM="Ornemer Raugeisthexen <helferliste@ornemer-raugeisthexen.de>"
   supabase secrets set NOTIFY_EMAILS="vorstand@ornemer-raugeisthexen.de"
   supabase secrets set PUBLIC_SITE_URL="https://weltcup2026.ornemer-raugeisthexen.de"
   ```
4. Ist `RESEND_API_KEY` nicht gesetzt, bucht die Anwendung trotzdem korrekt
   (die Buchung selbst hängt nicht am E-Mail-Versand) – es wird lediglich
   keine E-Mail verschickt, was im Function-Log vermerkt wird.

Zusätzliche Benachrichtigungsadressen können jederzeit im Adminbereich unter
**Einstellungen** (vereinsweit) bzw. pro Veranstaltung im Veranstaltungs­formular
hinterlegt werden.

## Lokale Entwicklung

```bash
npm install
cp .env.example .env
# .env mit echten Supabase-Werten befüllen
npm run dev
```

Die Anwendung läuft dann unter `http://localhost:5173`.

Nützliche Skripte:
```bash
npm run typecheck   # TypeScript-Prüfung
npm run lint        # ESLint
npm test            # Unit-Tests (Vitest)
npm run build       # Produktions-Build nach dist/
npm run preview     # Produktions-Build lokal ansehen
```

## Cloudflare Einrichtung & Deployment

Das Deployment läuft über **GitHub Actions** (`.github/workflows/deploy.yml`):
bei jedem Push auf `main` wird die Anwendung automatisch gebaut und nach
Cloudflare Workers (Static Assets) deployt. Sämtliche Zugangsdaten liegen
dabei **ausschließlich als GitHub-Repository-Secrets** – nicht in Cloudflare
selbst, nicht im Code. Cloudflares eigene "Connect to Git"-Oberfläche wird
dafür **nicht** benötigt/verwendet.

**Einmalige Einrichtung:**

1. **Cloudflare API-Token erzeugen:**
   [dash.cloudflare.com](https://dash.cloudflare.com) → oben rechts auf das
   Profil-Icon → **My Profile → API Tokens → Create Token** → Vorlage
   **"Edit Cloudflare Workers"** verwenden → auf das eigene Konto
   beschränken → erstellen → Token kopieren (wird nur einmal angezeigt).
2. **Cloudflare Account-ID notieren:** im Dashboard unter
   **Workers & Pages** (rechte Seitenleiste) oder auf der Overview-Seite der
   Domain zu finden.
3. **GitHub-Secrets eintragen:** im Repository unter
   **Settings → Secrets and variables → Actions → New repository secret**
   folgende vier Secrets anlegen:

   | Secret-Name | Wert |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | Token aus Schritt 1 |
   | `CLOUDFLARE_ACCOUNT_ID` | Account-ID aus Schritt 2 |
   | `VITE_SUPABASE_URL` | Supabase Projekt-URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable Key |

4. Fertig. Ab dem nächsten Push auf `main` (oder manuell über den Reiter
   **Actions → Deploy nach Cloudflare Workers → Run workflow**) baut und
   deployt GitHub Actions automatisch. Der Worker wird beim ersten Lauf
   automatisch angelegt (Name aus `wrangler.toml`), ein manuelles Anlegen in
   der Cloudflare-Oberfläche ist nicht nötig.

`wrangler.toml` konfiguriert eine reine statische SPA-Auslieferung
(`[assets]` aus `dist/`, `not_found_handling = "single-page-application"`
für React-Router-Routen). Ein eigener Worker-Code wird nicht benötigt –
sämtliche serverseitige Logik läuft in Supabase (PostgreSQL-Funktionen +
Edge Function). Das hält die Architektur einfach und wartbar.

## Environment Variables

**GitHub Actions Secrets** (Settings → Secrets and variables → Actions,
siehe auch `.env.example` für die lokale Entwicklung):

| Secret | Beschreibung |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Projekt-URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable Key (bewusst öffentlich, durch RLS abgesichert) |
| `CLOUDFLARE_API_TOKEN` | API-Token mit Workers-Bearbeitungsrechten (nur für den Deploy-Schritt) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account-ID (nur für den Deploy-Schritt) |

**Supabase Secrets** (nur serverseitig, für die Edge Function):

| Variable | Beschreibung |
|---|---|
| `RESEND_API_KEY` | API-Key für den E-Mail-Versand |
| `MAIL_FROM` | Absenderadresse |
| `NOTIFY_EMAILS` | Zusätzliche, global benachrichtigte Adressen |
| `PUBLIC_SITE_URL` | Basis-URL der öffentlichen Seite (für Links in E-Mails) |

`SUPABASE_SERVICE_ROLE_KEY` wird von Supabase automatisch in jede Edge
Function injiziert und muss **nicht** manuell gesetzt werden. Er darf
**niemals** im Frontend oder in Cloudflare hinterlegt werden.

## Domain verbinden

1. Im Cloudflare Dashboard unter **Workers & Pages** den deployten Worker
   (`raugeisthexen-helfereinteilung`) öffnen → **Settings → Domains & Routes
   → Add → Custom Domain** → gewünschte (Sub-)Domain eintragen, z.B.
   `weltcup2026.ornemer-raugeisthexen.de`.
2. Läuft die Domain bereits über Cloudflare als DNS-Provider, wird der
   nötige DNS-Eintrag automatisch angelegt.
3. `PUBLIC_SITE_URL` (Supabase Secret) auf die finale Domain aktualisieren,
   damit Links in E-Mails korrekt sind.

## Logo austauschen

1. Neue Logo-Datei (idealerweise SVG oder PNG mit transparentem Hintergrund)
   nach `public/assets/` legen, z.B. `public/assets/raugeisthexen-logo.png`.
2. Im Adminbereich unter **Einstellungen** den Feld "Logo-Pfad" auf
   `/assets/raugeisthexen-logo.png` setzen (oder direkt in der Tabelle
   `app_settings`, Spalte `logo_url`).
3. Seitenverhältnis wird automatisch beibehalten (`object-fit: contain`),
   das Logo wird nicht verzerrt oder abgeschnitten.

> Hinweis: In diesem Repository liegt aktuell ein **Platzhalter-Logo**
> (`public/assets/raugeisthexen-logo.svg`), da die Bilddatei des Vereinslogos
> nicht automatisiert aus dem Chat in das Projektverzeichnis übernommen
> werden konnte. Bitte die bereitgestellte Grafikdatei des Vereins vor dem
> Produktivbetrieb wie oben beschrieben einsetzen.

## Farben ändern

Die drei Vereinsfarben (Schwarz/Rot/Grün) sind zentral konfigurierbar:

- **Zur Laufzeit:** Adminbereich → Einstellungen → Farbfelder. Änderungen
  wirken sofort (CSS-Variablen `--color-black`, `--color-red`,
  `--color-green`, siehe `src/context/SettingsContext.tsx`).
- **Als Code-Default:** `supabase/migrations/0001_schema.sql`
  (`app_settings`-Defaults) sowie `src/styles/index.css` (`:root`).

## Neue Veranstaltung erstellen

1. Adminbereich → **Veranstaltungen** → "+ Neue Veranstaltung".
2. Titel, Slug (URL-Kurzname), Zeitraum, Ort, Anmeldeschluss, Status etc.
   ausfüllen.
3. Nach dem Speichern: **Schichten verwalten** öffnen, zunächst
   Veranstaltungstage anlegen, danach beliebig viele Schichten pro Tag mit
   Uhrzeiten, Kapazität und Schichtchef.
4. Status auf `active` setzen und "Öffentliche Anmeldung aktiv" aktivieren,
   sobald der Link verschickt werden soll: `https://<domain>/veranstaltung/<slug>`.

Alternativ kann eine bestehende Veranstaltung über **Duplizieren** als
Vorlage für die nächste Veranstaltung verwendet werden (Tage/Schichten werden
mitkopiert, Anmeldungen nicht).

## CSV- und Excel-Export

Adminbereich → **Export**: Veranstaltung sowie optional Tag/Schicht/
Schichtchef als Filter wählen, dann:

- **CSV exportieren**: UTF-8, Semikolon-getrennt (öffnet in deutschem Excel
  automatisch korrekt in Spalten).
- **Excel (XLSX) exportieren**: echte `.xlsx`-Datei mit den Arbeitsblättern
  `Helferplan`, `Alle Helfer`, `Schichtübersicht`, `Auswertung` und
  `Helferstatistik` (fette Kopfzeile, Autofilter, fixierte erste Zeile,
  passende Spaltenbreiten, echte Datums-/Uhrzeitformatierung).

Die Druckansicht (Adminbereich → **Druckansicht**) erzeugt einen
druckoptimierten Helferplan (DIN A4) inkl. Logo, Übergabezeiten und
optionalen Kontaktdaten – "Drucken" nutzt den Browser-Druckdialog (auch
"Als PDF speichern").

## Tests

```bash
npm test
```

Enthalten sind Unit-Tests (`tests/*.test.ts`) für die reine Berechnungslogik,
die unabhängig von einer Datenbank laufen:
- Übergabezeiten-Berechnung zwischen überlappenden Schichten
- effektive Kapazität (inkl. "Schichtchef zählt als Helfer")
- Fehlermeldungs-Übersetzung
- CSV-Struktur

Zusätzlich liegt unter `tests/integration/booking.integration.test.ts` ein
Integrationstest, der die **transaktionssichere Buchung inkl. Wettlaufsituation
um den letzten Platz** (Aufgabenstellung Abschnitt 83, TEST 4) gegen eine
echte Postgres-Instanz prüft, da sich das sinnvoll nicht mit Mocks testen
lässt. Für einen Lauf:

```bash
supabase start
supabase db reset
TEST_SUPABASE_URL=http://localhost:54321 \
TEST_SUPABASE_ANON_KEY=<lokaler anon key aus "supabase status"> \
npm test
```

Ohne gesetzte `TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` werden diese Tests
automatisch übersprungen, damit `npm test` auch ohne lokale Datenbank läuft.

## Backup

- **Supabase-eigene Backups:** Im Supabase Dashboard unter
  **Database → Backups** (Point-in-Time-Recovery je nach Plan verfügbar).
- **Manueller SQL-Dump:**
  ```bash
  supabase db dump -f backup.sql
  ```
- **Fachlicher Export als Fallback:** Regelmäßiger Excel-/CSV-Export über den
  Adminbereich, insbesondere vor und nach jeder Veranstaltung.

## Sicherheitskonzept (Kurzüberblick)

- **Keine Überbuchung möglich:** Die Kapazitätsprüfung läuft in einem
  Datenbank-Trigger (`enforce_registration_capacity`, sperrt die betroffene
  Schicht-Zeile via `FOR UPDATE`), unabhängig davon, ob eine Buchung über die
  öffentliche RPC oder direkt durch einen Admin ausgelöst wird.
- **Keine doppelten Anmeldungen:** Eindeutiger Datenbank-Index verhindert
  zwei aktive/wartende Anmeldungen derselben Person für dieselbe Schicht.
- **Keine öffentlichen Personendaten:** RLS verweigert anonymen Nutzern jeden
  direkten Zugriff auf `helpers`, `registrations`, `board_members`,
  `admin_profiles`; die öffentliche Seite nutzt ausschließlich die
  aggregierte View `public_shift_status`.
- **Änderungslinks sind nicht erratbar:** 256-Bit-Zufallstoken, in der
  Datenbank nur als SHA-256-Hash gespeichert.
- **Admin-Zugriff:** Supabase Auth, keine Selbstregistrierung, granulare
  Rollen (`admin`/`viewer`), alle schreibenden Admin-RPCs prüfen die Rolle
  serverseitig erneut (nicht nur im Frontend).
