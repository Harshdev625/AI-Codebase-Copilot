-- Add plan file path column for Cursor-style plan markdown files
ALTER TABLE change_sets ADD COLUMN IF NOT EXISTS plan_file_path VARCHAR NULL;
