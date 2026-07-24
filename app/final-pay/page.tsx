import type { Metadata } from "next";
import PayrollCalculator from "../PayrollCalculator";

export const metadata: Metadata = {
  title: "Final Pay Calculator | Canada & UK Payroll",
  description: "Estimate final wages, leave payout, notice and termination amounts in Canada or the UK.",
};

export default function FinalPayPage() {
  return <PayrollCalculator tool="final" />;
}
