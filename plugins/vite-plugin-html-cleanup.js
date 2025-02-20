import fs from "fs/promises";
import path from "path";

/**
 * Creates a Vite plugin that removes specified HTML tags from the output file
 * after the build process is complete.
 */
export default function viteHtmlCleanupPlugin() {
  return {
    name: "vite-plugin-html-cleanup",
    apply: "build",
    enforce: "post",

    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        try {
          console.log("[html-cleanup] Running...");

          // Wait a short time to ensure file operations are complete
          //  await new Promise((resolve) => setTimeout(resolve, 2000));

          // Get the dist directory
          const distDir = path.resolve("dist");

          // Find the HTML file in dist
          const files = await fs.readdir(distDir);
          const htmlFile = files.find((file) => file.endsWith(".html"));

          if (!htmlFile) {
            console.warn("[html-cleanup] No HTML file found in dist directory");
            return;
          }

          const filePath = path.join(distDir, htmlFile);

          // Read the file content
          let content = await fs.readFile(filePath, "utf-8");

          // Remove html, body, and meta tags
          content = content
            // Rmove doc tags
            .replace(/<!DOCTYPE[^>]*>/gi, "")
            // Remove head tags
            // Remove html tags
            .replace(/<head[^>]*>/gi, "")
            .replace(/<\/head>/gi, "")
            // Remove html tags
            .replace(/<html[^>]*>/gi, "")
            .replace(/<\/html>/gi, "")
            // Remove body tags
            .replace(/<body[^>]*>/i, "")
            .replace(/<\/body>/i, "")
            // Remove meta tags
            .replace(/<meta[^>]*>/gi, "")
            // Remove empty lines (lines with only whitespace)
            .replace(/^\s*[\r\n]/gm, "")
            // Remove multiple consecutive empty lines
            .replace(/[\r\n]{3,}/g, "\n\n")
            // Remove whitespace at the end of lines
            .replace(/[ \t]+$/gm, "")
            // Remove extra spaces between tags
            .replace(/>\s{2,}</g, ">\n<")
            // Ensure single newline after closing tags
            .replace(/>\n\s+/g, ">\n")
            // Trim whitespace at start and end of file
            .trim();

          // Write the cleaned content back to the file
          await fs.writeFile(filePath, content, "utf-8");

          console.log("[html-cleanup] HTML cleanup complete:", htmlFile);
        } catch (error) {
          console.error("[html-cleanup] Error in HTML cleanup plugin:", error);
        }
      },
    },
  };
}
