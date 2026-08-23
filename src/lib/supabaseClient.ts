import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabaseConfigured = Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY);

// Ohne Konfiguration (noch kein Supabase-Projekt verbunden) bleibt die App lauffähig —
// die persönliche Ebene ist dann einfach inaktiv, siehe supabaseConfigured.
export const supabase = supabaseConfigured
	? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			auth: { persistSession: true, autoRefreshToken: true }
		})
	: null;
