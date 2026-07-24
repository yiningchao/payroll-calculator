"use client";

import { useMemo, useState } from "react";

type Bracket = [number, number];
type Province = {
  name: string;
  claim: number;
  brackets: Bracket[];
};
type PayrollResult = {
  grossPay: number;
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
type UKPayrollResult = {
  grossPay: number;
  taxablePay: number;
  annualGross: number;
  incomeTax: number;
  nationalInsurance: number;
  studentLoan: number;
  postgraduateLoan: number;
  pension: number;
  other: number;
  totalDeductions: number;
  net: number;
  employerNI: number;
  employerCost: number;
  effectiveRate: number;
};
type UKRegion = "rUK" | "SCT";
type UKTaxBasis = "standard" | "basic" | "higher" | "advanced" | "top" | "none";
type NICategory = "A" | "B" | "C" | "J";

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
const UK_FREQUENCIES = [
  { label: "Weekly", value: 52 },
  { label: "Fortnightly", value: 26 },
  { label: "Monthly", value: 12 },
];

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const compactMoney = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const compactPounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const num = (value: string) => Math.max(0, Number(value) || 0);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const UK_REGIONS: Record<UKRegion, string> = {
  rUK: "England, Wales & N. Ireland",
  SCT: "Scotland",
};

const UK_TAX_BRACKETS: Record<UKRegion, Bracket[]> = {
  rUK: [[37_700, .2], [125_140, .4], [Infinity, .45]],
  SCT: [[3_967, .19], [16_956, .2], [31_092, .21], [62_430, .42], [125_140, .45], [Infinity, .48]],
};

const STUDENT_LOAN_PERIOD_THRESHOLDS: Record<string, [number, number]> = {
  "1": [517.30, 2_241.66],
  "2": [565.09, 2_448.75],
  "4": [649.90, 2_816.25],
  "5": [480.76, 2_083.33],
};

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
  if (income <= 20_000) health = 0;
  else if (income <= 36_000) health = Math.min(300, (income - 20_000) * .06);
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

function ukPersonalAllowance(income: number) {
  return Math.max(0, 12_570 - Math.floor(Math.max(0, income - 100_000) / 2));
}

function ukFlatTaxRate(region: UKRegion, basis: UKTaxBasis) {
  if (basis === "none") return 0;
  if (basis === "basic") return .2;
  if (basis === "higher") return region === "SCT" ? .42 : .4;
  if (basis === "advanced") return .45;
  if (basis === "top") return region === "SCT" ? .48 : .45;
  return null;
}

function ukPeriodThreshold(frequency: number, weekly: number, monthly: number) {
  if (frequency === 12) return monthly;
  if (frequency === 26) return weekly * 2;
  return weekly;
}

function ukStudentLoanThreshold(plan: string, frequency: number) {
  const [weekly, monthly] = STUDENT_LOAN_PERIOD_THRESHOLDS[plan];
  return ukPeriodThreshold(frequency, weekly, monthly);
}

export default function Home() {
  const [country, setCountry] = useState<"CA" | "UK">("CA");
  const [calculationMode, setCalculationMode] = useState<"grossToNet" | "netToGross">("grossToNet");
  const [province, setProvince] = useState("AB");
  const [comparisonProvince, setComparisonProvince] = useState("ON");
  const [frequency, setFrequency] = useState(26);
  const [gross, setGross] = useState("3000");
  const [targetNet, setTargetNet] = useState("2300");
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
  const [ukRegion, setUkRegion] = useState<UKRegion>("rUK");
  const [ukComparisonRegion, setUkComparisonRegion] = useState<UKRegion>("SCT");
  const [ukTaxBasis, setUkTaxBasis] = useState<UKTaxBasis>("standard");
  const [niCategory, setNiCategory] = useState<NICategory>("A");
  const [studentLoanPlan, setStudentLoanPlan] = useState("none");
  const [postgraduateLoan, setPostgraduateLoan] = useState(false);
  const [salarySacrifice, setSalarySacrifice] = useState("0");

  const chooseProvince = (code: string) => {
    if (code === comparisonProvince) {
      setComparisonProvince(province);
      setComparisonClaim(String(PROVINCES[province].claim));
    }
    setProvince(code);
    setProvincialClaim(String(PROVINCES[code].claim));
  };

  const chooseUKRegion = (region: UKRegion) => {
    if (region === ukComparisonRegion) setUkComparisonRegion(ukRegion);
    setUkRegion(region);
  };

  const switchCountry = (nextCountry: "CA" | "UK") => {
    setCountry(nextCountry);
    if (nextCountry === "UK" && frequency === 24) setFrequency(12);
  };

  const canadaResultSet = useMemo(() => {
    const calculate = (provinceCode: string, claimAmount: string, grossPay: number): PayrollResult => {
      const taxablePay = grossPay + num(benefits);
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
      const net = round(grossPay - totalDeductions);
      return {
        grossPay,
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
        employerCost: round(grossPay + cpp + ei * 1.4 + qpip * 1.4),
        effectiveRate: taxablePay ? totalDeductions / taxablePay : 0,
      };
    };

    const grossUp = (provinceCode: string, claimAmount: string) => {
      const target = num(targetNet);
      let low = 0;
      let high = Math.max(1_000, target * 2);
      while (calculate(provinceCode, claimAmount, high).net < target && high < 10_000_000) high *= 2;
      for (let step = 0; step < 60; step += 1) {
        const midpoint = (low + high) / 2;
        if (calculate(provinceCode, claimAmount, midpoint).net < target) low = midpoint;
        else high = midpoint;
      }
      return calculate(provinceCode, claimAmount, Math.ceil(high * 100) / 100);
    };

    if (calculationMode === "netToGross") {
      return {
        primary: grossUp(province, provincialClaim),
        comparison: grossUp(comparisonProvince, comparisonClaim),
      };
    }
    return {
      primary: calculate(province, provincialClaim, num(gross)),
      comparison: calculate(comparisonProvince, comparisonClaim, num(gross)),
    };
  }, [calculationMode, province, comparisonProvince, frequency, gross, targetNet, benefits, rrsp, otherDeductions, federalClaim, provincialClaim, comparisonClaim, additionalTax, multipleEmployers, cppExempt, eiExempt]);

  const ukResultSet = useMemo(() => {
    const calculate = (region: UKRegion, grossPay: number): UKPayrollResult => {
      const pension = Math.min(grossPay, num(salarySacrifice));
      const niPay = Math.max(0, grossPay + num(benefits) - pension);
      const annualGross = niPay * frequency;
      const flatRate = ukFlatTaxRate(region, ukTaxBasis);
      const annualIncomeTax = flatRate === null
        ? progressiveTax(Math.max(0, annualGross - ukPersonalAllowance(annualGross)), UK_TAX_BRACKETS[region])
        : annualGross * flatRate;

      const primaryThreshold = ukPeriodThreshold(frequency, 242, 1_048);
      const upperEarningsLimit = ukPeriodThreshold(frequency, 967, 4_189);
      const secondaryThreshold = ukPeriodThreshold(frequency, 96, 417);
      const niRates: Record<NICategory, [number, number]> = {
        A: [.08, .02],
        B: [.0185, .02],
        C: [0, 0],
        J: [.02, .02],
      };
      const [mainNIRate, upperNIRate] = niRates[niCategory];
      const nationalInsurance = round(
        Math.max(0, Math.min(niPay, upperEarningsLimit) - primaryThreshold) * mainNIRate
        + Math.max(0, niPay - upperEarningsLimit) * upperNIRate,
      );
      const employerNI = round(Math.max(0, niPay - secondaryThreshold) * .15);
      const incomeTax = round(annualIncomeTax / frequency);
      const studentLoan = studentLoanPlan === "none"
        ? 0
        : Math.floor(Math.max(0, niPay - ukStudentLoanThreshold(studentLoanPlan, frequency)) * .09);
      const postgraduate = postgraduateLoan
        ? Math.floor(Math.max(0, niPay - ukPeriodThreshold(frequency, 403.84, 1_750)) * .06)
        : 0;
      const other = num(otherDeductions);
      const totalDeductions = round(incomeTax + nationalInsurance + studentLoan + postgraduate + pension + other);
      const net = round(grossPay - totalDeductions);

      return {
        grossPay,
        taxablePay: niPay,
        annualGross,
        incomeTax,
        nationalInsurance,
        studentLoan,
        postgraduateLoan: postgraduate,
        pension,
        other,
        totalDeductions,
        net,
        employerNI,
        employerCost: round(grossPay + num(benefits) + employerNI),
        effectiveRate: grossPay ? totalDeductions / grossPay : 0,
      };
    };

    const grossUp = (region: UKRegion) => {
      const target = num(targetNet);
      let low = 0;
      let high = Math.max(1_000, target * 2);
      while (calculate(region, high).net < target && high < 10_000_000) high *= 2;
      for (let step = 0; step < 60; step += 1) {
        const midpoint = (low + high) / 2;
        if (calculate(region, midpoint).net < target) low = midpoint;
        else high = midpoint;
      }
      return calculate(region, Math.ceil(high * 100) / 100);
    };

    if (calculationMode === "netToGross") {
      return { primary: grossUp(ukRegion), comparison: grossUp(ukComparisonRegion) };
    }
    return {
      primary: calculate(ukRegion, num(gross)),
      comparison: calculate(ukComparisonRegion, num(gross)),
    };
  }, [calculationMode, ukRegion, ukComparisonRegion, frequency, gross, targetNet, benefits, salarySacrifice, otherDeductions, ukTaxBasis, niCategory, studentLoanPlan, postgraduateLoan]);

  const results = canadaResultSet.primary;
  const comparison = canadaResultSet.comparison;
  const ukResults = ukResultSet.primary;
  const ukComparison = ukResultSet.comparison;
  const isGrossUp = calculationMode === "netToGross";
  const comparisonDifference = round(isGrossUp ? results.grossPay - comparison.grossPay : results.net - comparison.net);
  const comparisonWinner = isGrossUp
    ? (comparisonDifference <= 0 ? province : comparisonProvince)
    : (comparisonDifference >= 0 ? province : comparisonProvince);

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

  const ukComparisonDifference = round(isGrossUp ? ukResults.grossPay - ukComparison.grossPay : ukResults.net - ukComparison.net);
  const ukComparisonWinner = isGrossUp
    ? (ukComparisonDifference <= 0 ? ukRegion : ukComparisonRegion)
    : (ukComparisonDifference >= 0 ? ukRegion : ukComparisonRegion);
  const ukRows = [
    { label: "PAYE income tax", value: ukResults.incomeTax, tone: "red" },
    { label: "Employee National Insurance", value: ukResults.nationalInsurance, tone: "blue" },
    ...(ukResults.studentLoan ? [{ label: `Student loan · Plan ${studentLoanPlan}`, value: ukResults.studentLoan, tone: "gold" }] : []),
    ...(ukResults.postgraduateLoan ? [{ label: "Postgraduate loan", value: ukResults.postgraduateLoan, tone: "green" }] : []),
    ...(ukResults.pension ? [{ label: "Pension salary sacrifice", value: ukResults.pension, tone: "lavender" }] : []),
    ...(ukResults.other ? [{ label: "Other deductions", value: ukResults.other, tone: "ink" }] : []),
  ];

  const reset = () => {
    setCalculationMode("grossToNet"); setProvince("AB"); setComparisonProvince("ON"); setFrequency(26); setGross("3000"); setTargetNet("2300"); setBenefits("0"); setRrsp("0");
    setOtherDeductions("0"); setFederalClaim("16452"); setProvincialClaim("22769");
    setComparisonClaim("12989");
    setAdditionalTax("0"); setMultipleEmployers(false); setCppExempt(false); setEiExempt(false);
    setUkRegion("rUK"); setUkComparisonRegion("SCT"); setUkTaxBasis("standard"); setNiCategory("A");
    setStudentLoanPlan("none"); setPostgraduateLoan(false); setSalarySacrifice("0");
  };

  return (
    <main>
      <header className="topbar">
        <div className="rule-chip"><span /> Canada 2026 · UK 2026–27</div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>●</span> Canada &amp; UK payroll estimator</div>
        <p>Calculate take-home pay from gross earnings—or gross up the pay required for a target net amount—under Canadian or UK payroll rules.</p>
      </section>

      <section className="workspace" aria-label="Payroll calculator">
        <div className="form-panel">
          <div className="section-heading">
            <span>01</span>
            <div><h2>Pay details</h2><p>What this pay period looks like</p></div>
          </div>

          <div className="country-switch" role="group" aria-label="Payroll country">
            <button type="button" aria-pressed={country === "CA"} className={country === "CA" ? "active" : ""} onClick={() => switchCountry("CA")}>
              <b>Canada</b><small>2026 calendar year</small>
            </button>
            <button type="button" aria-pressed={country === "UK"} className={country === "UK" ? "active" : ""} onClick={() => switchCountry("UK")}>
              <b>United Kingdom</b><small>2026–27 tax year</small>
            </button>
          </div>

          <div className="mode-switch" role="group" aria-label="Calculation direction">
            <button type="button" aria-pressed={calculationMode === "grossToNet"} className={calculationMode === "grossToNet" ? "active" : ""} onClick={() => setCalculationMode("grossToNet")}>
              <b>Gross → Net</b><small>Calculate take-home pay</small>
            </button>
            <button type="button" aria-pressed={calculationMode === "netToGross"} className={calculationMode === "netToGross" ? "active" : ""} onClick={() => setCalculationMode("netToGross")}>
              <b>Net → Gross</b><small>Gross up a target net</small>
            </button>
          </div>

          {country === "CA" ? (
            <>
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
                <FrequencyField frequency={frequency} setFrequency={setFrequency} options={FREQUENCIES} />
                {isGrossUp
                  ? <MoneyField label="Target take-home pay" value={targetNet} onChange={setTargetNet} hint="The cash amount the employee should receive." />
                  : <MoneyField label="Gross cash pay" value={gross} onChange={setGross} />}
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
            </>
          ) : (
            <>
              <div className="field-grid">
                <label>
                  Tax region
                  <select value={ukRegion} onChange={(e) => chooseUKRegion(e.target.value as UKRegion)}>
                    {Object.entries(UK_REGIONS).map(([code, name]) => <option value={code} key={code}>{name}</option>)}
                  </select>
                </label>
                <label>
                  Compare with
                  <select value={ukComparisonRegion} onChange={(e) => setUkComparisonRegion(e.target.value as UKRegion)}>
                    {Object.entries(UK_REGIONS).filter(([code]) => code !== ukRegion).map(([code, name]) => <option value={code} key={code}>{name}</option>)}
                  </select>
                </label>
                <FrequencyField frequency={frequency} setFrequency={setFrequency} options={UK_FREQUENCIES} />
                {isGrossUp
                  ? <MoneyField symbol="£" label="Target take-home pay" value={targetNet} onChange={setTargetNet} hint="The cash amount the employee should receive." />
                  : <MoneyField symbol="£" label="Gross cash pay" value={gross} onChange={setGross} />}
                <MoneyField symbol="£" label="Payrolled taxable benefits" value={benefits} onChange={setBenefits} hint="Included in taxable and NI-able pay for this estimate." />
                <MoneyField symbol="£" label="Pension salary sacrifice" value={salarySacrifice} onChange={setSalarySacrifice} hint="Reduces cash pay, PAYE pay and NI pay." />
                <MoneyField symbol="£" label="Other after-tax deductions" value={otherDeductions} onChange={setOtherDeductions} />
              </div>

              <div className="uk-settings">
                <div className="section-heading compact">
                  <span>02</span>
                  <span><b>UK payroll settings</b><small>Use the employee’s HMRC notices and starter details</small></span>
                </div>
                <div className="field-grid">
                  <label>
                    PAYE tax basis
                    <select value={ukTaxBasis} onChange={(e) => setUkTaxBasis(e.target.value as UKTaxBasis)}>
                      <option value="standard">Standard allowance · 1257L / S1257L</option>
                      <option value="basic">Basic rate · BR / SBR</option>
                      <option value="higher">Higher rate · D0 / SD1</option>
                      <option value="advanced">Additional / advanced · D1 / SD2</option>
                      <option value="top">Top rate · D1 / SD3</option>
                      <option value="none">No tax · NT</option>
                    </select>
                  </label>
                  <label>
                    National Insurance category
                    <select value={niCategory} onChange={(e) => setNiCategory(e.target.value as NICategory)}>
                      <option value="A">A · Standard employee</option>
                      <option value="B">B · Reduced-rate married woman / widow</option>
                      <option value="C">C · State Pension age</option>
                      <option value="J">J · NI deferment</option>
                    </select>
                  </label>
                  <label>
                    Student loan
                    <select value={studentLoanPlan} onChange={(e) => setStudentLoanPlan(e.target.value)}>
                      <option value="none">No student loan</option>
                      <option value="1">Plan 1</option>
                      <option value="2">Plan 2</option>
                      <option value="4">Plan 4</option>
                      <option value="5">Plan 5</option>
                    </select>
                  </label>
                </div>
                <div className="checks single-check">
                  <Check checked={postgraduateLoan} onChange={setPostgraduateLoan} label="Postgraduate loan" detail="Deduct 6% above the 2026–27 threshold." />
                </div>
              </div>
            </>
          )}

          <div className="form-actions">
            <button className="reset" type="button" onClick={reset}>Reset example</button>
            <span>Values stay on this device only.</span>
          </div>
        </div>

        <aside className="results-panel" aria-live="polite">
          {country === "CA" ? (
            <>
              <div className="results-top">
                <div>
                  <span className="result-label">{isGrossUp ? "Gross-up comparison" : "Province comparison"}</span>
                  <h2>{isGrossUp ? "Target net. Required gross." : "Same pay. Different province."}</h2>
                  <small>Estimated per {FREQUENCIES.find((item) => item.value === frequency)?.label.toLowerCase()} pay</small>
                </div>
              </div>

              <div className="compare-cards">
                <ComparisonCard code={province} result={results} label="Primary" grossUp={isGrossUp} />
                <ComparisonCard code={comparisonProvince} result={comparison} label="Comparison" grossUp={isGrossUp} />
              </div>

              <div className="difference-banner">
                <span>{comparisonDifference === 0
                  ? (isGrossUp ? "Equal gross pay required" : "Equal take-home pay")
                  : `${PROVINCES[comparisonWinner].name} ${isGrossUp ? "requires less gross" : "comes out ahead"}`}</span>
                <b>{comparisonDifference === 0 ? money.format(0) : `${money.format(Math.abs(comparisonDifference))} / pay`}</b>
                <small>{comparisonDifference === 0 ? "with these inputs" : `${money.format(Math.abs(comparisonDifference) * frequency)} difference annualized`}</small>
              </div>

              <DeductionBreakdown title={`${PROVINCES[province].name} breakdown`} total={results.totalDeductions} rows={rows} format={money} />

              <div className="annual-card">
                <div><span>{isGrossUp ? "Required annual cash gross" : "Annualized gross"}</span><b>{compactMoney.format(results.grossPay * frequency)}</b></div>
                <div><span>Estimated employer cost</span><b>{money.format(results.employerCost)}</b></div>
              </div>

              <p className="result-note">Planning estimate for regular employment income. Bonuses, year-to-date maximums, special credits, and payroll-specific situations can change the result.</p>
            </>
          ) : (
            <>
              <div className="results-top">
                <div>
                  <span className="result-label">{isGrossUp ? "UK gross-up comparison" : "UK tax-region comparison"}</span>
                  <h2>{isGrossUp ? "Target net. Required gross." : "Same pay. Different UK tax region."}</h2>
                  <small>2026–27 estimate per {UK_FREQUENCIES.find((item) => item.value === frequency)?.label.toLowerCase()} pay</small>
                </div>
              </div>

              <div className="compare-cards">
                <UKComparisonCard region={ukRegion} result={ukResults} label="Primary" grossUp={isGrossUp} />
                <UKComparisonCard region={ukComparisonRegion} result={ukComparison} label="Comparison" grossUp={isGrossUp} />
              </div>

              <div className="difference-banner">
                <span>{ukComparisonDifference === 0
                  ? (isGrossUp ? "Equal gross pay required" : "Equal take-home pay")
                  : `${UK_REGIONS[ukComparisonWinner]} ${isGrossUp ? "requires less gross" : "comes out ahead"}`}</span>
                <b>{ukComparisonDifference === 0 ? pounds.format(0) : `${pounds.format(Math.abs(ukComparisonDifference))} / pay`}</b>
                <small>{ukComparisonDifference === 0 ? "with these inputs" : `${pounds.format(Math.abs(ukComparisonDifference) * frequency)} difference annualized`}</small>
              </div>

              <DeductionBreakdown title={`${UK_REGIONS[ukRegion]} breakdown`} total={ukResults.totalDeductions} rows={ukRows} format={pounds} />

              <div className="annual-card">
                <div><span>{isGrossUp ? "Required annual cash gross" : "Annualized gross"}</span><b>{compactPounds.format(ukResults.grossPay * frequency)}</b></div>
                <div><span>Employer NI / cost per pay</span><b>{pounds.format(ukResults.employerNI)} / {pounds.format(ukResults.employerCost)}</b></div>
              </div>

              <p className="result-note">Regular-pay estimate using the selected tax basis. Exact PAYE may differ for cumulative codes, emergency codes, year-to-date pay, directors, irregular periods, benefits not processed through payroll, or HMRC notices.</p>
            </>
          )}
        </aside>
      </section>

      {country === "CA" ? (
        <>
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
        </>
      ) : (
        <>
          <section className="rule-strip">
            <div><span>Standard allowance</span><b>£12,570</b></div>
            <div><span>Employee NI main rate</span><b>8%</b></div>
            <div><span>NI primary threshold</span><b>£12,570</b></div>
            <div><span>Employer NI rate</span><b>15%</b></div>
          </section>
          <footer>
            <p><b>Built from official HMRC 2026–27 rates and thresholds.</b> This is a regular-pay estimate, not payroll or tax advice. Use HMRC-recognised payroll software for submissions and final deductions.</p>
            <div className="source-links">
              <a href="https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027" target="_blank" rel="noreferrer">HMRC rates ↗</a>
              <a href="https://www.gov.uk/tax-codes/what-your-tax-code-means" target="_blank" rel="noreferrer">Tax codes ↗</a>
              <a href="https://www.gov.uk/guidance/special-rules-for-student-loans" target="_blank" rel="noreferrer">Student loans ↗</a>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}

function MoneyField({ label, value, onChange, hint, symbol = "$" }: { label: string; value: string; onChange: (value: string) => void; hint?: string; symbol?: string }) {
  return (
    <label>
      {label}
      <span className="money-input"><span>{symbol}</span><input inputMode="decimal" min="0" type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} /></span>
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

function FrequencyField({ frequency, setFrequency, options }: { frequency: number; setFrequency: (value: number) => void; options: typeof FREQUENCIES }) {
  return (
    <label>
      Pay frequency
      <select value={frequency} onChange={(e) => setFrequency(Number(e.target.value))}>
        {options.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
      </select>
    </label>
  );
}

function ComparisonCard({ code, result, label, grossUp }: { code: string; result: PayrollResult; label: string; grossUp: boolean }) {
  return (
    <article className="compare-card">
      <div className="compare-card-head">
        <span>{label}</span>
        <small>{Math.round(result.effectiveRate * 100)}% deducted</small>
      </div>
      <h3>{PROVINCES[code].name}</h3>
      <strong>{money.format(grossUp ? result.grossPay : result.net)}</strong>
      <span className="take-home-label">{grossUp ? "required gross pay" : "take-home pay"}</span>
      <dl>
        {grossUp && <div><dt>Target take-home</dt><dd>{money.format(result.net)}</dd></div>}
        <div><dt>Total deductions</dt><dd>{money.format(result.totalDeductions)}</dd></div>
        <div><dt>Income tax</dt><dd>{money.format(result.federalTax + result.provincialTax)}</dd></div>
        <div><dt>{code === "QC" ? "QPP, EI & QPIP" : "CPP & EI"}</dt><dd>{money.format(result.cpp + result.ei + result.qpip)}</dd></div>
      </dl>
    </article>
  );
}

function UKComparisonCard({ region, result, label, grossUp }: { region: UKRegion; result: UKPayrollResult; label: string; grossUp: boolean }) {
  return (
    <article className="compare-card">
      <div className="compare-card-head">
        <span>{label}</span>
        <small>{Math.round(result.effectiveRate * 100)}% deducted</small>
      </div>
      <h3>{UK_REGIONS[region]}</h3>
      <strong>{pounds.format(grossUp ? result.grossPay : result.net)}</strong>
      <span className="take-home-label">{grossUp ? "required gross pay" : "take-home pay"}</span>
      <dl>
        {grossUp && <div><dt>Target take-home</dt><dd>{pounds.format(result.net)}</dd></div>}
        <div><dt>Total deductions</dt><dd>{pounds.format(result.totalDeductions)}</dd></div>
        <div><dt>PAYE income tax</dt><dd>{pounds.format(result.incomeTax)}</dd></div>
        <div><dt>Employee NI</dt><dd>{pounds.format(result.nationalInsurance)}</dd></div>
      </dl>
    </article>
  );
}

function DeductionBreakdown({ title, total, rows, format }: {
  title: string;
  total: number;
  rows: { label: string; value: number; tone: string }[];
  format: Intl.NumberFormat;
}) {
  return (
    <div className="breakdown">
      <div className="breakdown-title"><h3>{title}</h3><span>{format.format(total)}</span></div>
      {rows.map((row) => (
        <div className="deduction-row" key={row.label}>
          <div className="row-meta"><span><i className={row.tone} />{row.label}</span><b>{format.format(row.value)}</b></div>
          <div className="bar"><span className={row.tone} style={{ width: `${Math.min(100, (row.value / Math.max(total, 1)) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
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
