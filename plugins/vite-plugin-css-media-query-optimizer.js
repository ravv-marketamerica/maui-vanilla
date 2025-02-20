import fs from "fs";
import path from "path";
import postcss from "postcss";
import { createFilter } from "@rollup/pluginutils";

function sortMediaQueries(a, b) {
  const getMinWidth = (query) => {
    const match = query.match(/min-width:\s*(\d+)px/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const minWidthA = getMinWidth(a);
  const minWidthB = getMinWidth(b);

  return minWidthA - minWidthB;
}

function viteCssMediaQueryOptimizer(options = {}) {
  const defaultOptions = {
    distDir: "dist",
    include: ["**/*.css"],
    exclude: ["node_modules/**"],
  };

  const config = { ...defaultOptions, ...options };
  const filter = createFilter(config.include, config.exclude);

  return {
    name: "vite-plugin-media-query-optimizer",
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
          if (!fs.existsSync(config.distDir)) {
            console.warn(
              `[media-query-optimizer] Directory ${config.distDir} not found`
            );
            return;
          }

          // Process CSS files
          const files = fs.readdirSync(config.distDir);
          for (const file of files) {
            if (file.endsWith(".css") && filter(file)) {
              const filePath = path.join(config.distDir, file);
              const content = fs.readFileSync(filePath, "utf8");

              const result = await postcss().process(content, {
                from: filePath,
                to: filePath,
              });
              const css = result.root;

              const mediaQueries = new Map();

              css.walkAtRules("media", (rule) => {
                const query = rule.params;
                if (!mediaQueries.has(query)) {
                  mediaQueries.set(query, []);
                }
                mediaQueries.get(query).push(...rule.nodes);
                rule.remove();
              });

              const sortedQueries = Array.from(mediaQueries.keys()).sort(
                sortMediaQueries
              );

              sortedQueries.forEach((query) => {
                const mediaRule = postcss.atRule({
                  name: "media",
                  params: query,
                });
                mediaRule.append(mediaQueries.get(query));
                css.append(mediaRule);
              });

              const optimizedCSS = css.toString();
              fs.writeFileSync(filePath, optimizedCSS);

              console.log(`[media-query-optimizer] Processed: ${file}`);
            }
          }

          // Create a marker file to signal completion
          const markerPath = path.join(config.distDir, ".css-optimized");
          fs.writeFileSync(markerPath, new Date().toISOString());

          console.log("[media-query-optimizer] Finished processing CSS files");
        } catch (error) {
          console.error("[media-query-optimizer] Error:", error);
          throw error;
        }
      },
    },
  };
}

export default viteCssMediaQueryOptimizer;
