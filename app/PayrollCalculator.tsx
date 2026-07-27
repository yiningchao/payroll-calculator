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
type PayBasis = "period" | "annual" | "hourly";
type VacationMode = "none" | "eachPay" | "final";
type VacationPaidMode = "none" | "amount" | "hours";
type ServiceMode = "manual" | "dates";
type VacationAccrualMode = "statutory" | "policyHours" | "policyDays" | "manualHours" | "manualValue";
type FinalPayInputMode = "weeks" | "months" | "value";
type ToolPage = "salary" | "vacation" | "overtime" | "final";
type EarningsBreakdown = {
  regular: number;
  overtime: number;
  vacation: number;
  notice: number;
  terminationTaxable: number;
  terminationTaxFree: number;
  taxableGross: number;
  totalGross: number;
  hourlyRate: number;
  weeklyRate: number;
  vacationRate: number;
  vacationBeforePaid: number;
  vacationPaidDeduction: number;
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
const DAY_MS = 86_400_000;

function utcDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function serviceYearsBetween(start: string, end: string) {
  const startTime = utcDate(start);
  const endTime = utcDate(end);
  if (startTime === null || endTime === null || endTime < startTime) return 0;
  return (endTime - startTime) / DAY_MS / 365.2425;
}

function vacationYearFraction(start: string, end: string) {
  const startTime = utcDate(start);
  const endTime = utcDate(end);
  if (startTime === null || endTime === null || endTime < startTime) return 0;
  const startDate = new Date(startTime);
  const nextYear = Date.UTC(startDate.getUTCFullYear() + 1, startDate.getUTCMonth(), startDate.getUTCDate());
  return Math.min(1, (endTime - startTime + DAY_MS) / Math.max(DAY_MS, nextYear - startTime));
}

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

const VACATION_RULES: Record<string, { threshold: number; low: number; high: number; label: string }> = {
  AB: { threshold: 5, low: .04, high: .06, label: "4% under 5 years · 6% from 5 years" },
  BC: { threshold: 5, low: .04, high: .06, label: "4% under 5 years · 6% from 5 years" },
  MB: { threshold: 5, low: .04, high: .06, label: "4% under 5 years · 6% from 5 years" },
  NB: { threshold: 8, low: .04, high: .06, label: "4% under 8 years · 6% from 8 years" },
  NL: { threshold: 15, low: .04, high: .06, label: "4% under 15 years · 6% from 15 years" },
  NS: { threshold: 8, low: .04, high: .06, label: "4% under 8 years · 6% from 8 years" },
  ON: { threshold: 5, low: .04, high: .06, label: "4% under 5 years · 6% from 5 years" },
  PE: { threshold: 8, low: .04, high: .06, label: "4% under 8 years · 6% from 8 years" },
  QC: { threshold: 3, low: .04, high: .06, label: "4% under 3 years · 6% from 3 years" },
  SK: { threshold: 10, low: 3 / 52, high: 4 / 52, label: "3/52 under 10 years · 4/52 from 10 years" },
  NT: { threshold: 5, low: .04, high: .06, label: "4% first 5 years · 6% from year 6" },
  NU: { threshold: 5, low: .04, high: .06, label: "4% first 5 years · 6% from year 6" },
  YT: { threshold: Infinity, low: .04, high: .04, label: "At least 4% of gross wages" },
};

const FINAL_PAY_HINTS: Record<string, string> = {
  AB: "Final earnings: within 10 days after the pay period ends or 31 days after the last day.",
  BC: "Final wages: generally within 48 hours after employer termination or 6 days after resignation.",
  ON: "Final wages: the later of 7 days after employment ends or the next regular payday.",
  SK: "Final wages: generally within 14 days after employment ends.",
};

const EMPLOYMENT_LINKS: Record<string, string> = {
  AB: "https://www.alberta.ca/employment-standards",
  BC: "https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards",
  MB: "https://www.gov.mb.ca/labour/standards/",
  NB: "https://www2.gnb.ca/content/gnb/en/corporate/promo/employment-standards.html",
  NL: "https://www.gov.nl.ca/ecc/labour/nonunion/",
  NS: "https://novascotia.ca/lae/employmentrights/",
  ON: "https://www.ontario.ca/document/your-guide-employment-standards-act-0",
  PE: "https://www.princeedwardisland.ca/en/topic/employment-standards",
  QC: "https://www.cnesst.gouv.qc.ca/en/working-conditions",
  SK: "https://www.saskatchewan.ca/business/employment-standards",
  NT: "https://www.ece.gov.nt.ca/en/services/employment-standards",
  NU: "https://nu-lsco.ca/",
  YT: "https://yukon.ca/en/employment/employment-standards",
};

const TOOL_PAGES: Record<ToolPage, { label: string; href: string; description: string }> = {
  salary: { label: "Salary rate", href: "/salary-rate", description: "Convert annual, hourly or pay-period compensation into taxable gross pay." },
  vacation: { label: "Vacation pay", href: "/vacation-pay", description: "Estimate Canadian vacation pay or UK statutory holiday pay and payout." },
  overtime: { label: "Overtime pay", href: "/overtime-pay", description: "Calculate eligible Canadian overtime or contractual UK overtime earnings." },
  final: { label: "Final pay", href: "/final-pay", description: "Build a final payment with regular wages, leave payout, notice and termination amounts." },
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

export default function PayrollCalculator({ tool = "salary" }: { tool?: ToolPage }) {
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
  const [payBasis, setPayBasis] = useState<PayBasis>("period");
  const [annualSalary, setAnnualSalary] = useState("78000");
  const [hourlyRate, setHourlyRate] = useState("35");
  const [weeklyHours, setWeeklyHours] = useState("40");
  const [regularHours, setRegularHours] = useState("80");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [ukOvertimeMultiplier, setUkOvertimeMultiplier] = useState("1");
  const [yearsService, setYearsService] = useState("1");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("manual");
  const [employmentStartDate, setEmploymentStartDate] = useState("");
  const [lastEmploymentDate, setLastEmploymentDate] = useState("");
  const [vacationMode, setVacationMode] = useState<VacationMode>(tool === "final" || tool === "vacation" ? "final" : "none");
  const [vacationAccrualMode, setVacationAccrualMode] = useState<VacationAccrualMode>("statutory");
  const [vacationEarnings, setVacationEarnings] = useState("0");
  const [vacationYearStartDate, setVacationYearStartDate] = useState("2026-01-01");
  const [accrualThroughDate, setAccrualThroughDate] = useState("2026-12-31");
  const [policyVacationUnits, setPolicyVacationUnits] = useState("80");
  const [manualAccruedHours, setManualAccruedHours] = useState("0");
  const [manualAccruedValue, setManualAccruedValue] = useState("0");
  const [vacationPaidMode, setVacationPaidMode] = useState<VacationPaidMode>("none");
  const [vacationPaid, setVacationPaid] = useState("0");
  const [vacationPaidHours, setVacationPaidHours] = useState("0");
  const [unusedHolidayDays, setUnusedHolidayDays] = useState("0");
  const [holidayDailyRate, setHolidayDailyRate] = useState("0");
  const [finalPay, setFinalPay] = useState(tool === "final");
  const [noticeInputMode, setNoticeInputMode] = useState<FinalPayInputMode>("weeks");
  const [noticeWeeks, setNoticeWeeks] = useState("0");
  const [severanceInputMode, setSeveranceInputMode] = useState<FinalPayInputMode>("value");
  const [terminationAmount, setTerminationAmount] = useState("0");

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

  const calculatedServiceYears = serviceYearsBetween(employmentStartDate, lastEmploymentDate);
  const effectiveYearsService = serviceMode === "dates" ? calculatedServiceYears : num(yearsService);

  const earnings = useMemo<EarningsBreakdown>(() => {
    const annual = num(annualSalary);
    const hoursPerWeek = Math.max(1, num(weeklyHours));
    const hoursThisPay = num(regularHours);
    const derivedHourly = payBasis === "annual"
      ? annual / (hoursPerWeek * 52)
      : payBasis === "hourly"
        ? num(hourlyRate)
        : num(gross) / Math.max(1, hoursThisPay);
    const regular = payBasis === "annual"
      ? annual / frequency
      : payBasis === "hourly"
        ? derivedHourly * hoursThisPay
        : num(gross);
    const overtimeMultiplier = country === "CA" ? 1.5 : Math.max(0, num(ukOvertimeMultiplier));
    const overtime = derivedHourly * num(overtimeHours) * overtimeMultiplier;
    const canadaVacationRule = VACATION_RULES[province];
    const canadaVacationRate = effectiveYearsService >= canadaVacationRule.threshold
      ? canadaVacationRule.high
      : canadaVacationRule.low;
    const vacationRate = country === "CA" ? canadaVacationRate : .1207;
    const dailyRate = num(holidayDailyRate) || derivedHourly * (hoursPerWeek / 5);
    const accrualFraction = vacationYearFraction(vacationYearStartDate, accrualThroughDate);
    let vacationBeforePaid = 0;
    if (vacationMode === "eachPay") vacationBeforePaid = (regular + overtime) * vacationRate;
    if (vacationMode === "final") {
      if (vacationAccrualMode === "policyHours") vacationBeforePaid = num(policyVacationUnits) * accrualFraction * derivedHourly;
      else if (vacationAccrualMode === "policyDays") vacationBeforePaid = num(policyVacationUnits) * accrualFraction * dailyRate;
      else if (vacationAccrualMode === "manualHours") vacationBeforePaid = num(manualAccruedHours) * derivedHourly;
      else if (vacationAccrualMode === "manualValue") vacationBeforePaid = num(manualAccruedValue);
      else {
        vacationBeforePaid = country === "CA"
          ? num(vacationEarnings) * vacationRate
          : num(unusedHolidayDays) * dailyRate;
      }
    }
    const vacationPaidDeduction = vacationPaidMode === "amount"
      ? num(vacationPaid)
      : vacationPaidMode === "hours"
        ? num(vacationPaidHours) * derivedHourly
        : 0;
    const vacation = Math.max(0, vacationBeforePaid - vacationPaidDeduction);
    const weeklyRate = payBasis === "annual"
      ? annual / 52
      : derivedHourly * hoursPerWeek;
    const monthlyRate = weeklyRate * 52 / 12;
    const finalPayValue = (mode: FinalPayInputMode, value: string) => mode === "weeks"
      ? weeklyRate * num(value)
      : mode === "months"
        ? monthlyRate * num(value)
        : num(value);
    const notice = finalPay ? finalPayValue(noticeInputMode, noticeWeeks) : 0;
    const termination = finalPay ? finalPayValue(severanceInputMode, terminationAmount) : 0;
    const terminationTaxFree = country === "UK" ? Math.min(30_000, termination) : 0;
    const terminationTaxable = country === "UK" ? Math.max(0, termination - 30_000) : termination;
    const taxableGross = round(regular + overtime + vacation + notice + terminationTaxable);
    return {
      regular: round(regular),
      overtime: round(overtime),
      vacation: round(vacation),
      notice: round(notice),
      terminationTaxable: round(terminationTaxable),
      terminationTaxFree: round(terminationTaxFree),
      taxableGross,
      totalGross: round(taxableGross + terminationTaxFree),
      hourlyRate: round(derivedHourly),
      weeklyRate: round(weeklyRate),
      vacationRate,
      vacationBeforePaid: round(vacationBeforePaid),
      vacationPaidDeduction: round(Math.min(vacationBeforePaid, vacationPaidDeduction)),
    };
  }, [annualSalary, weeklyHours, regularHours, payBasis, hourlyRate, gross, frequency, country, ukOvertimeMultiplier, overtimeHours, province, effectiveYearsService, vacationMode, vacationAccrualMode, vacationEarnings, vacationYearStartDate, accrualThroughDate, policyVacationUnits, manualAccruedHours, manualAccruedValue, vacationPaidMode, vacationPaid, vacationPaidHours, unusedHolidayDays, holidayDailyRate, finalPay, noticeInputMode, noticeWeeks, severanceInputMode, terminationAmount]);

  const payrollGross = calculationMode === "grossToNet" ? earnings.taxableGross : num(gross);
  const showOvertime = tool === "overtime";
  const showVacation = tool === "vacation" || tool === "final";
  const showFinal = tool === "final";

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
      primary: calculate(province, provincialClaim, payrollGross),
      comparison: calculate(comparisonProvince, comparisonClaim, payrollGross),
    };
  }, [calculationMode, province, comparisonProvince, frequency, payrollGross, targetNet, benefits, rrsp, otherDeductions, federalClaim, provincialClaim, comparisonClaim, additionalTax, multipleEmployers, cppExempt, eiExempt]);

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
    const addTaxFreeFinalPay = (result: UKPayrollResult) => {
      if (!earnings.terminationTaxFree) return result;
      const grossPay = round(result.grossPay + earnings.terminationTaxFree);
      return {
        ...result,
        grossPay,
        net: round(result.net + earnings.terminationTaxFree),
        employerCost: round(result.employerCost + earnings.terminationTaxFree),
        effectiveRate: grossPay ? result.totalDeductions / grossPay : 0,
      };
    };
    return {
      primary: addTaxFreeFinalPay(calculate(ukRegion, payrollGross)),
      comparison: addTaxFreeFinalPay(calculate(ukComparisonRegion, payrollGross)),
    };
  }, [calculationMode, ukRegion, ukComparisonRegion, frequency, payrollGross, targetNet, benefits, salarySacrifice, otherDeductions, ukTaxBasis, niCategory, studentLoanPlan, postgraduateLoan, earnings.terminationTaxFree]);

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
    setPayBasis("period"); setAnnualSalary("78000"); setHourlyRate("35"); setWeeklyHours("40"); setRegularHours("80");
    setOvertimeHours("0"); setUkOvertimeMultiplier("1"); setYearsService("1"); setServiceMode("manual");
    setEmploymentStartDate(""); setLastEmploymentDate("");
    setVacationMode(tool === "final" || tool === "vacation" ? "final" : "none");
    setVacationAccrualMode("statutory"); setVacationEarnings("0"); setVacationYearStartDate("2026-01-01");
    setAccrualThroughDate("2026-12-31"); setPolicyVacationUnits("80"); setManualAccruedHours("0"); setManualAccruedValue("0");
    setVacationPaidMode("none"); setVacationPaid("0"); setVacationPaidHours("0");
    setUnusedHolidayDays("0"); setHolidayDailyRate("0"); setFinalPay(tool === "final");
    setNoticeInputMode("weeks"); setNoticeWeeks("0"); setSeveranceInputMode("value"); setTerminationAmount("0");
  };

  return (
    <main>
      <header className="topbar">
        <div className="rule-chip"><span /> Canada 2026 · UK 2026–27</div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>●</span> {TOOL_PAGES[tool].label} · Canada &amp; UK</div>
        <p>{TOOL_PAGES[tool].description} Then compare the estimated take-home result across local tax regions.</p>
      </section>

      <nav className="tool-nav" aria-label="Payroll calculators">
        {(Object.entries(TOOL_PAGES) as [ToolPage, (typeof TOOL_PAGES)[ToolPage]][]).map(([key, item]) => (
          <a key={key} href={item.href} className={tool === key ? "active" : ""} aria-current={tool === key ? "page" : undefined}>
            <span>{item.label}</span>
            <small>{key === "salary" ? "Annual · hourly" : key === "vacation" ? "Leave · payout" : key === "overtime" ? "Hours · premium" : "Notice · termination"}</small>
          </a>
        ))}
      </nav>

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

          {calculationMode === "grossToNet" && (
            <section className="earnings-builder" aria-label="Earnings and final pay">
              <div className="section-heading compact">
                <span>02</span>
                <span><b>{TOOL_PAGES[tool].label}</b><small>{TOOL_PAGES[tool].description}</small></span>
              </div>
              <div className="field-grid">
                <label>
                  Regular pay basis
                  <select value={payBasis} onChange={(e) => setPayBasis(e.target.value as PayBasis)}>
                    <option value="period">Pay-period amount</option>
                    <option value="annual">Annual salary</option>
                    <option value="hourly">Hourly rate</option>
                  </select>
                </label>
                {payBasis === "annual" && <MoneyField symbol={country === "CA" ? "$" : "£"} label="Annual salary" value={annualSalary} onChange={setAnnualSalary} />}
                {payBasis === "hourly" && <MoneyField symbol={country === "CA" ? "$" : "£"} label="Hourly rate" value={hourlyRate} onChange={setHourlyRate} />}
                {payBasis === "period" && <MoneyField symbol={country === "CA" ? "$" : "£"} label="Regular pay this period" value={gross} onChange={setGross} />}
                <MoneyField symbol="" label="Contracted hours per week" value={weeklyHours} onChange={setWeeklyHours} />
                {payBasis !== "annual" && <MoneyField symbol="" label="Regular hours this pay" value={regularHours} onChange={setRegularHours} />}
                {showOvertime && <MoneyField symbol="" label="Eligible overtime hours" value={overtimeHours} onChange={setOvertimeHours} hint={country === "CA" ? "Enter only hours that qualify under local rules; most eligible overtime is paid at 1.5×." : "UK overtime rates come from the contract; there is no general statutory premium."} />}
                {showOvertime && country === "UK" && (
                  <label>
                    Contract overtime multiplier
                    <select value={ukOvertimeMultiplier} onChange={(e) => setUkOvertimeMultiplier(e.target.value)}>
                      <option value="1">1.0× · straight time</option>
                      <option value="1.25">1.25×</option>
                      <option value="1.5">1.5×</option>
                      <option value="2">2.0×</option>
                    </select>
                  </label>
                )}
                {showVacation && (
                  <label>
                    Years of service
                    <select value={serviceMode} onChange={(e) => setServiceMode(e.target.value as ServiceMode)}>
                      <option value="manual">Enter completed years manually</option>
                      <option value="dates">Calculate from start and last dates</option>
                    </select>
                  </label>
                )}
                {showVacation && serviceMode === "manual" && (
                  <MoneyField symbol="" label="Completed years of service" value={yearsService} onChange={setYearsService} />
                )}
                {showVacation && serviceMode === "dates" && (
                  <>
                    <DateField label="Employment start date" value={employmentStartDate} onChange={setEmploymentStartDate} />
                    <DateField label="Last date of employment" value={lastEmploymentDate} onChange={setLastEmploymentDate} />
                    <div className="calculated-value" role="status">
                      <span>Calculated service</span>
                      <b>{calculatedServiceYears.toFixed(2)} years</b>
                      <small>Vacation thresholds use completed service as of the last date.</small>
                    </div>
                  </>
                )}
                {showVacation && (
                  <label>
                    {country === "CA" ? "Vacation pay treatment" : "Holiday pay treatment"}
                    <select value={vacationMode} onChange={(e) => setVacationMode(e.target.value as VacationMode)}>
                      <option value="none">No additional payout this pay</option>
                      <option value="eachPay">{country === "CA" ? "Pay statutory vacation percentage now" : "Rolled-up pay · eligible irregular/part-year only"}</option>
                      <option value="final">{country === "CA" ? "Final accrued vacation payout" : "Pay unused holiday on leaving"}</option>
                    </select>
                    <small className="hint">{country === "CA" ? VACATION_RULES[province].label : "Regular workers receive 5.6 weeks; 12.07% rolled-up pay is limited to eligible irregular/part-year workers."}</small>
                  </label>
                )}
                {showVacation && vacationMode === "final" && (
                  <label>
                    Accrued {country === "CA" ? "vacation" : "holiday"} calculation
                    <select value={vacationAccrualMode} onChange={(e) => setVacationAccrualMode(e.target.value as VacationAccrualMode)}>
                      <option value="statutory">{country === "CA" ? "Statutory percentage of eligible wages" : "Unused days × normal daily pay"}</option>
                      <option value="policyHours">Policy hours per vacation year</option>
                      <option value="policyDays">Policy days per vacation year</option>
                      <option value="manualHours">Enter accrued hours manually</option>
                      <option value="manualValue">Enter accrued value manually</option>
                    </select>
                  </label>
                )}
                {showVacation && vacationMode === "final" && vacationAccrualMode === "statutory" && country === "CA" && (
                  <MoneyField label="Vacation-eligible wages earned" value={vacationEarnings} onChange={setVacationEarnings} />
                )}
                {showVacation && vacationMode === "final" && vacationAccrualMode === "statutory" && country === "UK" && (
                  <>
                    <MoneyField symbol="" label="Unused holiday days" value={unusedHolidayDays} onChange={setUnusedHolidayDays} hint="Payment in lieu is required for untaken statutory leave when employment ends." />
                    <MoneyField symbol="£" label="Average normal daily pay" value={holidayDailyRate} onChange={setHolidayDailyRate} hint="Enter normal pay including regularly paid overtime, commission or other required elements; leave 0 to use the derived basic day rate." />
                  </>
                )}
                {showVacation && vacationMode === "final" && (vacationAccrualMode === "policyHours" || vacationAccrualMode === "policyDays") && (
                  <>
                    <MoneyField
                      symbol=""
                      label={`Policy ${vacationAccrualMode === "policyHours" ? "hours" : "days"} per vacation year`}
                      value={policyVacationUnits}
                      onChange={setPolicyVacationUnits}
                    />
                    <DateField label="Vacation year start date" value={vacationYearStartDate} onChange={setVacationYearStartDate} />
                    <DateField label="Accrual through date" value={accrualThroughDate} onChange={setAccrualThroughDate} />
                    <div className="calculated-value" role="status">
                      <span>Vacation year accrued</span>
                      <b>{(vacationYearFraction(vacationYearStartDate, accrualThroughDate) * 100).toFixed(1)}%</b>
                      <small>Policy entitlement is prorated through the selected date and capped at one vacation year.</small>
                    </div>
                  </>
                )}
                {showVacation && vacationMode === "final" && vacationAccrualMode === "manualHours" && (
                  <MoneyField
                    symbol=""
                    label={`Accrued ${country === "CA" ? "vacation" : "holiday"} hours`}
                    value={manualAccruedHours}
                    onChange={setManualAccruedHours}
                    hint={`Converted using the derived hourly rate of ${(country === "CA" ? money : pounds).format(earnings.hourlyRate)}.`}
                  />
                )}
                {showVacation && vacationMode === "final" && vacationAccrualMode === "manualValue" && (
                  <MoneyField
                    symbol={country === "CA" ? "$" : "£"}
                    label={`Accrued ${country === "CA" ? "vacation" : "holiday"} value`}
                    value={manualAccruedValue}
                    onChange={setManualAccruedValue}
                  />
                )}
                {showVacation && vacationMode !== "none" && (
                  <label>
                    {country === "CA" ? "Subtract vacation pay already paid" : "Subtract holiday pay already paid"}
                    <select value={vacationPaidMode} onChange={(e) => setVacationPaidMode(e.target.value as VacationPaidMode)}>
                      <option value="none">Do not subtract anything</option>
                      <option value="amount">{country === "CA" ? "Enter dollar value already paid" : "Enter pound value already paid"}</option>
                      <option value="hours">Enter paid vacation / holiday hours</option>
                    </select>
                    <small className="hint">The deduction is capped at the calculated vacation or holiday amount, so the remaining payout cannot be negative.</small>
                  </label>
                )}
                {showVacation && vacationMode !== "none" && vacationPaidMode === "amount" && (
                  <MoneyField
                    symbol={country === "CA" ? "$" : "£"}
                    label={country === "CA" ? "Vacation value already paid" : "Holiday value already paid"}
                    value={vacationPaid}
                    onChange={setVacationPaid}
                  />
                )}
                {showVacation && vacationMode !== "none" && vacationPaidMode === "hours" && (
                  <MoneyField
                    symbol=""
                    label={country === "CA" ? "Vacation hours already paid" : "Holiday hours already paid"}
                    value={vacationPaidHours}
                    onChange={setVacationPaidHours}
                    hint={`Converted using the derived hourly rate of ${(country === "CA" ? money : pounds).format(earnings.hourlyRate)}.`}
                  />
                )}
              </div>

              {showFinal && (
                <div className="field-grid final-fields">
                  <label>
                    Notice pay input
                    <select value={noticeInputMode} onChange={(e) => setNoticeInputMode(e.target.value as FinalPayInputMode)}>
                      <option value="weeks">Weeks of notice</option>
                      <option value="months">Months of notice</option>
                      <option value="value">Enter notice value</option>
                    </select>
                  </label>
                  <MoneyField
                    symbol={noticeInputMode === "value" ? (country === "CA" ? "$" : "£") : ""}
                    label={noticeInputMode === "weeks" ? "Notice · weeks" : noticeInputMode === "months" ? "Notice · months" : "Notice pay value"}
                    value={noticeWeeks}
                    onChange={setNoticeWeeks}
                    hint={country === "UK" ? "UK statutory notice is generally 1 week after one month, then 1 week per completed year from 2 to 12 years." : "Enter the applicable statutory, contractual or common-law notice entitlement."}
                  />
                  <label>
                    {country === "CA" ? "Severance input" : "Redundancy / termination input"}
                    <select value={severanceInputMode} onChange={(e) => setSeveranceInputMode(e.target.value as FinalPayInputMode)}>
                      <option value="weeks">Weeks of pay</option>
                      <option value="months">Months of pay</option>
                      <option value="value">Enter direct value</option>
                    </select>
                  </label>
                  <MoneyField
                    symbol={severanceInputMode === "value" ? (country === "CA" ? "$" : "£") : ""}
                    label={severanceInputMode === "weeks"
                      ? (country === "CA" ? "Severance · weeks" : "Redundancy / termination · weeks")
                      : severanceInputMode === "months"
                        ? (country === "CA" ? "Severance · months" : "Redundancy / termination · months")
                        : (country === "CA" ? "Severance value" : "Redundancy / termination value")}
                    value={terminationAmount}
                    onChange={setTerminationAmount}
                    hint={country === "UK" ? "The calculator treats up to £30,000 of this estimate as tax-free; PAYE treatment can vary by payment type." : "Included as taxable employment income for this estimate."}
                  />
                </div>
              )}

              <div className="earnings-summary">
                <div><span>Regular</span><b>{(country === "CA" ? money : pounds).format(earnings.regular)}</b></div>
                {showOvertime && <div><span>Overtime</span><b>{(country === "CA" ? money : pounds).format(earnings.overtime)}</b></div>}
                {showVacation && <div><span>{country === "CA" ? "Vacation" : "Holiday"}</span><b>{(country === "CA" ? money : pounds).format(earnings.vacationBeforePaid)}</b></div>}
                {showVacation && earnings.vacationPaidDeduction > 0 && <div><span>Already paid</span><b>−{(country === "CA" ? money : pounds).format(earnings.vacationPaidDeduction)}</b></div>}
                {showFinal && <div><span>Notice pay</span><b>{(country === "CA" ? money : pounds).format(earnings.notice)}</b></div>}
                {showFinal && <div><span>{country === "CA" ? "Severance" : "Redundancy / termination"}</span><b>{(country === "CA" ? money : pounds).format(earnings.terminationTaxable + earnings.terminationTaxFree)}</b></div>}
                <div className="earnings-total"><span>Total gross</span><b>{(country === "CA" ? money : pounds).format(earnings.totalGross)}</b></div>
              </div>
              <p className="legal-hint">
                {tool === "final"
                  ? (country === "CA"
                      ? (FINAL_PAY_HINTS[province] ?? `Final-pay timing and notice entitlements vary in ${PROVINCES[province].name}; confirm the applicable employment standards and any better contractual right.`)
                      : "UK final pay must include untaken statutory holiday. Redundancy, notice and post-P45 payments can have different PAYE treatment.")
                  : tool === "vacation"
                    ? (country === "CA"
                        ? `The selected province uses ${VACATION_RULES[province].label.toLowerCase()}; eligibility and the wage base can vary.`
                        : "Most workers receive 5.6 weeks of statutory leave. Rolled-up holiday pay at 12.07% is limited to eligible irregular-hours and part-year workers.")
                    : tool === "overtime"
                      ? (country === "CA"
                          ? "The 1.5× estimate applies only to eligible hours; thresholds, averaging agreements and exemptions vary by province and occupation."
                          : "UK law does not set a general overtime premium. Use the contractual multiplier and confirm total pay still meets minimum-wage rules.")
                      : "Rate conversions are planning estimates. Confirm contracted hours, pay frequency and any employer-specific proration before payroll is finalized."}
              </p>
            </section>
          )}

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
                {isGrossUp && <MoneyField label="Target take-home pay" value={targetNet} onChange={setTargetNet} hint="The cash amount the employee should receive." />}
                <MoneyField label="Taxable benefits" value={benefits} onChange={setBenefits} hint="Benefits add to taxable income, not cash pay." />
                <MoneyField label="RRSP / RPP deduction" value={rrsp} onChange={setRrsp} hint="Deducted before income tax." />
                <MoneyField label="Other after-tax deductions" value={otherDeductions} onChange={setOtherDeductions} />
              </div>

              <button className="accordion" type="button" onClick={() => setTdOpen(!tdOpen)} aria-expanded={tdOpen}>
                <span className="section-heading compact">
                  <span>03</span>
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
                {isGrossUp && <MoneyField symbol="£" label="Target take-home pay" value={targetNet} onChange={setTargetNet} hint="The cash amount the employee should receive." />}
                <MoneyField symbol="£" label="Payrolled taxable benefits" value={benefits} onChange={setBenefits} hint="Included in taxable and NI-able pay for this estimate." />
                <MoneyField symbol="£" label="Pension salary sacrifice" value={salarySacrifice} onChange={setSalarySacrifice} hint="Reduces cash pay, PAYE pay and NI pay." />
                <MoneyField symbol="£" label="Other after-tax deductions" value={otherDeductions} onChange={setOtherDeductions} />
              </div>

              <div className="uk-settings">
                <div className="section-heading compact">
                  <span>03</span>
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

              {!isGrossUp && <EarningsCard earnings={earnings} format={money} vacationLabel="Vacation pay" tool={tool} />}

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
                <div><span>{isGrossUp ? "Required annual cash gross" : finalPay ? "Final gross payment" : "Annualized gross"}</span><b>{finalPay ? money.format(results.grossPay) : compactMoney.format(results.grossPay * frequency)}</b></div>
                <div><span>Estimated employer cost</span><b>{money.format(results.employerCost)}</b></div>
              </div>

              <p className="result-note">{finalPay
                ? "Final-pay estimate only. Vacation bases, notice, severance eligibility, retiring allowances, lump-sum withholding, exemptions and common-law or contractual rights can change the amount and tax treatment."
                : "Planning estimate for regular employment income. Bonuses, year-to-date maximums, special credits, and payroll-specific situations can change the result."}</p>
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

              {!isGrossUp && <EarningsCard earnings={earnings} format={pounds} vacationLabel="Holiday pay" tool={tool} />}

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
                <div><span>{isGrossUp ? "Required annual cash gross" : finalPay ? "Final gross payment" : "Annualized gross"}</span><b>{finalPay ? pounds.format(ukResults.grossPay) : compactPounds.format(ukResults.grossPay * frequency)}</b></div>
                <div><span>Employer NI / cost per pay</span><b>{pounds.format(ukResults.employerNI)} / {pounds.format(ukResults.employerCost)}</b></div>
              </div>

              <p className="result-note">{finalPay
                ? "Final-pay estimate only. Notice, redundancy eligibility, post-employment notice pay, the £30,000 exemption, post-P45 code 0T treatment and the composition of termination awards can change PAYE and NI."
                : "Regular-pay estimate using the selected tax basis. Exact PAYE may differ for cumulative codes, emergency codes, year-to-date pay, directors, irregular periods, benefits not processed through payroll, or HMRC notices."}</p>
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
              <a href={EMPLOYMENT_LINKS[province]} target="_blank" rel="noreferrer">{PROVINCES[province].name} standards ↗</a>
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
              <a href="https://www.gov.uk/holiday-entitlement-rights" target="_blank" rel="noreferrer">Holiday pay ↗</a>
              <a href="https://www.gov.uk/overtime-your-rights" target="_blank" rel="noreferrer">Overtime ↗</a>
              <a href="https://www.gov.uk/employee-leaving" target="_blank" rel="noreferrer">Final pay ↗</a>
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

function DateField({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return (
    <label>
      {label}
      <input className="date-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
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

function EarningsCard({ earnings, format, vacationLabel, tool }: {
  earnings: EarningsBreakdown;
  format: Intl.NumberFormat;
  vacationLabel: string;
  tool: ToolPage;
}) {
  return (
    <div className="earnings-card">
      <div className="earnings-card-head"><span>Gross earnings</span><b>{format.format(earnings.totalGross)}</b></div>
      <div><span>Regular pay</span><b>{format.format(earnings.regular)}</b></div>
      {tool === "overtime" && <div><span>Overtime pay</span><b>{format.format(earnings.overtime)}</b></div>}
      {(tool === "vacation" || tool === "final") && <div><span>{vacationLabel}</span><b>{format.format(earnings.vacationBeforePaid)}</b></div>}
      {(tool === "vacation" || tool === "final") && earnings.vacationPaidDeduction > 0 && (
        <div><span>Already paid</span><b>−{format.format(earnings.vacationPaidDeduction)}</b></div>
      )}
      {tool === "final" && <div><span>Notice pay</span><b>{format.format(earnings.notice)}</b></div>}
      {tool === "final" && <div><span>Severance / termination</span><b>{format.format(earnings.terminationTaxable + earnings.terminationTaxFree)}</b></div>}
      <small>Derived hourly rate: {format.format(earnings.hourlyRate)}</small>
    </div>
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
