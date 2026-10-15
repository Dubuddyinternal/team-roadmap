// Vercel function → lib/pipeline/core.js. Supabase pg_cron calls this every few minutes (supabase/stage17b_pipeline_tick.sql)
// to post scheduled videos whose time has come.
import { tick } from "../../lib/pipeline/core.js";
export default tick;

// starting a cloud run can take a while: give the function up to a minute (Vercel Hobby allows 60 s)
export const maxDuration = 60;
