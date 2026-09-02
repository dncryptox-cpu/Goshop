/**
 * Lighter (Robinhood Chain) Exchange Connector Module
 * Implements standard asset data fetch interface for Lighter orderbook API
 */

window.LighterConnector = {
  id: 'lighter',
  name: 'Lighter (Robinhood Chain)',

  /**
   * Fetch asset price, funding rate proxy, and 24h volume for a given symbol
   * @param {string} symbol - Ticker symbol (e.g. "SNDK", "ANTHROPIC", "OPENAI")
   * @param {object} options - Optional config
   * @returns {Promise<{price: number, funding: number|null, volume24h: number, priceSource: string}>}
   */
  async fetchAssetData(symbol, options = {}) {
    const res = await fetch('https://api.rh.lighter.xyz/api/v1/orderBookDetails');
    if (!res.ok) {
      throw new Error(`Lighter API HTTP error: ${res.status}`);
    }

    const data = await res.json();
    const books = data.order_book_details || [];

    const cleanSymbol = symbol.trim().toUpperCase();
    const book = books.find(b => b.symbol === cleanSymbol);

    if (!book) {
      throw new Error(`Symbol '${cleanSymbol}' not found on Lighter Robinhood Chain`);
    }

    const markPx = parseFloat(book.mark_price) || 0;
    const indexPx = parseFloat(book.index_price) || markPx || 1;
    const fundingProxy = ((markPx - indexPx) / indexPx) * 100;
    const vol24h = parseFloat(book.daily_quote_token_volume) || 0;

    return {
      price: markPx,
      funding: fundingProxy,
      volume24h: vol24h,
      priceSource: 'mark_price'
    };
  }
};
