export type CurrencyCode = "IDR" | "USD" | "EUR";

interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
}

const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyConfig> = {
  IDR: { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 0 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
};

const DEFAULT_CURRENCY: CurrencyCode = "IDR";

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  options?: { showSymbol?: boolean; locale?: string }
): string {
  const config = CURRENCY_CONFIGS[currency];
  const { showSymbol = true, locale = "id-ID" } = options ?? {};

  const formatter = new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  });

  const formatted = formatter.format(amount);

  if (showSymbol) {
    return `${config.symbol} ${formatted}`;
  }

  return formatted;
}

export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,-]/g, "").replace(/,/g, ".");
  return Number.parseFloat(cleaned) || 0;
}

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number>
): number {
  if (from === to) return amount;

  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate) {
    throw new Error(`Exchange rate not found for ${from} or ${to}`);
  }

  const baseAmount = amount / fromRate;
  return baseAmount * toRate;
}

export function getCurrencyConfig(currency: CurrencyCode): CurrencyConfig {
  return CURRENCY_CONFIGS[currency];
}
