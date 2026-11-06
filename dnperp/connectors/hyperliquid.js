/**
 * Hyperliquid (Entropy) Exchange Connector Module
 * Implements standard asset data fetch interface for Hyperliquid DEXes
 */

window.HyperliquidConnector = {
  id: 'hyperliquid',
  name: 'Hyperliquid (Entropy)',
  
  /**
   * Fetch asset price, funding rate, and 24h volume for a given symbol
   * @param {string} symbol - Ticker symbol (e.g. "SNDK", "ANTH", "OAI")
   * @param {object} options - Optional config (e.g. { dex: 'io' })
   * @returns {Promise<{price: number, funding: number|null, volume24h: number, priceSource: string}>}
   */
  async fetchAssetData(symbol, options = {}) {
    const dex = options.dex || 'io';
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: dex })
    });

    if (!res.ok) {
      throw new Error(`Hyperliquid API HTTP error: ${res.status}`);
    }

    const data = await res.json();
    const universe = data[0]?.universe || [];
    const assetCtxs = data[1] || [];

    const cleanSymbol = symbol.trim().toUpperCase();
    const idx = universe.findIndex(u => 
      u.name === cleanSymbol || 
      u.name === `${dex}:${cleanSymbol}` || 
      u.name.endsWith(':' + cleanSymbol)
    );

    if (idx === -1 || !assetCtxs[idx]) {
      throw new Error(`Symbol '${cleanSymbol}' not found on Hyperliquid (dex "${dex}")`);
    }

    const ctx = assetCtxs[idx];
    const markPx = parseFloat(ctx.markPx) || 0;
    const fundingHourly = parseFloat(ctx.funding) || 0;
    const fundingAnnual = fundingHourly * 24 * 365 * 100;
    const vol24h = parseFloat(ctx.dayNtlVlm) || 0;

    return {
      price: markPx,
      funding: fundingAnnual,
      volume24h: vol24h,
      priceSource: 'mark_price'
    };
  }
};
