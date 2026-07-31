import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PayrollCalculator from "../app/PayrollCalculator";
import "../app/globals.css";

type ToolPage = "salary" | "vacation" | "overtime" | "final";

const routeTools: Record<string, ToolPage> = {
  "salary-rate": "salary",
  "vacation-pay": "vacation",
  "overtime-pay": "overtime",
  "final-pay": "final",
};

const route = window.location.pathname.split("/").filter(Boolean).at(-1) ?? "";
const tool = routeTools[route] ?? "salary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PayrollCalculator tool={tool} basePath="/payroll-calculator" />
  </StrictMode>,
);
