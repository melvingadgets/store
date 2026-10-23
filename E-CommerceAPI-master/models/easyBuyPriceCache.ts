import mongoose from "mongoose";

// A read-only cache of EasyBuy's selling prices (Shortwork/AGENTS.md §1.3): the store never
// writes it by hand — only the easybuy.price.updated event effect does, inside the inbox
// transaction. It carries where it came from (source + sourceSeq + asOf) and is rebuildable
// by replaying events. Prices are integer kobo (§4.1).
const EasyBuyPriceCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true }, // `${provider}:${model}:${capacity}`
    provider: { type: String, required: true },
    model: { type: String, required: true },
    capacity: { type: String, required: true },
    priceKobo: { type: Number, required: true },
    previousPriceKobo: { type: Number, default: null },
    source: { type: String, default: "easybuy" },
    sourceSeq: { type: Number, required: true },
    asOf: { type: Date, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("easybuypricecache", EasyBuyPriceCacheSchema);
