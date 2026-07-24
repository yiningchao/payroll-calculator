"use client";

import { useMemo, useState } from "react";

type Bracket = [number, number];
type Province = {
  name: string;
  claim: number;
  brackets: Bracket[];
};
type PayrollResult = {
  taxablePay: number;
  annualGross: number;
  cpp: number;
  ei: number;
  qpip: number;
  federalTax: number;
  provincialTax: number;
  extra: number;
  totalDeductions: number;
  net: number;
  employerCost: number;
  effectiveRate: number;
};

const FEDERAL: Bracket[] = [
  [58_523, 0.14],
  [117_045, 0.205],
  [181_440, 0.26],
  [258_482, 0.29],
  [Infinity, 0.33],
];

const PROVINCES: Record<string, Province> = {
  AB: { name: "Alberta", claim: 22_769, brackets: [[61_200, .08], [154_259, .10], [185_111, .12], [246_813, .13], [370_220, .14], [Infinity, .15]] },
  BC: { name: "British Columbia", claim: 13_216, brackets: [[50_363, .0614], [100_728, .077], [115_648, .105], [140_430, .1229], [190_405, .147], [265_545, .168], [Infinity, .205]] },
  MB: { name: "Manitoba", claim: 15_780, brackets: [[47_000, .108], [100_000, .1275], [Infinity, .174]] },
  NB: { name: "New Brunswick", claim: 13_664, brackets: [[52_333, .094], [104_666, .14], [193_861, .16], [Infinity, .195]] },
  NL: { name: "Newfoundland and Labrador", claim: 15_000, brackets: [[44_678, .087], [89_354, .145], [159_528, .158], [223_340, .178], [285_319, .198], [570_638, .208], [1_141_275, .213], [Infinity, .218]] },
  NS: { name: "Nova Scotia", claim: 11_932, brackets: [[30_995, .0879], [61_991, .1495], [97_417, .1667], [157_124, .175], [Infinity, .21]] },
  ON: { name: "Ontario", claim: 12_989, brackets: [[53_891, .0505], [107_785, .0915], [150_000, .1116], [220_000, .1216], [Infinity, .1316]] },
  PE: { name: "Prince Edward Island", claim: 15_000, brackets: [[33_928, .095], [65_820, .1347], [106_890, .166], [142_520, .1762], [200_000, .19], [Infinity, .21]] },
  QC: { name: "Quebec", claim: 18_952, brackets: [[54_345, .14], [108_680, .19], [132_245, .24], [Infinity, .2575]] },
  SK: { name: "Saskatchewan", claim: 20_381, brackets: [[54_532, .105], [155_805, .125], [Infinity, .145]] },
  NT: { name: "Northwest Territories", claim: 18_198, brackets: [[53_003, .059], [106_009, .086], [172_346, .122], [Infinity, .1405]] },
  NU: { name: "Nunavut", claim: 19_659, brackets: [[55_801, .04], [111_602, .07], [181_439, .09], [Infinity, .115]] },
  YT: { name: "Yukon", claim: 16_452, brackets: [[58_523, .064], [117_045, .09], [181_440, .109], [500_000, .128], [Infinity, .15]] },
};

const FREQUENCIES = [
  { label: "Weekly", value: 52 },
  { label: "Biweekly", value: 26 },
  { label: "Semi-monthly", value: 24 },
  { label: "Monthly", value: 12 },
];

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const compactMoney = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const num = (value: string) => Math.max(0, Number(value) || 0);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function progressiveTax(income: number, brackets: Bracket[]) {
  let tax = 0;
  let floor = 0;
  for (const [ceiling, rate] of brackets) {
    tax += Math.max(0, Math.min(income, ceiling) - floor) * rate;
    if (income <= ceiling) break;
    floor = ceiling;
  }
  return tax;
}

function ontarioAdjustments(baseTax: number, income: number) {
  const surtax = Math.max(0, baseTax - 5_818) * .2 + Math.max(0, baseTax - 7_446) * .36;
  let health = 0;
  if (income > 20_000 && income <= 36_000) health = Math.min(300, (income - 20_000) * .06);
  else if (income <= 48_000) health = 300;
  else if (income <= 72_000) health = Math.min(450, 300 + (income - 48_000) * .06);
  else if (income <= 200_000) health = 750;
  else health = Math.min(900, 750 + (income - 200_000) * .25);
  return surtax + health;
}

function bcReduction(income: number, tax: number) {
  const reduction = income <= 25_570 ? 805 : income <= 44_952 ? Math.max(0, 805 - (income - 25_570) * .0356) : 0;
  return Math.min(tax, reduction);
}

export default function Home() {
  const [province, setProvince] = useState("AB");
  const [comparisonProvince, setComparisonProvince] = useState("ON");
  const [frequency, setFrequency] = useState(26);
  const [gross, setGross] = useState("3000");
  const [benefits, setBenefits] = useState("0");
  const [rrsp, setRrsp] = useState("0");
  const [otherDeductions, setOtherDeductions] = useState("0");
  const [federalClaim, setFederalClaim] = useState("16452");
  const [provincialClaim, setProvincialClaim] = useState(String(PROVINCES.AB.claim));
  const [comparisonClaim, setComparisonClaim] = useState(String(PROVINCES.ON.claim));
  const [additionalTax, setAdditionalTax] = useState("0");
  const [multipleEmployers, setMultipleEmployers] = useState(false);
  const [cppExempt, setCppExempt] = useState(false);
  const [eiExempt, setEiExempt] = useState(false);
  const [tdOpen, setTdOpen] = useState(true);

  const chooseProvince = (code: string) => {
    if (code === comparisonProvince) {
      setComparisonProvince(province);
      setComparisonClaim(String(PROVINCES[province].claim));
    }
    setProvince(code);
    setProvincialClaim(String(PROVINCES[code].claim));
  };

  const resultSet = useMemo(() => {
    const calculate = (provinceCode: string, claimAmount: string) => {
      const taxablePay = num(gross) + num(benefits);
      const annualGross = taxablePay * frequency;
      const annualTaxable = Math.max(0, (taxablePay - num(rrsp)) * frequency);
      const isQuebec = provinceCode === "QC";
      const pensionRate = isQuebec ? .063 : .0595;
      const pensionBase = cppExempt ? 0 : Math.min(Math.max(annualGross - 3_500, 0), 71_100) * pensionRate;
      const pension2 = cppExempt ? 0 : Math.min(Math.max(annualGross - 74_600, 0), 10_400) * .04;
      const annualPension = pensionBase + pension2;
      const annualEi = eiExempt ? 0 : Math.min(annualGross, 68_900) * (isQuebec ? .013 : .0163);
      const annualQpip = isQuebec ? Math.min(annualGross, 103_000) * .0043 : 0;
      const basePensionCredit = Math.min(Math.max(annualGross - 3_500, 0), 71_100) * (isQuebec ? .053 : .0495);
      const federalCreditClaim = multipleEmployers ? 0 : num(federalClaim);
      const provinceCreditClaim = multipleEmployers ? 0 : num(claimAmount);
      const federalCredits = .14 * (federalCreditClaim + 1_501 + basePensionCredit + annualEi + annualQpip);
      let annualFederal = Math.max(0, progressiveTax(annualTaxable, FEDERAL) - federalCredits);
      if (isQuebec) annualFederal *= .835;

      const selectedProvince = PROVINCES[provinceCode];
      const lowestRate = selectedProvince.brackets[0][1];
      let annualProvincial = Math.max(
        0,
        progressiveTax(annualTaxable, selectedProvince.brackets)
        - lowestRate * (provinceCreditClaim + basePensionCredit + annualEi + annualQpip),
      );
      if (provinceCode === "BC") annualProvincial -= bcReduction(annualTaxable, annualProvincial);
      if (provinceCode === "ON") annualProvincial += ontarioAdjustments(annualProvincial, annualTaxable);

      const cpp = round(annualPension / frequency);
      const ei = round(annualEi / frequency);
      const qpip = round(annualQpip / frequency);
      const federalTax = round(annualFederal / frequency);
      const provincialTax = round(annualProvincial / frequency);
      const extra = num(additionalTax);
      const totalDeductions = round(cpp + ei + qpip + federalTax + provincialTax + extra + num(rrsp) + num(otherDeductions));
      const net = round(num(gross) - totalDeductions);
      return {
        taxablePay,
        annualGross,
        cpp,
        ei,
        qpip,
        federalTax,
        provincialTax,
        extra,
        totalDeductions,
        net,
        employerCost: round(num(gross) + cpp + ei * 1.4 + qpip * 1.4),
        effectiveRate: taxablePay ? totalDeductions / taxablePay : 0,
      };
    };
    return {
      primary: calculate(province, provincialClaim),
      comparison: calculate(comparisonProvince, comparisonClaim),
    };
  }, [province, comparisonProvince, frequency, gross, benefits, rrsp, otherDeductions, federalClaim, provincialClaim, comparisonClaim, additionalTax, multipleEmployers, cppExempt, eiExempt]);

  const results = resultSet.primary;
  const comparison = resultSet.comparison;
  const netDifference = round(results.net - comparison.net);
  const comparisonWinner = netDifference >= 0 ? province : comparisonProvince;

  const rows = [
    { label: province === "QC" ? "QPP + QPP2" : "CPP + CPP2", value: results.cpp, tone: "blue" },
    { label: "Employment Insurance", value: results.ei, tone: "gold" },
    ...(province === "QC" ? [{ label: "QPIP", value: results.qpip, tone: "lavender" }] : []),
    { label: "Federal income tax", value: results.federalTax, tone: "red" },
    { label: `${PROVINCES[province].name} tax`, value: results.provincialTax, tone: "green" },
    ...(results.extra ? [{ label: "Additional TD1 tax", value: results.extra, tone: "ink" }] : []),
    ...(num(rrsp) ? [{ label: "RRSP / RPP", value: num(rrsp), tone: "lavender" }] : []),
    ...(num(otherDeductions) ? [{ label: "Other deductions", value: num(otherDeductions), tone: "ink" }] : []),
  ];

  const reset = () => {
    setProvince("AB"); setComparisonProvince("ON"); setFrequency(26); setGross("3000"); setBenefits("0"); setRrsp("0");
    setOtherDeductions("0"); setFederalClaim("16452"); setProvincialClaim("22769");
    setComparisonClaim("12989");
    setAdditionalTax("0"); setMultipleEmployers(false); setCppExempt(false); setEiExempt(false);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Maple Pay home">
          <span className="brand-mark">M</span>
          <span>Maple Pay</span>
        </a>
        <div className="rule-chip"><span /> 2026 rules · Updated July 1</div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">Canada payroll estimator</div>
        <h1>Your paycheque,<br /><em>made clear.</em></h1>
        <p>Turn gross pay and your TD1 claims into an easy-to-read estimate of taxes, contributions, and take-home pay.</p>
      </section>

      <section className="workspace" aria-label="Payroll calculator">
        <div className="form-panel">
          <div className="section-heading">
            <span>01</span>
            <div><h2>Pay details</h2><p>What this pay period looks like</p></div>
          </div>

          <div className="field-grid">
            <label>
              Province of employment
              <select value={province} onChange={(e) => chooseProvince(e.target.value)}>
                {Object.entries(PROVINCES).map(([code, item]) => <option value={code} key={code}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Compare with
              <select value={comparisonProvince} onChange={(e) => {
                setComparisonProvince(e.target.value);
                setComparisonClaim(String(PROVINCES[e.target.value].claim));
              }}>
                {Object.entries(PROVINCES)
                  .filter(([code]) => code !== province)
                  .map(([code, item]) => <option value={code} key={code}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Pay frequency
              <select value={frequency} onChange={(e) => setFrequency(Number(e.target.value))}>
                {FREQUENCIES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
            <MoneyField label="Gross cash pay" value={gross} onChange={setGross} />
            <MoneyField label="Taxable benefits" value={benefits} onChange={setBenefits} hint="Benefits add to taxable income, not cash pay." />
            <MoneyField label="RRSP / RPP deduction" value={rrsp} onChange={setRrsp} hint="Deducted before income tax." />
            <MoneyField label="Other after-tax deductions" value={otherDeductions} onChange={setOtherDeductions} />
          </div>

          <button className="accordion" type="button" onClick={() => setTdOpen(!tdOpen)} aria-expanded={tdOpen}>
            <span className="section-heading compact">
              <span>02</span>
              <span><b>TD1 personal tax credits</b><small>Use the totals from your signed forms</small></span>
            </span>
            <span className={`chevron ${tdOpen ? "open" : ""}`}>⌄</span>
          </button>

          {tdOpen && (
            <div className="td-card">
              <div className="field-grid">
                <MoneyField label="Federal TD1 · Total claim amount" value={federalClaim} onChange={setFederalClaim} hint="Line 13 on the 2026 federal TD1." />
                <MoneyField label={`${PROVINCES[province].name} TD1 · Total claim`} value={provincialClaim} onChange={setProvincialClaim} hint="Total from your provincial or territorial TD1." />
                <MoneyField label={`${PROVINCES[comparisonProvince].name} TD1 · Total claim`} value={comparisonClaim} onChange={setComparisonClaim} hint="Comparison province's personal claim total." />
                <MoneyField label="Additional tax per pay" value={additionalTax} onChange={setAdditionalTax} hint="The extra amount requested on the TD1." />
              </div>
              <div className="checks">
                <Check checked={multipleEmployers} onChange={setMultipleEmployers} label="More than one employer at the same time" detail="No personal claim is applied here." />
                <Check checked={cppExempt} onChange={setCppExempt} label={`${province === "QC" ? "QPP" : "CPP"} exempt`} detail="Use only when a valid exemption applies." />
                <Check checked={eiExempt} onChange={setEiExempt} label="EI exempt" detail="Use only for non-insurable employment." />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button className="reset" type="button" onClick={reset}>Reset example</button>
            <span>Values stay on this device only.</span>
          </div>
        </div>

        <aside className="results-panel" aria-live="polite">
          <div className="results-top">
            <div>
              <span className="result-label">Province comparison</span>
              <h2>Same pay. Different province.</h2>
              <small>Estimated per {FREQUENCIES.find((item) => item.value === frequency)?.label.toLowerCase()} pay</small>
            </div>
          </div>

          <div className="compare-cards">
            <ComparisonCard code={province} result={results} label="Primary" />
            <ComparisonCard code={comparisonProvince} result={comparison} label="Comparison" />
          </div>

          <div className="difference-banner">
            <span>{netDifference === 0 ? "Equal take-home pay" : `${PROVINCES[comparisonWinner].name} comes out ahead`}</span>
            <b>{netDifference === 0 ? money.format(0) : `${money.format(Math.abs(netDifference))} / pay`}</b>
            <small>{netDifference === 0 ? "with these inputs" : `${money.format(Math.abs(netDifference) * frequency)} more annualized`}</small>
          </div>

          <div className="breakdown">
            <div className="breakdown-title"><h3>{PROVINCES[province].name} breakdown</h3><span>{money.format(results.totalDeductions)}</span></div>
            {rows.map((row) => (
              <div className="deduction-row" key={row.label}>
                <div className="row-meta"><span><i className={row.tone} />{row.label}</span><b>{money.format(row.value)}</b></div>
                <div className="bar"><span className={row.tone} style={{ width: `${Math.min(100, (row.value / Math.max(results.totalDeductions, 1)) * 100)}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="annual-card">
            <div><span>Annualized gross</span><b>{compactMoney.format(results.annualGross)}</b></div>
            <div><span>Estimated employer cost</span><b>{money.format(results.employerCost)}</b></div>
          </div>

          <p className="result-note">Planning estimate for regular employment income. Bonuses, year-to-date maximums, special credits, and payroll-specific situations can change the result.</p>
        </aside>
      </section>

      <section className="rule-strip">
        <div><span>2026 CPP / QPP ceiling</span><b>$74,600</b></div>
        <div><span>CPP2 / QPP2 ceiling</span><b>$85,000</b></div>
        <div><span>EI maximum earnings</span><b>$68,900</b></div>
        <div><span>Federal first bracket</span><b>14%</b></div>
      </section>

      <footer>
        <p><b>Built from official 2026 source-deduction parameters.</b> This calculator is an estimate, not payroll or tax advice. Compare final remittances with CRA PDOC or Revenu Québec WebRAS.</p>
        <div className="source-links">
          <a href="https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jul/t4127-jul-payroll-deductions-formulas.html" target="_blank" rel="noreferrer">CRA T4127 ↗</a>
          <a href="https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns/td1-forms-pay-received-on-january-1-later/td1.html" target="_blank" rel="noreferrer">2026 TD1 ↗</a>
          <a href="https://www.revenuquebec.ca/en/online-services/forms-and-publications/current-details/tp-1015-f-v/" target="_blank" rel="noreferrer">Quebec TP-1015.F-V ↗</a>
        </div>
      </footer>
    </main>
  );
}

function MoneyField({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return (
    <label>
      {label}
      <span className="money-input"><span>$</span><input inputMode="decimal" min="0" type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} /></span>
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

function ComparisonCard({ code, result, label }: { code: string; result: PayrollResult; label: string }) {
  return (
    <article className="compare-card">
      <div className="compare-card-head">
        <span>{label}</span>
        <small>{Math.round(result.effectiveRate * 100)}% deducted</small>
      </div>
      <h3>{PROVINCES[code].name}</h3>
      <strong>{money.format(result.net)}</strong>
      <span className="take-home-label">take-home pay</span>
      <dl>
        <div><dt>Total deductions</dt><dd>{money.format(result.totalDeductions)}</dd></div>
        <div><dt>Income tax</dt><dd>{money.format(result.federalTax + result.provincialTax)}</dd></div>
        <div><dt>{code === "QC" ? "QPP, EI & QPIP" : "CPP & EI"}</dt><dd>{money.format(result.cpp + result.ei + result.qpip)}</dd></div>
      </dl>
    </article>
  );
}

function Check({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><b>{label}</b><small>{detail}</small></span>
    </label>
  );
}
