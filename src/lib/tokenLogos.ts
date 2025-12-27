// Token logo URL utilities using Alcor Exchange's token logo repository

const ALCOR_LOGO_BASE = 'https://raw.githubusercontent.com/alcorexchange/alcor-ui/master/assets/tokens/wax';

/**
 * Get the token logo URL from Alcor's repository
 * Format: https://raw.githubusercontent.com/alcorexchange/alcor-ui/master/assets/tokens/wax/{contract}/{symbol_lowercase}.png
 */
export function getTokenLogoUrl(contract: string, symbol: string): string {
  return `${ALCOR_LOGO_BASE}/${contract}/${symbol.toLowerCase()}.png`;
}

/**
 * Fallback placeholder for tokens without logos
 */
export const TOKEN_LOGO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ODg4ODgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwYXRoIGQ9Ik0xMiA2djEyIi8+PHBhdGggZD0iTTYgMTJoMTIiLz48L3N2Zz4=';
