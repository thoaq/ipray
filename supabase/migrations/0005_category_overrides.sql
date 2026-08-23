-- Persönliche Anpassung von Kategorien (Name, Farbschema). Kategorien sind kein eigenes
-- Objekt im Datenmodell, sondern ergeben sich aus dem "kategorie"-Feld der Gebete — eine
-- Umbenennung rührt darum nicht an den Gebeten selbst, sondern überschreibt nur, wie ein
-- Kategorie-Slug für diese Person angezeigt wird (Name/Akzentfarbe).

create table if not exists public.category_overrides (
	user_id uuid not null references auth.users (id) on delete cascade,
	slug text not null,
	display_name text,
	schema text,
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	primary key (user_id, slug)
);

create index if not exists category_overrides_updated_at_idx on public.category_overrides (user_id, updated_at);

alter table public.category_overrides enable row level security;

create policy "category_overrides_select_own" on public.category_overrides
	for select using (auth.uid() = user_id);

create policy "category_overrides_insert_own" on public.category_overrides
	for insert with check (auth.uid() = user_id);

create policy "category_overrides_update_own" on public.category_overrides
	for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "category_overrides_delete_own" on public.category_overrides
	for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.category_overrides to authenticated;
