-- Bild-Upload für eigene Gebete. Ablagepfad je Datei: "<user_id>/<dateiname>" —
-- der Ordnername pro Nutzer:in ist die Grundlage der Storage-Policies unten.
--
-- Bewusste Entscheidung: Bucket ist "public" (öffentlich lesbar über die URL),
-- weil Andachtsbilder nicht schützenswert sind wie Gebetstexte/Favoriten und ein
-- öffentlicher Pfad ohne Ablaufdatum die Offline-Anzeige stark vereinfacht
-- (keine ablaufenden signierten URLs, die der Service Worker erneuern müsste).
-- Schreiben/Ändern/Löschen bleibt trotzdem strikt auf die eigene Nutzer-ID begrenzt.

insert into storage.buckets (id, name, public)
values ('prayer-images', 'prayer-images', true)
on conflict (id) do nothing;

create policy "prayer_images_insert_own" on storage.objects
	for insert with check (
		bucket_id = 'prayer-images'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

create policy "prayer_images_select_own" on storage.objects
	for select using (
		bucket_id = 'prayer-images'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

create policy "prayer_images_update_own" on storage.objects
	for update using (
		bucket_id = 'prayer-images'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

create policy "prayer_images_delete_own" on storage.objects
	for delete using (
		bucket_id = 'prayer-images'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

-- Bild-Metadaten am eigenen Gebet — dasselbe Datenmodell (Rolle/Position/Maße)
-- wie bei den kuratierten Markdown-Gebeten, damit das responsive Layout
-- unverändert wiederverwendet werden kann.
alter table public.prayers
	add column if not exists bild_url text,
	add column if not exists bild_rolle text,
	add column if not exists bild_breite integer,
	add column if not exists bild_hoehe integer,
	add column if not exists bild_position text not null default 'auto';
