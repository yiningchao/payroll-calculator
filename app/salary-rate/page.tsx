import type { Metadata } from "next";
import PayrollCalculator from "../PayrollCalculator";

export const metadata: Metadata = {
  title: "Salary Rate Calculator | Canada & UK Payroll",
  description: "Convert annual, hourly and pay-period compensation into gross and estimated net pay.",
};

export default function SalaryRatePage() {
  return <PayrollCalculator tool="salary" />;
}
