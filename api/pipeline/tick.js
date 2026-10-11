// Vercel function → lib/pipeline/core.js. Supabase pg_cron calls this every few minutes (supabase/stage17b_pipeline_tick.sql)
// to post scheduled videos whose time has come.
import { tick } from "../../lib/pipeline/core.js";
export default tick;
