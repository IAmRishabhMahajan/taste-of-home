-- One-time schema for the production database.
-- Run against your DATABASE_URL, e.g.:
--   psql "$DATABASE_URL" -f scripts/schema.sql
-- or paste into the Neon / Supabase SQL editor.
-- Mirrors lib/db/src/schema/rsvps.ts

CREATE TABLE IF NOT EXISTS rsvps (
  id               serial PRIMARY KEY,
  name             text NOT NULL,
  contact          text NOT NULL,
  attending        boolean NOT NULL,
  guests           integer NOT NULL,
  category_id      text NOT NULL,
  dish_name        text NOT NULL,
  dish_origin      text NOT NULL,
  dish_memory      text NOT NULL,
  dietary          text[] NOT NULL,
  allergies        text NOT NULL,
  dish_ingredients text NOT NULL DEFAULT '',
  dish_dietary     text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);
