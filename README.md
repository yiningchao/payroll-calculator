# Payroll Calculator

An interactive Canada and UK payroll calculator with separate tools for:

- salary and hourly-rate conversion
- vacation and holiday pay
- overtime pay
- final pay, notice, severance, and termination amounts
- gross-to-net and net-to-gross calculations
- Canadian province and UK tax-region comparisons

## Live calculator

[Open the interactive payroll calculator](https://yiningchao.github.io/payroll-calculator/)

## Development

Requires Node.js 22.13 or later and pnpm.

```bash
pnpm install
pnpm run dev
```

Validation commands:

```bash
pnpm run build
pnpm run build:pages
pnpm run lint
pnpm test
```

The application is a planning estimator. Payroll laws, tax notices, year-to-date values, exemptions, employment contracts, and employee circumstances can change final results.
