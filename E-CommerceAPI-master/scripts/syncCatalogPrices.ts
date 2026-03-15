import mongoose from "mongoose";
import { env } from "../config/env";
import Db from "../database/database";
import productModel from "../model/productModel";
import { type PublicEasyBuyCatalogPayload } from "../utils/easyBuyCatalog";
import { findCatalogModelForProduct, syncProductPricesFromCatalog } from "../utils/productPriceSync";

const isDryRun = process.argv.includes("--dry-run");

const fetchCatalog = async () => {
  const response = await fetch(`${env.easyBuyTrackerBaseUrl}/api/v1/public/easybuy-catalog`);

  if (!response.ok) {
    throw new Error(`Failed to fetch public catalog: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: PublicEasyBuyCatalogPayload };

  if (!payload.data?.models) {
    throw new Error("Public catalog payload is missing models");
  }

  return payload.data;
};

const syncCatalogPrices = async () => {
  await Db;

  try {
    const catalog = await fetchCatalog();
    const products = await productModel.find();

    const updates: Array<{
      name: string;
      oldPrice: number;
      newPrice: number;
      matchedCapacities: string;
    }> = [];
    let matchedProducts = 0;

    for (const product of products) {
      const catalogModel = findCatalogModelForProduct(product.name, catalog.models);
      const syncResult = syncProductPricesFromCatalog(
        {
          name: product.name,
          price: product.price,
          storageOptions: Array.isArray(product.storageOptions) ? product.storageOptions : [],
        },
        catalogModel,
      );

      if (!syncResult.matchedModel) {
        continue;
      }

      matchedProducts += 1;

      if (!syncResult.changed) {
        continue;
      }

      updates.push({
        name: product.name,
        oldPrice: product.price,
        newPrice: syncResult.updatedProduct.price,
        matchedCapacities: syncResult.matchedCapacities.join(", ") || "base price only",
      });

      if (isDryRun) {
        continue;
      }

      product.price = syncResult.updatedProduct.price;
      product.storageOptions = syncResult.updatedProduct.storageOptions;
      await product.save();
    }

    console.log(
      `${isDryRun ? "Dry run" : "Sync"} complete. Matched ${matchedProducts} products and ${isDryRun ? "would update" : "updated"} ${updates.length} products.`,
    );

    if (updates.length > 0) {
      console.table(updates);
    } else {
      console.log("No price changes were required.");
    }
  } finally {
    await mongoose.disconnect();
  }
};

void syncCatalogPrices().catch((error) => {
  console.error("Failed to sync catalog prices");
  console.error(error);
  void mongoose.disconnect().finally(() => {
    process.exit(1);
  });
});
