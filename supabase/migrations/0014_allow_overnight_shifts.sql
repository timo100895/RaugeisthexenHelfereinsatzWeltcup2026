-- ============================================================================
-- 0014_allow_overnight_shifts.sql
--
-- Erlaubt Schichten, die über Mitternacht hinausgehen (z.B. 22:00-02:00),
-- als EINE Schicht statt sie künstlich in zwei Schichten (bis 23:59 und ab
-- 00:00) am jeweiligen Veranstaltungstag aufteilen zu müssen. Die Schicht
-- bleibt dabei dem Tag zugeordnet, an dem sie BEGINNT.
--
-- end_time <= start_time wird von der Anwendung als "Ende am Folgetag"
-- interpretiert (siehe src/utils/time.ts: spansMidnight/durationMinutes).
-- Einzige verbleibende Regel: Beginn und Ende dürfen nicht identisch sein
-- (das würde weder "0 Minuten" noch "24 Stunden" sinnvoll ausdrücken).
-- ============================================================================

alter table shifts drop constraint if exists shifts_time_order;
alter table shifts add constraint shifts_time_not_equal check (end_time <> start_time);
