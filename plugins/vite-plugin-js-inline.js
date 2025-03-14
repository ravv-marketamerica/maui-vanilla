// vite-plugin-inline-js.js
import fs from "fs";
import path from "path";

/**
 * Vite plugin to inline JavaScript files referenced in HTML script tags
 * @param {Object} options Plugin options
 * @param {boolean} [options.minify=false] Whether to minify the inlined JavaScript
 * @param {RegExp} [options.scriptTagPattern] Custom regex pattern for matching script tags
 * @param {function} [options.transformContent] Custom function to transform JS content before inlining
 * @returns {Object} Vite plugin
 */
export default function viteJsInline(options = {}) {
  const {
    minify = false,
    scriptTagPattern = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/g,
    transformContent = (content) => content,
    sourceDirs = ["src", "public"], // Additional directories to search for scripts
    inlineAll = false, // Whether to inline all scripts regardless of inline attribute
  } = options;

  // We'll load terser dynamically when needed
  let terserModule = null;

  // Function to find all HTML files in a directory recursively
  function findHtmlFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        findHtmlFiles(filePath, fileList);
      } else if (file.endsWith(".html")) {
        fileList.push(filePath);
      }
    }

    return fileList;
  }

  return {
    name: "vite-plugin-inline-js",
    apply: "build", // Only apply this plugin during build
    enforce: "post", // Run after other plugins

    // Use closeBundle hook to ensure all assets are written to disk first
    async closeBundle() {
      console.log("[js-inline] Looking for HTML files in dist directory...");

      // Load terser if minification is enabled
      if (minify) {
        try {
          terserModule = await import("terser");
          console.log(
            "[js-inline] Minification is enabled and terser is available"
          );
        } catch (e) {
          console.warn(
            "[js-inline] Terser is not installed but minify=true. Please install terser: npm install terser --save-dev"
          );
          console.warn("[js-inline] Continuing without minification");
        }
      }

      // Find HTML files in the dist directory
      const distDir = path.resolve(process.cwd(), "dist");
      if (!fs.existsSync(distDir)) {
        console.warn("[js-inline] Dist directory not found at:", distDir);
        return;
      }

      const htmlFiles = findHtmlFiles(distDir);
      console.log(
        `[js-inline] Found ${htmlFiles.length} HTML files in dist directory`
      );

      for (const htmlFile of htmlFiles) {
        try {
          console.log(
            `[js-inline] Processing HTML file: ${path.relative(
              distDir,
              htmlFile
            )}`
          );

          // Read the HTML file
          let htmlContent = fs.readFileSync(htmlFile, "utf-8");
          let modified = false;

          // Reset regex lastIndex
          scriptTagPattern.lastIndex = 0;

          // Process all script tags in the HTML
          let match;
          while ((match = scriptTagPattern.exec(htmlContent)) !== null) {
            const [fullMatch, srcPath] = match;

            // Skip external scripts or scripts without the "inline" attribute
            if (
              srcPath.startsWith("http") ||
              (!fullMatch.includes("inline") && !inlineAll)
            ) {
              continue;
            }

            try {
              // Try multiple potential locations for the JS file
              let jsFilePath;
              let fileExists = false;

              // First try: resolve relative to the HTML file
              jsFilePath = path.resolve(path.dirname(htmlFile), srcPath);
              fileExists = fs.existsSync(jsFilePath);

              // Second try: resolve relative to the dist directory
              if (!fileExists) {
                jsFilePath = path.resolve(distDir, srcPath);
                fileExists = fs.existsSync(jsFilePath);
              }

              // Third try: resolve relative to the source directory
              if (!fileExists) {
                jsFilePath = path.resolve(process.cwd(), srcPath);
                fileExists = fs.existsSync(jsFilePath);
              }

              // Try each of the provided source directories
              if (!fileExists) {
                for (const dir of sourceDirs) {
                  const attemptPath = path.resolve(
                    process.cwd(),
                    dir,
                    srcPath.replace(/^\.\//, "")
                  );
                  if (fs.existsSync(attemptPath)) {
                    jsFilePath = attemptPath;
                    fileExists = true;
                    break;
                  }
                }
              }

              // Check if we found the file in any of our attempted locations
              if (fileExists) {
                // Read the JavaScript file
                let jsContent = fs.readFileSync(jsFilePath, "utf-8");

                // Apply custom transformation
                jsContent = transformContent(jsContent, srcPath);

                // Minify the JavaScript if enabled and terser is available
                if (minify && terserModule) {
                  try {
                    console.log(`[js-inline] Minifying ${srcPath}...`);

                    const minifyResult = await terserModule.minify(jsContent, {
                      compress: {
                        passes: 2,
                        drop_console: false,
                        drop_debugger: true,
                      },
                      mangle: true,
                      output: {
                        comments: false,
                      },
                    });

                    if (minifyResult.error) {
                      console.warn(
                        `[js-inline] Minification error for ${srcPath}: ${minifyResult.error}`
                      );
                    } else {
                      const originalSize = Buffer.byteLength(jsContent, "utf8");
                      jsContent = minifyResult.code;
                      const minifiedSize = Buffer.byteLength(jsContent, "utf8");
                      const savings = (
                        (1 - minifiedSize / originalSize) *
                        100
                      ).toFixed(1);
                      console.log(
                        `[js-inline] Minified ${srcPath}: ${originalSize} → ${minifiedSize} bytes (${savings}% savings)`
                      );
                    }
                  } catch (error) {
                    console.warn(
                      `[js-inline] Error minifying ${srcPath}:`,
                      error
                    );
                    // Continue with unminified content
                  }
                }

                // Create a new script tag with the inlined content
                const inlineScriptTag = `<script>\n${jsContent}</script>`;

                // Replace the original script tag with the inlined version
                htmlContent = htmlContent.replace(fullMatch, inlineScriptTag);
                modified = true;

                console.log(`[js-inline] Inlined JavaScript file: ${srcPath}`);
              } else {
                console.warn(
                  `[js-inline] Could not find JavaScript file to inline: ${srcPath}`
                );
                console.warn(`[js-inline] Attempted paths:`);
                console.warn(
                  `[js-inline] 1. ${path.resolve(
                    path.dirname(htmlFile),
                    srcPath
                  )}`
                );
                console.warn(
                  `[js-inline] 2. ${path.resolve(distDir, srcPath)}`
                );
                console.warn(
                  `[js-inline] 3. ${path.resolve(process.cwd(), srcPath)}`
                );
                sourceDirs.forEach((dir, index) => {
                  console.warn(
                    `[js-inline] ${index + 4}. ${path.resolve(
                      process.cwd(),
                      dir,
                      srcPath.replace(/^\.\//, "")
                    )}`
                  );
                });
              }
            } catch (error) {
              console.error(
                `[js-inline] Error inlining JavaScript file ${srcPath}:`,
                error
              );
            }
          }

          if (modified) {
            // Write the updated HTML file back to disk
            fs.writeFileSync(htmlFile, htmlContent, "utf-8");
            console.log(
              `[js-inline] Updated HTML file with inlined scripts: ${path.relative(
                distDir,
                htmlFile
              )}`
            );
          } else {
            console.log(
              `[js-inline] No scripts to inline in: ${path.relative(
                distDir,
                htmlFile
              )}`
            );
          }
        } catch (error) {
          console.error(
            `[js-inline] Error processing HTML file ${htmlFile}:`,
            error
          );
        }
      }

      console.log("[js-inline] Plugin completed successfully");
    },

    // This is just a lightweight hook to provide information during the build
    buildEnd() {
      console.log(
        "[js-inline] Build ended. Will inline scripts once bundle is closed..."
      );
    },
  };
}
