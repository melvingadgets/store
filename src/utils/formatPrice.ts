const formatCompactAmount = (price: number): string | null => {
  const absolutePrice = Math.abs(price);

  if (absolutePrice < 1_000) {
    return null;
  }

  const suffixes: Array<{ value: number; suffix: string }> = [
    { value: 1_000_000_000, suffix: "b" },
    { value: 1_000_000, suffix: "m" },
    { value: 1_000, suffix: "k" },
  ];

  const matchedSuffix = suffixes.find(({ value }) => absolutePrice >= value);

  if (!matchedSuffix) {
    return null;
  }

  const compactValue = price / matchedSuffix.value;
  const hasFraction = Math.abs(compactValue) < 10 && Number.isInteger(compactValue) === false;
  const formattedValue = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 1 : 0,
  }).format(compactValue);

  return `NGN ${formattedValue}${matchedSuffix.suffix}`;
};

const formatPrice = (price: number): string => {
  return (
    formatCompactAmount(price) ??
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(price)
      .replace("NGN", "NGN ")
  );
};

export default formatPrice;
