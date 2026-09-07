// Vercel Serverless Function entry.
// Re-exports the Express app (no listen()) bundled by artifacts/api-server/build.mjs.
// Vercel routes all /api/* requests here via the rewrite in vercel.json.
export { default } from "../artifacts/api-server/dist/app.mjs";
