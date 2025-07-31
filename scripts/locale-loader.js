import { promises as fs } from "fs";
import path from "path";

// Function to load locale data based on language
async function loadLocaleData(lang = "en") {
  try {
    let localeFilePath;

    // Handle special case for 'en' locale with 'default' suffix
    if (lang === "en") {
      localeFilePath = path.resolve(
        process.cwd(),
        "src/locales/en.default.json"
      );
    } else {
      localeFilePath = path.resolve(process.cwd(), `src/locales/${lang}.json`);
    }

    if (
      !(await fs
        .access(localeFilePath)
        .then(() => true)
        .catch(() => false))
    ) {
      console.warn(`[locale-loader] Locale file not found: ${localeFilePath}`);
      return {};
    }

    const localeFileContent = await fs.readFile(localeFilePath, "utf-8");
    const data = JSON.parse(localeFileContent);

    // Process the data to make it handlebars-friendly
    const processedData = processDataForHandlebars(data);
    return processedData;
  } catch (error) {
    console.error(`[locale-loader] Error loading locale file:`, error);
    return {};
  }
}

// Function to process data for handlebars compatibility
function processDataForHandlebars(data) {
  const processed = { ...data };

  // Ensure products array is properly structured for handlebars
  if (data.products && Array.isArray(data.products)) {
    // Keep the original products array - handlebars can handle this natively
    processed.products = data.products;

    // Also create flattened versions as backup
    data.products.forEach((product, index) => {
      Object.keys(product).forEach((key) => {
        processed[`product_${index}_${key}`] = product[key];
      });
    });

    // Add some helpful variables
    processed.products_count = data.products.length;
    processed.first_product = data.products[0] || {};
  }

  return processed;
}

// Export the loader function for use in vite.config.js
export { loadLocaleData };
