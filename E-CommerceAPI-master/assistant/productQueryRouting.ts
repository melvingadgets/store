const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const PRODUCT_TRAILING_STOP_WORDS = new Set([
  "available",
  "availability",
  "stock",
  "price",
  "cost",
  "details",
  "detail",
  "storage",
  "option",
  "options",
  "phone",
]);

export const isAvailabilityQuestion = (message: string) =>
  /\b(available|availability|in stock|stock|do you have|have)\b/i.test(message);

export const extractExplicitProductName = (message: string) => {
  const match = message.match(/\biphone(?:\s+[a-z0-9()+-]+){0,4}\b/i);
  if (!match) {
    return undefined;
  }

  const tokens = normalizeText(match[0]).split(" ");
  while (tokens.length > 1 && PRODUCT_TRAILING_STOP_WORDS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  if (tokens.length < 2) {
    return undefined;
  }

  const [, ...rest] = tokens;
  return ["iPhone", ...rest.map((token) => token.toUpperCase())].join(" ");
};

export const isExactProductNameMatch = (candidate: string, productName: string) =>
  normalizeText(candidate) === normalizeText(productName);
