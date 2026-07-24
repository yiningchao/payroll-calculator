import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
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
  assert.match(html, /Salary rate<!-- --> · Canada &amp; UK/);
  assert.match(html, /United Kingdom/);
  assert.match(html, /2026–27 tax year/);
  assert.match(html, /Salary rate/);
  assert.match(html, /Regular pay basis/);
  assert.doesNotMatch(html, /Eligible overtime hours|Vacation pay treatment|Pay in lieu · weeks/);
  assert.match(html, /TD1 personal tax credits/);
  assert.match(html, /Province comparison/);
  assert.match(html, /Same pay\. Different province\./);
  assert.match(html, /Compare with/);
  assert.match(html, /Gross → Net/);
  assert.match(html, /Net → Gross/);
  assert.match(html, /Canada 2026 · UK 2026–27/);
  assert.match(html, /href="\/salary-rate"/);
  assert.match(html, /href="\/vacation-pay"/);
  assert.match(html, /href="\/overtime-pay"/);
  assert.match(html, /href="\/final-pay"/);
  assert.doesNotMatch(html, /Plane Pay|plane pay|Your paycheque|made clear|brand-mark|codex-preview|react-loading-skeleton/);
});

const toolPages = [
  ["/salary-rate", "Salary rate", "Regular pay basis"],
  ["/vacation-pay", "Vacation pay", "Vacation pay treatment"],
  ["/overtime-pay", "Overtime pay", "Eligible overtime hours"],
  ["/final-pay", "Final pay", "Pay in lieu · weeks"],
];

for (const [pathname, label, field] of toolPages) {
  test(`server-renders the ${label} page`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(label));
    assert.match(html, new RegExp(field));
    assert.match(html, /aria-label="Payroll calculators"/);
  });
}
