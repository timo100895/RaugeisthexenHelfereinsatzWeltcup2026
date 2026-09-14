# Architekturentscheidungen

Kurze Begründung der wichtigsten technischen Entscheidungen, die nicht
unmittelbar aus der Aufgabenstellung folgen.

## Kein Cloudflare Worker

Sämtliche serverseitige Logik (Kapazitätsprüfung, Rechteprüfung, E-Mail-
Versand) liegt in Supabase (PostgreSQL-Funktionen/Trigger + eine Edge
Function). Ein zusätzlicher Cloudflare Worker hätte keine zusätzliche
Sicherheit gebracht, aber eine zweite Backend-Laufzeit mit eigenem
Deployment, eigenen Secrets und eigener Fehlerquelle eingeführt. Für ein
Vereinsprojekt mit dem Ziel "einfache Wartbarkeit, geringe laufende Kosten"
(Aufgabenstellung Abschnitt 98) ist Cloudflare Pages als reines,
statisches Hosting die richtige Wahl.

## Kapazitätsprüfung als Trigger statt nur in der RPC

Die Kapazitätsprüfung (`enforce_registration_capacity`) läuft als
`BEFORE INSERT OR UPDATE`-Trigger direkt auf der Tabelle `registrations` –
nicht nur als Check innerhalb der öffentlichen Buchungsfunktion. Dadurch
gilt der Überbuchungsschutz **garantiert** auch für Admin-Aktionen (manuelles
Hinzufügen, Verschieben), die über die normale PostgREST-Tabellen-API
laufen, ohne dass jede zukünftige Schreiboperation die Prüfung erneut
selbst implementieren müsste ("Single Source of Truth").

## Edit-Token nur gehasht gespeichert, E-Mail-Versand synchron vom Client ausgelöst

Der persönliche Änderungslink-Token wird ausschließlich als SHA-256-Hash in
der Datenbank gespeichert (Klartext existiert nur einmal, direkt nach der
Buchung, im Browser des Helfers). Das schließt aus, dass ein Datenbank-Leak
oder ein kompromittiertes Admin-Konto beliebige Änderungslinks erzeugen
könnte.

Das hat eine Konsequenz für den E-Mail-Versand: Ein rein datenbankseitig
ausgelöster Webhook (z.B. bei INSERT auf `registrations`) hätte keinen
Zugriff mehr auf den Klartext-Token und könnte daher keinen funktionierenden
Änderungslink verschicken. Deshalb ruft das Frontend nach einer erfolgreichen
Buchung aktiv die Edge Function `send-notification` mit dem (nur ihm
bekannten) Klartext-Token auf. Schlägt dieser Aufruf fehl, bleibt die
Buchung selbst gültig – der E-Mail-Versand ist bewusst ein reines
Komfort-Feature ohne Einfluss auf die Buchungslogik.

## Realtime als "Broadcast from Database" statt Postgres-Changes auf `registrations`

Supabase Realtime könnte grundsätzlich Änderungen direkt aus der Tabelle
`registrations` streamen ("Postgres Changes"). Das würde jedoch bedeuten,
dass jeder Abonnent Zeilen dieser Tabelle sehen könnte, sobald RLS das für
irgendeine Nutzerrolle erlaubt – ein unnötiges Risiko für personenbezogene
Daten. Stattdessen sendet ein Trigger nach jeder Änderung gezielt ein
`realtime.send(...)`-Broadcast mit ausschließlich aggregierten,
nicht-personenbezogenen Zahlen (Kapazität, belegte/freie Plätze, Status) auf
einen öffentlichen Kanal `event:<event_id>`. Damit bleibt Realtime nutzbar,
ohne dass jemals Namen oder Kontaktdaten über den Realtime-Kanal laufen.

## "Schichtchef zählt als Helfer" wirkt auf die effektive Kapazität

Ist das Flag `leader_counts_as_helper` aktiv und der Schicht ist ein
primärer Schichtchef zugeordnet, wird die tatsächlich buchbare Kapazität
(`shift_effective_capacity`) um 1 reduziert – nicht nur die Anzeige. Das
entspricht der Beschreibung in Abschnitt 11 der Aufgabenstellung ("Der
Schichtchef soll standardmäßig NICHT automatisch einen der regulären
Helferplätze belegen", optional aber schon). Die Logik existiert bewusst nur
einmal, als SQL-Funktion, und wird sowohl vom Kapazitäts-Trigger als auch
von der öffentlichen View und den Admin-Auswertungen verwendet.
