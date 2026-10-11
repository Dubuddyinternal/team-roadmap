// Checks the R2 link signing against AWS's published presigned-URL example
// (S3 docs, "Authenticating Requests: Using Query Parameters"). Run: node local/test-sigv4.mjs
import { presignV4 } from "../lib/pipeline/files.js";
const url = presignV4({ method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", region: "us-east-1",
  accessKey: "AKIAIOSFODNN7EXAMPLE", secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", expires: 86400, now: new Date("2013-05-24T00:00:00Z") });
const want = "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404";
const got = url.split("X-Amz-Signature=")[1];
console.log(got === want ? "✓ signature matches AWS's example" : `✗ got ${got}\n  want ${want}`);
process.exit(got === want ? 0 : 1);
