import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

async function convertImages(inputDir, outputDir, quality = 80) {
  // Sets default directories
  inputDir = inputDir === undefined ? "./" : inputDir;
  outputDir = outputDir === undefined ? inputDir : outputDir;

  try {
    console.log(
      `[convert-images] Processing images from ${inputDir} to ${outputDir}`
    );
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });

    // Read all files from input directory
    const files = await fs.readdir(inputDir);

    // Filter for image files (add more extensions if needed)
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );

    console.log(
      `[convert-images] Found ${imageFiles.length} images to convert`
    );

    // Process each image
    for (const file of imageFiles) {
      const inputPath = path.join(inputDir, file);
      const fileNameWithoutExt = path.parse(file).name;

      console.log(`[convert-images] Converting ${file}...`);

      try {
        // Create Sharp instance for the input image
        const image = sharp(inputPath);

        // Convert to AVIF
        await image
          .avif({
            quality: quality,
            effort: 8, // Higher numbers are slower but provide better compression
          })
          .toFile(path.join(outputDir, `${fileNameWithoutExt}.avif`));

        // Convert to WebP
        await image
          .webp({
            quality: quality,
            effort: 6, // Default is 4, range is 0-6
          })
          .toFile(path.join(outputDir, `${fileNameWithoutExt}.webp`));

        console.log(`[convert-images] ✅ Successfully converted ${file}`);
      } catch (err) {
        console.error(
          `[convert-images] ❌ Error converting ${file}:`,
          err.message
        );
      }
    }

    console.log("[convert-images] Conversion complete!");
  } catch (err) {
    console.error("[convert-images] Error processing directory:", err.message);
  }
}

// // Check if input and output directories were provided
const [, , inputDir, outputDir, quality] = process.argv;

// if (!inputDir || !outputDir) {
//   console.log(
//     "Usage: node convert-images.js <input-directory> <output-directory>"
//   );
//   process.exit(1);
// }

convertImages(inputDir, outputDir, quality);
