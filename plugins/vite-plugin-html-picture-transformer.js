import { parse } from "node-html-parser";
import { promises as fs } from "fs";
import path from "path";

function transformPictureTags() {
  let distDir = "";

  return {
    name: "vite-picture-transformer",
    apply: "build",
    enforce: "post",

    configResolved(config) {
      distDir = config.build.outDir || "dist";
    },

    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        try {
          console.log(
            "[picture-transformer] Starting transformation process..."
          );

          // Check if dist directory exists
          if (
            !(await fs
              .access(distDir)
              .then(() => true)
              .catch(() => false))
          ) {
            throw new Error(
              `[picture-transformer] Directory ${distDir} not found`
            );
          }

          // Check for index.html
          const htmlPath = path.join(distDir, "index.html");
          let attempts = 0;
          const maxAttempts = 10;
          const delay = 100;

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
              "[picture-transformer] index.html not found after waiting"
            );
          }

          // Read and parse index.html
          const html = await fs.readFile(htmlPath, "utf-8");
          const root = parse(html);
          const pictureTags = root.querySelectorAll("picture");

          if (pictureTags.length === 0) {
            console.log("[picture-transformer] No picture tags found");
            return;
          }

          // Process each picture tag
          pictureTags.forEach((pictureTag) => {
            const imgTag = pictureTag.querySelector("img");
            if (!imgTag) return;

            const originalSrc = imgTag.getAttribute("src");
            if (!originalSrc) return;

            // Extract path components
            const srcParts = originalSrc.split("/");
            const filename = srcParts[srcParts.length - 1];
            const baseDir = srcParts.slice(0, -2).join("/");

            // Get base filename without size suffix and extension
            const baseFilename = filename.replace(/-sm\.jpg$/, "");

            // Create sources for desktop (lg)
            const desktopSources = [
              {
                srcset: `${baseDir}/lg/${baseFilename}-lg.webp`,
                type: "image/webp",
                media: "(min-width: 1200px)",
              },
              {
                srcset: `${baseDir}/lg/${baseFilename}-lg.avif`,
                type: "image/avif",
                media: "(min-width: 1200px)",
              },
              {
                srcset: `${baseDir}/lg/${baseFilename}-lg.jpg`,
                type: "image/jpeg",
                media: "(min-width: 1200px)",
              },
            ];

            // Create sources for tablet (md)
            const tabletSources = [
              {
                srcset: `${baseDir}/md/${baseFilename}-md.webp`,
                type: "image/webp",
                media: "(min-width: 768px)",
              },
              {
                srcset: `${baseDir}/md/${baseFilename}-md.avif`,
                type: "image/avif",
                media: "(min-width: 768px)",
              },
              {
                srcset: `${baseDir}/md/${baseFilename}-md.jpg`,
                type: "image/jpeg",
                media: "(min-width: 768px)",
              },
            ];

            // Create sources for mobile (sm)
            const mobileSources = [
              {
                srcset: `${baseDir}/sm/${baseFilename}-sm.webp`,
                type: "image/webp",
              },
              {
                srcset: `${baseDir}/sm/${baseFilename}-sm.avif`,
                type: "image/avif",
              },
              {
                srcset: `${baseDir}/sm/${baseFilename}-sm.jpg`,
                type: "image/jpeg",
              },
            ];

            // Remove existing source tags
            pictureTag
              .querySelectorAll("source")
              .forEach((source) => source.remove());

            // Create new source tags HTML
            const sourcesHtml = [
              ...desktopSources,
              ...tabletSources,
              ...mobileSources,
            ]
              .map(
                ({ srcset, type, media }) =>
                  `<source srcset="${srcset}" ${
                    media ? `media="${media}"` : ""
                  } type="${type}">`
              )
              .join("\n  ");

            // Set the new HTML content with sources and existing img
            pictureTag.set_content(`${sourcesHtml}\n  ${imgTag.toString()}`);
          });

          // Write updated HTML
          await fs.writeFile(htmlPath, root.toString());

          console.log(
            "[picture-transformer] Successfully transformed picture tags"
          );
        } catch (error) {
          console.error("[picture-transformer] Error:", error);
          throw error;
        }
      },
    },
  };
}

export default function viteCssPictureTransformerPlugin() {
  return transformPictureTags();
}
