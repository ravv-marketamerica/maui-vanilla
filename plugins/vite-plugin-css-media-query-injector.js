import { promises as fs } from "fs";
import { resolve } from "path";

function viteCssMediaQueryInjector() {
  return {
    name: "vite-css-injector",
    apply: "build",
    enforce: "post",

    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        try {
          const distPath = process.cwd();
          const markerPath = resolve(distPath, "dist/.css-optimized");

          // Wait for the optimization marker file
          let attempts = 0;
          const maxAttempts = 10;
          const delay = 100; // 100ms between checks

          while (attempts < maxAttempts) {
            if (
              await fs
                .access(markerPath)
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
              "[viteCssMediaQueryInjector] CSS optimization marker file not found. Ensure the optimizer plugin runs first."
            );
          }

          console.log(
            "[viteCssMediaQueryInjector] Injecting optimized CSS into HTML..."
          );
          const cssPath = resolve(distPath, "dist/media-queries.css");
          const htmlPath = resolve(distPath, "dist/index.html");

          // Read the CSS and HTML files
          const [cssContent, htmlContent] = await Promise.all([
            fs.readFile(cssPath, "utf-8"),
            fs.readFile(htmlPath, "utf-8"),
          ]);

          // Find the existing style tag and append the new CSS content
          const updatedHtmlContent = htmlContent.replace(
            /(<style[^>]*>)([\s\S]*?)(<\/style>)/,
            (match, openTag, existingStyles, closeTag) => {
              return `${openTag}${existingStyles}\n${cssContent}${closeTag}`;
            }
          );

          // Write the updated HTML
          await fs.writeFile(htmlPath, updatedHtmlContent);

          // Delete the original CSS file and marker file
          await Promise.all([fs.unlink(cssPath), fs.unlink(markerPath)]);

          console.log(
            "[viteCssMediaQueryInjector] ✓ Optimized CSS appended to existing styles and cleaned up successfully"
          );
        } catch (error) {
          console.error(
            "[viteCssMediaQueryInjector] Error processing CSS:",
            error
          );
          throw error;
        }
      },
    },
  };
}

export default viteCssMediaQueryInjector;
