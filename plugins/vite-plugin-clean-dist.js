import fs from "fs";
import path from "path";

/**
 * Vite plugin to clean up the dist folder before build
 */

export default function viteCleanDist() {
  return {
    name: "clean-dist-folder",
    apply: "build",
    enforce: "post",

    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        console.log("[clean-dist-folder] Cleaning dist folder...");
        const distPath = path.resolve("dist");

        try {
          // Check if dist folder exists
          if (fs.existsSync(distPath)) {
            // Remove all contents of dist folder
            const files = fs.readdirSync(distPath);

            for (const file of files) {
              const filePath = path.join(distPath, file);
              const stat = fs.statSync(filePath);

              if (stat.isDirectory()) {
                // Recursively remove directory
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                // Remove file
                fs.unlinkSync(filePath);
              }
            }

            console.log(
              `[clean-dist-folder] Successfully cleaned dist folder (${files.length} items removed)`
            );
          } else {
            console.log(
              "[clean-dist-folder] Dist folder doesn't exist, nothing to clean"
            );
          }
        } catch (error) {
          console.error(
            "[clean-dist-folder] Error cleaning dist folder:",
            error
          );
        }
      },
    },
  };
}
