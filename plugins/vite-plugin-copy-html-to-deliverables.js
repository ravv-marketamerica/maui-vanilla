import fs from "fs";
import path from "path";

/**
 * Vite plugin to copy HTML files from dist to _deliverables folder
 */

export default function viteCopyHtmlToDeliverables() {
  return {
    name: "copy-html-to-deliverables",
    apply: "build",
    enforce: "post",

    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        console.log("[copy-html-to-deliverbales] Running...");
        const distPath = path.resolve("dist");
        const deliverablePath = path.resolve("_deliverables");

        // Create _deliverables directory if it doesn't exist
        if (!fs.existsSync(deliverablePath)) {
          fs.mkdirSync(deliverablePath, { recursive: true });
        }

        // Read all files from dist directory
        const files = fs.readdirSync(distPath);

        // Filter and copy HTML files
        for (const file of files) {
          if (file.endsWith(".html")) {
            const sourcePath = path.join(distPath, file);
            const targetPath = path.join(deliverablePath, file);

            try {
              // Copy file, overwriting if it exists
              await fs.promises.copyFile(sourcePath, targetPath);
              console.log(
                `[copy-html-to-deliverbales] Successfully copied ${file} to _deliverables folder`
              );
            } catch (error) {
              console.error(`Error copying ${file}:`, error);
            }
          }
        }
      },
    },
  };
}
