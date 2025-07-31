//Passes in mode from package.json script to vite serve
import { execSync } from "child_process";

const mode = process.argv[2] || "production";
execSync(`vite serve --mode ${mode}`, { stdio: "inherit" });
