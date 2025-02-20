import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

async function resizeImages(inputDir) {
  try {
    // Create output directories if they don't exist
    const outputDirs = ["lg", "md", "sm"];
    for (const dir of outputDirs) {
      await fs.mkdir(path.join(inputDir, dir), { recursive: true });
    }

    // Get all image files from input directory
    const files = await fs.readdir(inputDir);
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    });

    console.log(`Found ${imageFiles.length} images to process`);

    for (const file of imageFiles) {
      const filePath = path.join(inputDir, file);
      const fileExt = path.extname(file);
      const fileName = path.basename(file, fileExt);

      // Remove any existing size suffixes
      const baseFileName = fileName.replace(/-(?:lg|md|sm)$/, "");

      // Get original image metadata
      const metadata = await sharp(filePath).metadata();
      const originalWidth = metadata.width;
      const originalHeight = metadata.height;

      // Calculate sizes
      const sizes = {
        lg: { width: originalWidth, height: originalHeight },
        md: {
          width: Math.round(originalWidth / 2),
          height: Math.round(originalHeight / 2),
        },
        sm: {
          width: Math.round(originalWidth / 4),
          height: Math.round(originalHeight / 4),
        },
      };

      // Process each size
      for (const [size, dimensions] of Object.entries(sizes)) {
        const outputFileName = `${baseFileName}-${size}${fileExt}`;
        const outputPath = path.join(inputDir, size, outputFileName);

        await sharp(filePath)
          .resize(dimensions.width, dimensions.height, {
            fit: "contain",
            withoutEnlargement: true,
          })
          .toFile(outputPath);

        console.log(`Created ${size} version: ${outputFileName}`);
      }

      // Move original to lg directory
      const lgFileName = `${baseFileName}-lg${fileExt}`;
      const lgPath = path.join(inputDir, "lg", lgFileName);
      await fs.rename(filePath, lgPath);
    }

    console.log("Image processing complete!");
  } catch (error) {
    console.error("Error processing images:", error);
    process.exit(1);
  }
}

// Create CLI interface
if (process.argv.length < 3) {
  console.error("Please provide an input directory path");
  process.exit(1);
}

const inputDir = process.argv[2];
resizeImages(inputDir);
