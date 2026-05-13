/*
  # Typo Moodboard Tables

  1. New Tables
    - `moodboards`: stores a moodboard document with its blocks config as JSONB
      - `id` uuid primary key
      - `name` text (default 'Untitled')
      - `blocks` jsonb (default '[]') - array of font block configurations
      - `created_at`, `updated_at` timestamps
    - `font_uploads`: stores metadata about uploaded OTF/TTF files
      - `id` uuid primary key
      - `moodboard_id` uuid fk to moodboards
      - `file_name`, `storage_path`, `family`, `style` text
      - `created_at` timestamp

  2. Security
    - RLS enabled on both tables
    - Public (anon) read/write policies (no auth in this app)
*/

CREATE TABLE IF NOT EXISTS moodboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Untitled Moodboard',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS font_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moodboard_id uuid REFERENCES moodboards(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  storage_path text NOT NULL DEFAULT '',
  family text NOT NULL DEFAULT '',
  style text NOT NULL DEFAULT 'Regular',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE moodboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE font_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can select moodboards"
  ON moodboards FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert moodboards"
  ON moodboards FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update moodboards"
  ON moodboards FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete moodboards"
  ON moodboards FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can select font uploads"
  ON font_uploads FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert font uploads"
  ON font_uploads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update font uploads"
  ON font_uploads FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete font uploads"
  ON font_uploads FOR DELETE
  TO anon, authenticated
  USING (true);
