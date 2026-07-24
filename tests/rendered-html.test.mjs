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

test("server-renders the Canada and UK payroll calculator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Canada &amp; UK Payroll Calculator/);
  assert.match(html, /Canada &amp; UK payroll estimator/);
  assert.match(html, /United Kingdom/);
  assert.match(html, /2026–27 tax year/);
  assert.match(html, /Salary, overtime &amp; final pay/);
  assert.match(html, /Regular pay basis/);
  assert.match(html, /Eligible overtime hours/);
  assert.match(html, /Vacation pay treatment/);
  assert.match(html, /This is a final pay/);
  assert.match(html, /TD1 personal tax credits/);
  assert.match(html, /Province comparison/);
  assert.match(html, /Same pay\. Different province\./);
  assert.match(html, /Compare with/);
  assert.match(html, /Gross → Net/);
  assert.match(html, /Net → Gross/);
  assert.match(html, /Canada 2026 · UK 2026–27/);
  assert.doesNotMatch(html, /Plane Pay|plane pay|Your paycheque|made clear|brand-mark|codex-preview|react-loading-skeleton/);
});
