-- Fix für den in KONZEPT.md ("Offene Punkte") beschriebenen Bug: `prayers` hatte bisher nur
-- `id` als Primärschlüssel (anders als favorites/category_overrides mit (user_id, ...)).
-- Überlebt eine lokale Zeile einen Kontowechsel auf einem Gerät (z. B. durch den
-- Sitzungspersistenz-Bug) und wird dort weiter bearbeitet, versucht ein späterer Push
-- dieselbe id unter dem jetzt aktiven Konto zu upserten — Postgres macht daraus ein UPDATE
-- der bereits bestehenden, fremden Zeile, das RLS zu Recht dauerhaft blockiert
-- ("new row violates row-level security policy (USING expression)").
--
-- Zusammengesetzter Primärschlüssel (user_id, id) erlaubt dieselbe id unter verschiedenen
-- Konten, wodurch der Upsert stattdessen eine neue Zeile einfügt statt zu kollidieren.
-- Keine FK verweist auf prayers.id (siehe favorites.item_id: freies Text-Feld, keine FK) —
-- das Aufweichen der Eindeutigkeit von id allein ist darum unbedenklich.

alter table public.prayers drop constraint prayers_pkey;
alter table public.prayers add primary key (user_id, id);
