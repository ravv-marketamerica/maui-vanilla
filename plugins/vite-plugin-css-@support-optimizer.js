import postcss from "postcss";
import path from "path";

function createAtSupportsOptimizer() {
  let viteConfig;

  return {
    name: "vite-plugin-at-support-optimizer",
    apply: "build",
    enforce: "post",
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },
    closeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        console.log("[@support-optimizer] Running @Support Optimizer...");
        const outDir = viteConfig.build.outDir || "dist";

        try {
          const fs = await import("fs/promises");
          const files = await fs.readdir(outDir);
          const cssOutputFiles = files.filter((file) => file.endsWith(".css"));

          for (const fileName of cssOutputFiles) {
            const filePath = path.join(outDir, fileName);
            const css = await fs.readFile(filePath, "utf-8");

            const result = await postcss([
              {
                postcssPlugin: "optimize-supports",
                Once(root) {
                  const formatRules = new Map();
                  const formatSupportsConditions = new Map();
                  const formatPriority = {
                    avif: 1,
                    webp: 0,
                    jpg: 2,
                    jpeg: 2,
                    png: 3,
                  };

                  // First pass: Collect all rules by format
                  root.walkAtRules("supports", (rule) => {
                    const { format, originalCondition } = parseSupportsRule(
                      rule.params
                    );
                    if (!format) return;

                    if (!formatRules.has(format)) {
                      formatRules.set(format, new Map());
                      formatSupportsConditions.set(format, originalCondition);
                    }

                    // Process each selector and its media queries
                    rule.walkRules((cssRule) => {
                      const selector = cssRule.selector;
                      let mediaContext = "default";

                      // Check if rule is inside a media query
                      let parent = cssRule.parent;
                      while (parent && parent !== rule) {
                        if (
                          parent.type === "atrule" &&
                          parent.name === "media"
                        ) {
                          mediaContext = normalizeMediaQuery(parent.params);
                          break;
                        }
                        parent = parent.parent;
                      }

                      // Store rules by selector and media context
                      if (!formatRules.get(format).has(selector)) {
                        formatRules.get(format).set(selector, new Map());
                      }

                      if (
                        !formatRules.get(format).get(selector).has(mediaContext)
                      ) {
                        formatRules
                          .get(format)
                          .get(selector)
                          .set(mediaContext, []);
                      }

                      // Store declarations
                      cssRule.nodes.forEach((node) => {
                        if (node.type === "decl") {
                          formatRules
                            .get(format)
                            .get(selector)
                            .get(mediaContext)
                            .push(node);
                        }
                      });
                    });

                    rule.remove();
                  });

                  // Second pass: Rebuild optimized structure
                  const sortedFormats = Array.from(formatRules.keys()).sort(
                    (a, b) =>
                      (formatPriority[a] || 999) - (formatPriority[b] || 999)
                  );

                  sortedFormats.forEach((format) => {
                    const supportsCondition =
                      formatSupportsConditions.get(format);
                    const mergedRule = postcss.atRule({
                      name: "supports",
                      params: supportsCondition,
                    });

                    const selectorRules = formatRules.get(format);
                    const mediaQueries = new Set();

                    // Collect all media queries
                    selectorRules.forEach((contexts) => {
                      contexts.forEach((_, mediaContext) => {
                        if (mediaContext !== "default") {
                          mediaQueries.add(mediaContext);
                        }
                      });
                    });

                    // Add default rules first
                    selectorRules.forEach((contexts, selector) => {
                      if (contexts.has("default")) {
                        const rule = postcss.rule({ selector });
                        contexts.get("default").forEach((decl) => {
                          rule.append(decl.clone());
                        });
                        mergedRule.append(rule);
                      }
                    });

                    // Add media query rules
                    mediaQueries.forEach((mediaQuery) => {
                      const mediaRule = postcss.atRule({
                        name: "media",
                        params: mediaQuery,
                      });

                      selectorRules.forEach((contexts, selector) => {
                        if (contexts.has(mediaQuery)) {
                          const rule = postcss.rule({ selector });
                          contexts.get(mediaQuery).forEach((decl) => {
                            rule.append(decl.clone());
                          });
                          mediaRule.append(rule);
                        }
                      });

                      mergedRule.append(mediaRule);
                    });

                    root.append(mergedRule);
                  });
                },
              },
            ]).process(css, { from: undefined });

            await fs.writeFile(filePath, result.css);
            console.log(
              `[@support-optimizer] Successfully processed ${fileName}`
            );
          }
        } catch (error) {
          console.error(
            "[@support-optimizer] Error in Supports Optimizer:",
            error
          );
        }
      },
    },
  };
}

function parseSupportsRule(params) {
  // Handle data URLs
  const dataUrlMatch = params.match(/url\("(data:image\/(\w+);[^"]+)"\)/);
  if (dataUrlMatch) {
    return {
      format: dataUrlMatch[2],
      originalCondition: params,
    };
  }

  // Handle regular URLs
  const urlMatch = params.match(/url\("([^"]+)"\)/);
  if (!urlMatch) return { format: null, originalCondition: null };

  const testUrl = urlMatch[1];
  const formatMatch = testUrl.match(/\.(\w+)$/);
  const format = formatMatch ? formatMatch[1].toLowerCase() : null;

  return { format, originalCondition: params };
}

function normalizeMediaQuery(query) {
  return query
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/screen\s+and\s+/, "screen and ");
}

export default function viteCssAtSupportOptimizer() {
  return createAtSupportsOptimizer();
}
