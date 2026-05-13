import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("Variables Supabase manquantes. Copiez .env.example vers .env.");
}

export const supabase = createClient(url ?? "", anonKey ?? "");
