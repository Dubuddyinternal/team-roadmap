// Vercel function → lib/pipeline/core.js: copy the raw video from a Google Drive / OneDrive / Dropbox link into storage
import { importLink } from "../../lib/pipeline/core.js";
export default importLink;

// each call copies pieces for ~40 s, then the browser calls again
export const maxDuration = 60;
