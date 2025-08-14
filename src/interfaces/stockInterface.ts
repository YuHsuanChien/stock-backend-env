export interface SnapshotData {
  date: string;
  time: string;
  market: string;
  data: {
    type: string;
    symbol: string;
    name: string;
    openPrice: number;
    highPrice: number;
    lowPrice: number;
    closePrice: number;
    change: number;
    changePercent: number;
    tradeVolume: number;
    tradeValue: number;
    lastPrice: number;
    lastUpdated: number;
  }[];
}

/**
 * 股票價格數據介面
 */
export interface StockPriceData {
  stockId: number;
  tradeDate: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IntradayTicker {
  date: string;
  type: string;
  exchange: string;
  market: string;
  symbol: string;
  name: string;
  industry: string;
  securityType: string;
  previousClose: number;
  referencePrice: number;
  limitUpPrice: number;
  limitDownPrice: number;
  canDayTrade: boolean;
  canBuyDayTrade: boolean;
  canBelowFlatMarginShortSell: boolean;
  canBelowFlatSBLShortSell: boolean;
  isAttention: boolean;
  isDisposition: boolean;
  isUnusuallyRecommended: boolean;
  isSpecificAbnormally: boolean;
  matchingInterval: number;
  securityStatus: string;
  boardLot: number;
  tradingCurrency: string;
}
