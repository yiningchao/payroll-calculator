import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const outputDirectory = fileURLToPath(new URL("../github-pages-dist/", import.meta.url));
const routes = ["salary-rate", "vacation-pay", "overtime-pay", "final-pay"];

for (const route of routes) {
  const routeDirectory = join(outputDirectory, route);
  mkdirSync(routeDirectory, { recursive: true });
  copyFileSync(join(outputDirectory, "index.html"), join(routeDirectory, "index.html"));
}

writeFileSync(join(outputDirectory, ".nojekyll"), "");
