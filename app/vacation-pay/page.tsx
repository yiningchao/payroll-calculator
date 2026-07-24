import type { Metadata } from "next";
import PayrollCalculator from "../PayrollCalculator";

export const metadata: Metadata = {
  title: "Vacation Pay Calculator | Canada & UK Payroll",
  description: "Estimate Canadian vacation pay and UK statutory holiday pay or payout.",
};

export default function VacationPayPage() {
  return <PayrollCalculator tool="vacation" />;
}
