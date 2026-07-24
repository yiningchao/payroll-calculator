import type { Metadata } from "next";
import PayrollCalculator from "../PayrollCalculator";

export const metadata: Metadata = {
  title: "Overtime Pay Calculator | Canada & UK Payroll",
  description: "Calculate eligible Canadian overtime or contractual UK overtime and estimated net pay.",
};

export default function OvertimePayPage() {
  return <PayrollCalculator tool="overtime" />;
}
