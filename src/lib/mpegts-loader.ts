// Static-import wrapper so Turbopack bundles mpegts.js at build time.
// (mpegts.js ships only a UMD build with no ESM "module" field, so a
// runtime `await import("mpegts.js")` fails to resolve in the browser.)
import mpegts from "mpegts.js";

export type Mpegts = typeof mpegts;
export default mpegts;
