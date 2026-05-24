CREATE UNIQUE INDEX idx_unique_source_month
ON financial_entries (source_type, source_id, (entry_date - (EXTRACT(DAY FROM entry_date)::int - 1)))
WHERE source_type IS NOT NULL AND source_id IS NOT NULL;