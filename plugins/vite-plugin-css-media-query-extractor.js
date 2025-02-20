import { parse } from "node-html-parser";
import { promises as fs } from "fs";
import path from "path";

function extractMediaQueries() {
  let distDir = "";

  return {
    name: "vite-media-query-extractor",
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
          console.log("[media-query-extractor] Starting extraction process...");

          // Check if dist directory exists
          if (
            !(await fs
              .access(distDir)
              .then(() => true)
              .catch(() => false))
          ) {
            throw new Error(
              `[media-query-extractor] Directory ${distDir} not found`
            );
          }

          // Check for index.html
          const htmlPath = path.join(distDir, "index.html");
          let attempts = 0;
          const maxAttempts = 10;
          const delay = 100; // 100ms between checks

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
              "[media-query-extractor] index.html not found after waiting"
            );
          }

          // Read and parse index.html
          const html = await fs.readFile(htmlPath, "utf-8");
          const root = parse(html);
          const styleTags = root.querySelectorAll("style");
          const mediaQueries = new Set();

          if (styleTags.length === 0) {
            console.log("[media-query-extractor] No style tags found");
            return;
          }

          // Helper function to check if position is inside an at-rule
          function isInsideAtRule(
            css,
            position,
            atRules = ["@supports", "@keyframes", "@font-face"]
          ) {
            const beforeContent = css.substring(0, position);
            let isInside = false;

            atRules.forEach((rule) => {
              const lastRuleIndex = beforeContent.lastIndexOf(rule);
              if (lastRuleIndex !== -1) {
                const braceCount = beforeContent
                  .substring(lastRuleIndex)
                  .split("")
                  .reduce((count, char) => {
                    if (char === "{") return count + 1;
                    if (char === "}") return count - 1;
                    return count;
                  }, 0);
                if (braceCount > 0) isInside = true;
              }
            });

            return isInside;
          }

          // Helper function to find matching closing brace
          function findMatchingBrace(css, startIndex) {
            let braceCount = 1;
            let i = startIndex;

            while (i < css.length && braceCount > 0) {
              if (css[i] === "{") braceCount++;
              if (css[i] === "}") braceCount--;
              i++;
            }

            return braceCount === 0 ? i : -1;
          }

          // Process each style tag
          styleTags.forEach((styleTag) => {
            const css = styleTag.textContent;
            let processedCSS = css;
            let lastIndex = 0;
            const mediaQueryMatches = [];

            // Find all top-level media queries
            while (true) {
              const mediaStart = processedCSS.indexOf("@media", lastIndex);
              if (mediaStart === -1) break;

              // Skip if this media query is nested inside another at-rule
              if (isInsideAtRule(processedCSS, mediaStart)) {
                lastIndex = mediaStart + 6; // length of '@media'
                continue;
              }

              const openBraceIndex = processedCSS.indexOf("{", mediaStart);
              if (openBraceIndex === -1) break;

              const closeIndex = findMatchingBrace(
                processedCSS,
                openBraceIndex + 1
              );
              if (closeIndex === -1) break;

              const mediaQuery = processedCSS.substring(mediaStart, closeIndex);
              mediaQueryMatches.push({
                content: mediaQuery,
                start: mediaStart,
                end: closeIndex,
              });

              lastIndex = closeIndex;
            }

            // Add found media queries to the set
            mediaQueryMatches.forEach((query) =>
              mediaQueries.add(query.content)
            );

            // Remove media queries from the original CSS
            let newCSS = processedCSS;
            // Remove queries from end to start to maintain correct indices
            mediaQueryMatches.reverse().forEach((query) => {
              newCSS =
                newCSS.substring(0, query.start) + newCSS.substring(query.end);
            });

            // Clean up empty lines and extra spaces
            const cleanedCSS = newCSS.replace(/^\s*[\r\n]/gm, "").trim();

            // Update style tag content
            styleTag.textContent = cleanedCSS;
          });

          // Create media-queries.css file
          const mediaQueriesCSS = Array.from(mediaQueries).join("\n\n");
          await fs.writeFile(
            path.join(distDir, "media-queries.css"),
            mediaQueriesCSS
          );

          // Update index.html with cleaned style tags
          await fs.writeFile(htmlPath, root.toString());

          // Create marker file for other plugins
          await fs.writeFile(
            path.join(distDir, ".media-queries-extracted"),
            new Date().toISOString()
          );

          console.log(
            "[media-query-extractor] Successfully extracted media queries"
          );
        } catch (error) {
          console.error("[media-query-extractor] Error:", error);
          throw error;
        }
      },
    },
  };
}

export default function viteCssMediaQueryExtractor() {
  return extractMediaQueries();
}
