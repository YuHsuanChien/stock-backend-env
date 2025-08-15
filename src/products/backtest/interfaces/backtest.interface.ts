/**
 * 股票數據介面
 */
export interface StockData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  ma20?: number;
  ma5?: number;
  ma60?: number;
  volumeMA20?: number;
  volumeRatio?: number;
  atr?: number;
  priceMomentum?: number;
  avgGain?: number;
  avgLoss?: number;
  ema12?: number;
  ema26?: number;
}

/**
 * 交易結果介面
 */
export interface TradeResult {
  stock: string;
  action: string;
  date: Date;
  price: number;
  quantity: number;
  amount: number;
  buySignalDate?: Date;
  sellSignalDate?: Date;
  actualBuyDate?: Date;
  actualSellDate?: Date;
  entryPrice?: number;
  entryDate?: Date;
  holdingDays?: number;
  profit?: number;
  profitRate?: number;
  reason: string;
  confidence?: number;
}

/**
 * 持倉介面
 */
export interface Position {
  entryDate: Date;
  entryPrice: number;
  quantity: number;
  investAmount: number;
  confidence?: number;
  buySignalDate?: Date;
  highPriceSinceEntry: number;
  trailingStopPrice: number;
  atrStopPrice?: number;
  entryATR?: number;
}

/**
 * 回測結果介面
 */
export interface BacktestResults {
  performance: {
    initialCapital: number;
    finalCapital: number;
    totalReturn: number;
    annualReturn: number;
    totalProfit: number;
  };
  trades: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    maxWin: number;
    maxLoss: number;
    avgHoldingDays: number;
    profitFactor: number;
  };
  detailedTrades: TradeResult[];
  equityCurve: {
    date: string;
    value: number;
    cash: number;
    positions: number;
  }[];
  stockPerformance: {
    stock: string;
    trades: number;
    winRate: number;
    totalProfit: number;
  }[];
}

/**
 * 策略參數介面
 */
export interface StrategyParams {
  rsiPeriod: number;
  rsiOversold: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  volumeThreshold: number;
  maxPositionSize: number;
  stopLoss: number;
  stopProfit: number;
  confidenceThreshold: number;
  enableTrailingStop: boolean;
  trailingStopPercent: number;
  trailingActivatePercent: number;
  enableATRStop: boolean;
  atrPeriod: number;
  atrMultiplier: number;
  minHoldingDays: number;
  enablePriceMomentum: boolean;
  priceMomentumPeriod: number;
  priceMomentumThreshold: number;
  enableMA60: boolean;
  maxTotalExposure: number;
  usePythonLogic: boolean;
  hierarchicalDecision: boolean;
  dynamicPositionSize: boolean;
}

/**
 * 買入信號結果
 */
export interface BuySignalResult {
  signal: boolean;
  reason: string;
  confidence?: number;
}

/**
 * 賣出信號結果
 */
export interface SellSignalResult {
  signal: boolean;
  reason: string;
}
