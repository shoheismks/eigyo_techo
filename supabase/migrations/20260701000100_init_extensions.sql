-- Eigyo Techo Supabase migration: extensions
-- Keep extension setup isolated so future migrations can add database-level capabilities safely.

create extension if not exists pgcrypto with schema extensions;
