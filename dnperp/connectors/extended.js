/**
 * Extended Exchange Standard Connector Implementation
 * Base API: https://api.starknet.extended.exchange/api/v1
 * Format contract: fetchAssetData(symbol, options)
 */
const ExtendedConnector = {
  id: 'extended',
  name: 'Extended (Starknet DEX)',

  async fetchAssetData(symbol, options = {}) {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Symbol is required for Extended connector');
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    // Check ticker format: Extended requires ASSET-CURRENCY format (e.g. BTC-USD)
    if (!cleanSymbol.includes('-')) {
      throw new Error(`Định dạng Ticker Extended phải là TÊN-USD (VD: ${cleanSymbol}-USD).`);
    }

    const url = `https://api.starknet.extended.exchange/api/v1/info/markets/${encodeURIComponent(cleanSymbol)}/stats`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Extended API error (${res.status}): Market '${cleanSymbol}' not found.`);
    }

    const json = await res.json();
    if (!json || json.status !== 'OK' || !json.data) {
      throw new Error(`Invalid response structure from Extended API for '${cleanSymbol}'.`);
    }

    const data = json.data;
    const markPrice = parseFloat(data.markPrice) || parseFloat(data.lastPrice) || 0;
    const fundingRateHourly = parseFloat(data.fundingRate) || 0;
    const volume24h = parseFloat(data.dailyVolume) || 0;

    if (markPrice <= 0) {
      throw new Error(`Market '${cleanSymbol}' does not exist or has 0 price on Extended.`);
    }

    // Convert hourly funding rate to annualized percentage rate (APR %)
    const fundingAnnualPct = fundingRateHourly * 24 * 365 * 100;

    return {
      price: markPrice,
      funding: parseFloat(fundingAnnualPct.toFixed(2)),
      volume24h: volume24h,
      priceSource: 'mark_price'
    };
  }
};

if (typeof window !== 'undefined') {
  window.ExtendedConnector = ExtendedConnector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtendedConnector;
}
