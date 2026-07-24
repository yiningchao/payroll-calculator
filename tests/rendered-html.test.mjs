import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Canadian payroll calculator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Plane Pay/);
  assert.match(html, /Canada payroll estimator/);
  assert.match(html, /TD1 personal tax credits/);
  assert.match(html, /Province comparison/);
  assert.match(html, /Same pay\. Different province\./);
  assert.match(html, /Compare with/);
  assert.match(html, /Gross → Net/);
  assert.match(html, /Net → Gross/);
  assert.match(html, /2026 rules/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
