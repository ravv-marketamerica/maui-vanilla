//Passes in mode from package.json script to vite build
import { execSync } from "child_process";

const mode = process.argv[2] || "production";
execSync(`vite build --mode ${mode}`, { stdio: "inherit" });
