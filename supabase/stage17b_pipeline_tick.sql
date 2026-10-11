-- =====================================================================
-- STAGE 17b: Claude pipeline, scheduled posts go out on time
--
-- WHAT THIS DOES, in plain words:
--   * Every 5 minutes, Supabase calls the website's /api/pipeline/tick,
--     which posts any approved video whose "Post at slot" time has come.
--   * The key is kept in Supabase Vault (not in this file). Put it there first:
--       select vault.create_secret('<TICK KEY>', 'pipeline_tick_key');
--     where <TICK KEY> is printed by:  node -e "console.log(require('crypto').createHmac('sha256', process.env.PIPELINE_SECRET).update('tick').digest('hex'))"
--
-- WHAT THIS DOES NOT DO: it deletes nothing and changes nothing that exists.
-- =====================================================================
select cron.schedule('pipeline-tick', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://tools.dubuddy.in/api/pipeline/tick',
    headers := jsonb_build_object('content-type', 'application/json',
               'x-pipeline-key', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_tick_key')),
    body    := '{}'::jsonb)
$$);
