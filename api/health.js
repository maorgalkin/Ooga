// api-src/health.ts
function handler(_req, res) {
  res.json({ ok: true, node: process.version });
}
export {
  handler as default
};
