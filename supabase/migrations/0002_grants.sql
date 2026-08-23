-- Tabellen-Berechtigungen für angemeldete (auch anonym angemeldete) Nutzer:innen.
-- Row Level Security aus 0001_init.sql schränkt danach ein, welche ZEILEN sichtbar
-- sind — ohne diese GRANTs kommt die Anfrage aber gar nicht erst bis zur Policy.

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.prayers to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
