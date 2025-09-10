// plugins/vite-plugin-locale-watcher.js
import { promises as fs } from "fs";
import path from "path";
import { loadLocaleData } from "../scripts/locale-loader.js";

export default function localeWatcher() {
  let server;
  let reloadTimeout;

  return {
    name: "locale-watcher",
    configureServer(_server) {
      server = _server;
    },
    buildStart() {
      // Add locale files as watch dependencies
      const localeFiles = [
        path.resolve(process.cwd(), "src/locales/en.default.json"),
        // Add other specific locale files you have
      ];

      localeFiles.forEach((file) => {
        this.addWatchFile(file);
      });
    },
    async handleHotUpdate({ file, server }) {
      if (file.includes("src/locales/") && file.endsWith(".json")) {
        console.log(
          "[locale-watcher] Locale file changed:",
          path.basename(file)
        );

        // Debounce the reload to prevent infinite loops
        if (reloadTimeout) {
          clearTimeout(reloadTimeout);
        }

        reloadTimeout = setTimeout(() => {
          console.log("[locale-watcher] Restarting dev server...");
          server.restart();
        }, 100);

        // Return empty array to prevent default HMR
        return [];
      }
    },
  };
}
