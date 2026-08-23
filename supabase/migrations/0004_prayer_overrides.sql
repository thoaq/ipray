-- Persönliche Kopien mitgelieferter Gebete: Bearbeitet jemand ein kuratiertes Gebet,
-- entsteht eine eigene, private Fassung (Fork), die den Original-Slug "überschreibt" —
-- nur für diese Person, das Original bleibt für alle anderen unverändert (siehe Konzept-
-- Diskussion zum Editier-Modell: persönliche Kopie statt globaler Änderung).

alter table public.prayers
	add column if not exists overrides_slug text;

-- Pro Nutzer:in höchstens eine eigene Fassung je überschriebenem Original.
create unique index if not exists prayers_overrides_slug_unique
	on public.prayers (user_id, overrides_slug)
	where overrides_slug is not null;
