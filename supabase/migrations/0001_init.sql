-- Gebetsraum · Phase 2: persönliche Ebene (Schicht 2 aus dem Konzept)
-- Jede Zeile gehört genau einer anonymen Nutzer-ID; Row Level Security sorgt dafür,
-- dass niemand die Gebete/Favoriten einer anderen Person lesen oder ändern kann,
-- auch wenn alle denselben Einladungslink benutzt haben.

create extension if not exists pgcrypto;

-- Eigene, von der Person selbst hinzugefügte Gebete.
create table if not exists public.prayers (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	titel text not null,
	kategorie text not null,
	unterkategorie text,
	tags text[] not null default '{}',
	sprache text not null default 'de',
	quelle text,
	body_text text not null,
	updated_at timestamptz not null default now(),
	deleted_at timestamptz
);

create index if not exists prayers_user_id_idx on public.prayers (user_id);
create index if not exists prayers_updated_at_idx on public.prayers (user_id, updated_at);

alter table public.prayers enable row level security;

create policy "prayers_select_own" on public.prayers
	for select using (auth.uid() = user_id);

create policy "prayers_insert_own" on public.prayers
	for insert with check (auth.uid() = user_id);

create policy "prayers_update_own" on public.prayers
	for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "prayers_delete_own" on public.prayers
	for delete using (auth.uid() = user_id);

-- Favoriten — funktionieren sowohl für kuratierte Gebete (item_id = Markdown-Slug)
-- als auch für eigene Gebete (item_id = prayers.id als Text).
create table if not exists public.favorites (
	user_id uuid not null references auth.users (id) on delete cascade,
	item_id text not null,
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	primary key (user_id, item_id)
);

create index if not exists favorites_updated_at_idx on public.favorites (user_id, updated_at);

alter table public.favorites enable row level security;

create policy "favorites_select_own" on public.favorites
	for select using (auth.uid() = user_id);

create policy "favorites_insert_own" on public.favorites
	for insert with check (auth.uid() = user_id);

create policy "favorites_update_own" on public.favorites
	for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "favorites_delete_own" on public.favorites
	for delete using (auth.uid() = user_id);
