-- How full Supabase is, for the site's System stats (read-only; only the server key may call it)
create or replace function public.pipeline_storage_stats()
returns json
language sql
security definer
set search_path = public, pg_catalog
as $$
  select json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'storage_files', (select count(*) from storage.objects),
    'tables', (select json_agg(t) from (
        select c.relname as name, pg_total_relation_size(c.oid) as bytes
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc limit 8) t)
  );
$$;
revoke all on function public.pipeline_storage_stats() from public, anon, authenticated;
grant execute on function public.pipeline_storage_stats() to service_role;
