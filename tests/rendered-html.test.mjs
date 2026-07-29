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
  ["/vacation-pay", "Vacation pay", "Subtract vacation pay already paid"],
  ["/overtime-pay", "Overtime pay", "Eligible overtime hours"],
  ["/final-pay", "Final pay", "Notice pay input"],
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

test("vacation and final pay expose service and accrual options", async () => {
  for (const pathname of ["/vacation-pay", "/final-pay"]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.match(html, /Calculate from start and last dates/);
    assert.match(html, /Policy hours per vacation year/);
    assert.match(html, /Policy days per vacation year/);
    assert.match(html, /Enter accrued hours manually/);
    assert.match(html, /Enter accrued value manually/);
  }
});

test("final pay exposes notice and severance units", async () => {
  const response = await render("/final-pay");
  const html = await response.text();
  assert.match(html, /Weeks of notice/);
  assert.match(html, /Months of notice/);
  assert.match(html, /Enter notice value/);
  assert.match(html, /Weeks of pay/);
  assert.match(html, /Months of pay/);
  assert.match(html, /Enter direct value/);
});

test("Canada pages use the requested salary and scheduling defaults", async () => {
  for (const pathname of ["/", "/salary-rate", "/vacation-pay", "/overtime-pay", "/final-pay"]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.match(html, /Annual salary/);
    assert.match(html, /86\.67(?:<!-- -->)? hours/);
    assert.match(html, /<option value="24" selected="">Semi-monthly<\/option>/);
    assert.match(html, /<option value="BC" selected="">British Columbia<\/option>/);
  }
});

test("Canada vacation pages default to 10 policy days", async () => {
  for (const pathname of ["/vacation-pay", "/final-pay"]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.match(html, /Policy days per vacation year/);
    assert.match(html, /Policy days per vacation year[\s\S]{0,300}value="10"/);
  }
});
