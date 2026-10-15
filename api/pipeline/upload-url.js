// Vercel function → lib/pipeline/core.js (the rules live there)
import { uploadUrl } from "../../lib/pipeline/core.js";
export default uploadUrl;

// starting a cloud run can take a while: give the function up to a minute (Vercel Hobby allows 60 s)
export const maxDuration = 60;
