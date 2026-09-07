SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'created_at'
ORDER BY table_name;
