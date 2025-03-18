import { promises as fs } from "fs";
import path from "path";

function viteHtmlRenamer(options = {}) {
  const defaultOptions = {
    distDir: "dist",
    newName: "app.html", // default new name
  };

  const config = { ...defaultOptions, ...options };

  return {
    name: "vite-html-renamer",
    apply: "build",
    enforce: "post",

    configResolved(resolvedConfig) {
      config.distDir = resolvedConfig.build.outDir || config.distDir;
    },

    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        try {
          console.log("[html-renamer] Waiting for previous to complete...");

          const distPath = process.cwd();
          const htmlPath = path.join(distPath, config.distDir, "index.html");
          const newPath = path.join(distPath, config.distDir, config.newName);

          // Wait for index.html to exist
          let attempts = 0;
          const maxAttempts = 20; // Increased attempts for longer builds
          const delay = 100; // 100ms between checks

          // First check if index.html exists
          while (attempts < maxAttempts) {
            if (
              await fs
                .access(htmlPath)
                .then(() => true)
                .catch(() => false)
            ) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
            attempts++;
          }

          if (attempts === maxAttempts) {
            throw new Error(
              "[html-renamer] index.html not found after waiting"
            );
          }

          // Wait for CSS injection to complete by checking if media-queries.css is gone
          // (since the injector deletes it after injection)
          const cssPath = path.join(
            distPath,
            config.distDir,
            "media-queries.css"
          );
          attempts = 0;

          while (attempts < maxAttempts) {
            if (
              !(await fs
                .access(cssPath)
                .then(() => true)
                .catch(() => false))
            ) {
              // CSS file is gone, which means injection is complete
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
            attempts++;
          }

          if (attempts === maxAttempts) {
            throw new Error("[html-renamer] CSS injection did not complete");
          }

          // Rename the file
          await fs.rename(htmlPath, newPath);

          console.log(
            `[html-renamer] Successfully renamed index.html to ${config.newName}`
          );
        } catch (error) {
          console.error("[html-renamer] Error:", error);
          throw error;
        }
      },
    },
  };
}

export default viteHtmlRenamer;
