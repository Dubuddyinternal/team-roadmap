// Vercel function → lib/pipeline/core.js (the rules live there): raw video + audio, deleting files, storage stats
import { storage } from "../../lib/pipeline/core.js";
export default storage;

// listing the whole bucket for the stats can take a few seconds
export const maxDuration = 60;
