// Rebuilds entry.png from build.html using a local headless Chrome over CDP.
// Run: node render.mjs [output.png] [page-url]
// The Chrome on this machine needs its WebGL domain policy flags; pass them
// through CHROME_FLAGS if your build differs.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const out = process.argv[2] ?? "entry.png";
const page = process.argv[3] ?? `file://${process.cwd()}/build.html`;
const chrome = process.env.CHROME_BIN ?? "/opt/meta-chromium/chrome";
const policy = "/tmp/webgl-policy.txt";
const { createHash } = await import("node:crypto");
const { readFileSync } = await import("node:fs");
const sha = createHash("sha256").update(readFileSync(policy)).digest("hex");

const child = execFileSync(chrome, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
  "--user-data-dir=/tmp/chrome-render-prof",
  "--remote-debugging-port=9223",
  `--hatch-webgl-allowed-domains-file=${policy}`,
  `--hatch-webgl-allowed-domains-sha256=${sha}`,
  "about:blank",
], { stdio: "ignore", detached: true });
child.unref();
await new Promise((r) => setTimeout(r, 4000));

const ver = await (await fetch("http://127.0.0.1:9223/json/version")).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const mid = ++id;
  pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  else if (m.method) events.push(m);
};
await new Promise((r) => { ws.onopen = r; });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 1024, deviceScaleFactor: 1, mobile: false }, sessionId);
await send("Page.navigate", { url: page }, sessionId);
await new Promise((r) => {
  const t = setInterval(() => {
    if (events.some((e) => e.method === "Page.loadEventFired")) { clearInterval(t); r(); }
  }, 100);
  setTimeout(() => { clearInterval(t); r(); }, 8000);
});
await new Promise((r) => setTimeout(r, 800));
const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`wrote ${out}`);
ws.close();
process.exit(0);
