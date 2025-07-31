import { promises as fs } from "fs";
import path from "path";
import prettier from "prettier";

function viteHtmlPrettier(options = {}) {
  const defaultOptions = {
    distDir: "dist",
    htmlFile: "index.html", // file to format
    prettierOptions: {
      parser: "html",
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      singleQuote: false,
      htmlWhitespaceSensitivity: "css",
      bracketSameLine: true,
    },
  };

  const config = { ...defaultOptions, ...options };

  return {
    name: "vite-html-prettier",
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
          console.log("[html-prettier] Waiting for build to complete...");

          const distPath = process.cwd();
          const htmlPath = path.join(distPath, config.distDir, config.htmlFile);

          // Wait for HTML file to exist
          let attempts = 0;
          const maxAttempts = 20; // Increased attempts for longer builds
          const delay = 100; // 100ms between checks

          // Check if HTML file exists
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
              `[html-prettier] ${config.htmlFile} not found after waiting`
            );
          }

          // Read the HTML file
          const htmlContent = await fs.readFile(htmlPath, "utf-8");

          // Format with Prettier - ensure parser is explicitly set
          const formattedHtml = await prettier.format(htmlContent, {
            ...config.prettierOptions,
            parser: "html", // Explicitly set the parser regardless of user config
          });

          // Write the formatted content back to the file
          await fs.writeFile(htmlPath, formattedHtml);

          console.log(
            `[html-prettier] Successfully formatted ${config.htmlFile}`
          );
        } catch (error) {
          console.error("[html-prettier] Error:", error);
          throw error;
        }
      },
    },
  };
}

export default viteHtmlPrettier;
