import { Injectable, Inject } from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import {
  StockData,
  BacktestResults,
  StrategyParams,
  TradeResult,
  Position,
  BuySignalResult,
  SellSignalResult,
} from './interfaces/backtest.interface';

@Injectable()
export class BacktestService {
  @Inject()
  private readonly databaseService: DatabaseService;

  /**
   * 執行回測
   */
  async runBacktest(
    stocks: string[],
    startDate: string,
    endDate: string,
    initialCapital: number,
    strategyParams: StrategyParams,
  ): Promise<BacktestResults> {
    console.log('🔥 開始執行後端回測...');

    let currentCapital = initialCapital;
    const trades: TradeResult[] = [];
    const positions: Record<string, Position> = {};
    const pendingBuyOrders: Record<
      string,
      {
        confidence: number;
        reason: string;
        signalDate: Date;
        targetExecutionDate: Date | null;
      }
    > = {};
    const pendingSellOrders: Record<
      string,
      {
        reason: string;
        signalDate: Date;
        targetExecutionDate: Date | null;
        position: Position;
      }
    > = {};
    const equityCurve: {
      date: string;
      value: number;
      cash: number;
      positions: number;
    }[] = [];

    // 獲取股票數據
    const allStockData: Record<string, StockData[]> = {};
    for (const stock of stocks) {
      console.log(`📈 正在處理 ${stock}...`);
      try {
        const rawData = await this.getStockData(stock, startDate, endDate);
        if (rawData && rawData.length > 0) {
          const processedData = this.calculateIndicators(
            rawData,
            strategyParams,
          );
          allStockData[stock] = processedData;
          console.log(`✅ ${stock} 數據處理完成: ${rawData.length} 天`);
        } else {
          console.warn(`⚠️ ${stock} 數據為空，跳過處理`);
        }
      } catch (error) {
        console.error(`❌ ${stock} 數據獲取失敗:`, error);
      }
    }

    const validStocks = Object.keys(allStockData).filter(
      (stock) => allStockData[stock] && allStockData[stock].length > 0,
    );

    if (validStocks.length === 0) {
      throw new Error('無法獲取任何股票的有效數據');
    }

    console.log(`📊 成功獲取 ${validStocks.length} 支股票的數據，開始回測...`);

    // 獲取所有交易日期
    const allDates = [
      ...new Set(
        Object.values(allStockData)
          .flat()
          .map((d) => d.date.toISOString().split('T')[0]),
      ),
    ].sort();

    // 遍歷每個交易日
    for (const dateStr of allDates) {
      const currentDate = new Date(dateStr);

      if (!this.isTradingDay(currentDate, allStockData)) {
        continue;
      }

      for (const stock of validStocks) {
        const stockData = allStockData[stock];
        const currentIndex = stockData.findIndex(
          (d) => d.date.toISOString().split('T')[0] === dateStr,
        );

        if (currentIndex === -1) continue;

        const minRequiredIndex =
          strategyParams.macdSlow + strategyParams.macdSignal;
        if (currentIndex < minRequiredIndex) continue;

        const current = stockData[currentIndex];
        const previous = stockData[currentIndex - 1];

        if (!current.rsi || !current.macd || !current.macdSignal) {
          continue;
        }

        // 處理待執行的賣出訂單
        if (pendingSellOrders[stock]) {
          const sellOrder = pendingSellOrders[stock];
          const shouldExecute =
            sellOrder.targetExecutionDate &&
            currentDate >= sellOrder.targetExecutionDate;

          if (shouldExecute) {
            const position = sellOrder.position;
            const sellAmount = current.open * position.quantity * 0.995575;
            const profit = sellAmount - position.investAmount;
            const profitRate = profit / position.investAmount;
            const holdingDays = Math.floor(
              (currentDate.getTime() - position.entryDate.getTime()) /
                (1000 * 60 * 60 * 24),
            );

            // 記錄交易
            trades.push({
              stock,
              action: 'sell',
              date: currentDate,
              price: current.open,
              quantity: position.quantity,
              amount: sellAmount,
              sellSignalDate: sellOrder.signalDate,
              actualSellDate: currentDate,
              profit,
              profitRate,
              holdingDays,
              reason: sellOrder.reason,
            });

            currentCapital += sellAmount;
            delete positions[stock];
            delete pendingSellOrders[stock];

            console.log(
              `💰 ${dateStr} ${stock} 賣出: 價格${current.open.toFixed(2)} | 獲利率${(
                profitRate * 100
              ).toFixed(2)}%`,
            );
          }
        }

        // 處理待執行的買入訂單
        if (pendingBuyOrders[stock]) {
          const buyOrder = pendingBuyOrders[stock];
          const shouldExecute =
            buyOrder.targetExecutionDate &&
            currentDate >= buyOrder.targetExecutionDate;

          if (shouldExecute) {
            const maxInvestAmount =
              currentCapital * strategyParams.maxPositionSize;
            const quantity =
              Math.floor(maxInvestAmount / current.open / 1000) * 1000;
            const actualInvestAmount = quantity * current.open * 1.001425;

            if (quantity >= 1000 && actualInvestAmount <= currentCapital) {
              const position: Position = {
                entryDate: currentDate,
                entryPrice: current.open,
                quantity,
                investAmount: actualInvestAmount,
                confidence: buyOrder.confidence,
                buySignalDate: buyOrder.signalDate,
                highPriceSinceEntry: current.open,
                trailingStopPrice:
                  current.open * (1 - strategyParams.trailingStopPercent),
                entryATR: current.atr,
              };

              positions[stock] = position;
              currentCapital -= actualInvestAmount;

              trades.push({
                stock,
                action: 'buy',
                date: currentDate,
                price: current.open,
                quantity,
                amount: actualInvestAmount,
                buySignalDate: buyOrder.signalDate,
                actualBuyDate: currentDate,
                reason: buyOrder.reason,
                confidence: buyOrder.confidence,
              });

              console.log(
                `🛒 ${dateStr} ${stock} 買入: 價格${current.open.toFixed(2)} | 信心度${(
                  buyOrder.confidence * 100
                ).toFixed(0)}%`,
              );
            }

            delete pendingBuyOrders[stock];
          }
        }

        // 檢查賣出信號
        if (positions[stock]) {
          const sellSignal = this.checkSellSignal(
            current,
            previous,
            positions[stock],
            strategyParams,
          );

          if (sellSignal.signal) {
            const nextTradingDate = this.findNextTradingDay(
              currentDate,
              allStockData,
            );
            pendingSellOrders[stock] = {
              reason: sellSignal.reason,
              signalDate: currentDate,
              targetExecutionDate: nextTradingDate,
              position: positions[stock],
            };

            console.log(
              `🔴 ${dateStr} ${stock} 賣出信號: ${sellSignal.reason}`,
            );
          }
        }

        // 檢查買入信號
        if (!positions[stock] && !pendingBuyOrders[stock]) {
          const buySignal = this.checkBuySignal(
            current,
            previous,
            strategyParams,
          );

          if (
            buySignal.signal &&
            buySignal.confidence! >= strategyParams.confidenceThreshold
          ) {
            const nextTradingDate = this.findNextTradingDay(
              currentDate,
              allStockData,
            );
            pendingBuyOrders[stock] = {
              confidence: buySignal.confidence!,
              reason: buySignal.reason,
              signalDate: currentDate,
              targetExecutionDate: nextTradingDate,
            };

            console.log(
              `🟢 ${dateStr} ${stock} 買入信號: ${buySignal.reason} | 信心度${(
                buySignal.confidence! * 100
              ).toFixed(0)}%`,
            );
          }
        }

        // 更新持倉的追蹤停損價
        if (positions[stock]) {
          const position = positions[stock];
          if (current.high > position.highPriceSinceEntry) {
            position.highPriceSinceEntry = current.high;
            if (strategyParams.enableTrailingStop) {
              const gainSinceEntry =
                (current.high - position.entryPrice) / position.entryPrice;
              if (gainSinceEntry >= strategyParams.trailingActivatePercent) {
                position.trailingStopPrice =
                  position.highPriceSinceEntry *
                  (1 - strategyParams.trailingStopPercent);
              }
            }
          }
        }
      }

      // 記錄權益曲線
      const totalPositionValue = Object.values(positions).reduce((sum, pos) => {
        const stockData =
          allStockData[
            Object.keys(positions).find((s) => positions[s] === pos)!
          ];
        const currentData = stockData.find(
          (d) => d.date.toISOString().split('T')[0] === dateStr,
        );
        return sum + (currentData ? currentData.close * pos.quantity : 0);
      }, 0);

      equityCurve.push({
        date: dateStr,
        value: currentCapital + totalPositionValue,
        cash: currentCapital,
        positions: totalPositionValue,
      });
    }

    // 計算回測結果
    return this.calculateBacktestResults(
      trades,
      equityCurve,
      initialCapital,
      currentCapital,
    );
  }

  /**
   * 從資料庫獲取股票數據
   */
  private async getStockData(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<StockData[]> {
    // 先獲取股票ID
    const stock = await this.databaseService.stock.findUnique({
      where: { symbol },
    });

    if (!stock) {
      throw new Error(`找不到股票代碼: ${symbol}`);
    }

    const rawData = await this.databaseService.dailyPrice.findMany({
      where: {
        stockId: stock.id,
        tradeDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: {
        tradeDate: 'asc',
      },
    });

    return rawData.map((item) => ({
      date: item.tradeDate,
      open: item.open ? parseFloat(item.open.toString()) : 0,
      high: item.high ? parseFloat(item.high.toString()) : 0,
      low: item.low ? parseFloat(item.low.toString()) : 0,
      close: item.close ? parseFloat(item.close.toString()) : 0,
      volume: item.volume ? parseInt(item.volume.toString()) : 0,
      symbol: symbol,
    }));
  }

  /**
   * 計算技術指標
   */
  private calculateIndicators(
    data: StockData[],
    strategyParams: StrategyParams,
  ): StockData[] {
    const result = [...data];

    // RSI 計算
    for (let i = 1; i < result.length; i++) {
      const change = result[i].close - result[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      if (i === strategyParams.rsiPeriod) {
        let avgGain = 0;
        let avgLoss = 0;
        for (let j = 1; j <= strategyParams.rsiPeriod; j++) {
          const pastChange = result[j].close - result[j - 1].close;
          if (pastChange > 0) avgGain += pastChange;
          else avgLoss += -pastChange;
        }
        result[i].avgGain = avgGain / strategyParams.rsiPeriod;
        result[i].avgLoss = avgLoss / strategyParams.rsiPeriod;
      } else if (i > strategyParams.rsiPeriod) {
        const alpha = 1 / strategyParams.rsiPeriod;
        result[i].avgGain =
          (1 - alpha) * (result[i - 1].avgGain || 0) + alpha * gain;
        result[i].avgLoss =
          (1 - alpha) * (result[i - 1].avgLoss || 0) + alpha * loss;
      }

      if (i >= strategyParams.rsiPeriod) {
        const avgGain = result[i].avgGain || 0;
        const avgLoss = result[i].avgLoss || 0;

        if (avgLoss === 0) {
          result[i].rsi = 100;
        } else {
          const rs = avgGain / avgLoss;
          result[i].rsi = 100 - 100 / (1 + rs);
        }

        if (
          isNaN(result[i].rsi!) ||
          result[i].rsi! < 0 ||
          result[i].rsi! > 100
        ) {
          result[i].rsi = i > 0 ? result[i - 1].rsi : 50;
        }
      }
    }

    // MACD 計算
    const fastMultiplier = 2 / (strategyParams.macdFast + 1);
    const slowMultiplier = 2 / (strategyParams.macdSlow + 1);
    const signalMultiplier = 2 / (strategyParams.macdSignal + 1);

    for (let i = 0; i < result.length; i++) {
      if (i === 0) {
        result[i].ema12 = result[i].close;
        result[i].ema26 = result[i].close;
      } else {
        result[i].ema12 =
          (result[i].close - (result[i - 1].ema12 || 0)) * fastMultiplier +
          (result[i - 1].ema12 || 0);
        result[i].ema26 =
          (result[i].close - (result[i - 1].ema26 || 0)) * slowMultiplier +
          (result[i - 1].ema26 || 0);
      }

      if (i >= strategyParams.macdSlow - 1) {
        result[i].macd = (result[i].ema12 || 0) - (result[i].ema26 || 0);

        if (i === strategyParams.macdSlow - 1) {
          result[i].macdSignal = result[i].macd;
        } else {
          result[i].macdSignal =
            (result[i].macd! - (result[i - 1].macdSignal || 0)) *
              signalMultiplier +
            (result[i - 1].macdSignal || 0);
        }

        result[i].macdHistogram = result[i].macd! - result[i].macdSignal!;
      }
    }

    // 移動平均線計算
    for (let i = 0; i < result.length; i++) {
      if (i >= 4) {
        result[i].ma5 =
          result
            .slice(i - 4, i + 1)
            .reduce((sum, item) => sum + item.close, 0) / 5;
      }

      if (i >= 19) {
        result[i].ma20 =
          result
            .slice(i - 19, i + 1)
            .reduce((sum, item) => sum + item.close, 0) / 20;

        result[i].volumeMA20 =
          result
            .slice(i - 19, i + 1)
            .reduce((sum, item) => sum + item.volume, 0) / 20;

        if (result[i].volumeMA20! > 0) {
          result[i].volumeRatio = result[i].volume / result[i].volumeMA20!;
        }
      }

      if (i >= 59 && strategyParams.enableMA60) {
        result[i].ma60 =
          result
            .slice(i - 59, i + 1)
            .reduce((sum, item) => sum + item.close, 0) / 60;
      }

      // ATR 計算
      if (i > 0) {
        const tr = Math.max(
          result[i].high - result[i].low,
          Math.abs(result[i].high - result[i - 1].close),
          Math.abs(result[i].low - result[i - 1].close),
        );

        if (i === strategyParams.atrPeriod) {
          result[i].atr =
            result.slice(1, i + 1).reduce((sum, item, idx) => {
              if (idx === 0) return 0;
              const prevItem = result[idx];
              return (
                sum +
                Math.max(
                  item.high - item.low,
                  Math.abs(item.high - prevItem.close),
                  Math.abs(item.low - prevItem.close),
                )
              );
            }, 0) / strategyParams.atrPeriod;
        } else if (i > strategyParams.atrPeriod) {
          result[i].atr =
            ((result[i - 1].atr || 0) * (strategyParams.atrPeriod - 1) + tr) /
            strategyParams.atrPeriod;
        }
      }

      // 價格動能計算
      if (
        strategyParams.enablePriceMomentum &&
        i >= strategyParams.priceMomentumPeriod
      ) {
        const pastPrice = result[i - strategyParams.priceMomentumPeriod].close;
        result[i].priceMomentum = (result[i].close - pastPrice) / pastPrice;
      }
    }

    return result;
  }

  /**
   * 檢查買入信號
   */
  private checkBuySignal(
    current: StockData,
    previous: StockData,
    strategyParams: StrategyParams,
  ): BuySignalResult {
    if (
      !current.rsi ||
      !current.macd ||
      !current.macdSignal ||
      !current.volumeRatio
    ) {
      return { signal: false, reason: '指標數據不完整' };
    }

    let confidence = 0;
    const reasons: string[] = [];

    // RSI 超賣信號
    if (current.rsi <= strategyParams.rsiOversold) {
      confidence += 0.3;
      reasons.push(`RSI超賣(${current.rsi.toFixed(1)})`);
    }

    // MACD 金叉
    if (
      current.macd > current.macdSignal &&
      previous.macd! <= previous.macdSignal!
    ) {
      confidence += 0.35;
      reasons.push('MACD金叉');
    }

    // 成交量放大
    if (current.volumeRatio >= strategyParams.volumeThreshold) {
      confidence += 0.2;
      reasons.push(`量增(${current.volumeRatio.toFixed(1)}倍)`);
    }

    // 價格動能
    if (
      strategyParams.enablePriceMomentum &&
      current.priceMomentum &&
      current.priceMomentum >= strategyParams.priceMomentumThreshold
    ) {
      confidence += 0.15;
      reasons.push(`動能向上(${(current.priceMomentum * 100).toFixed(1)}%)`);
    }

    const signal = confidence >= strategyParams.confidenceThreshold;
    const reason = reasons.length > 0 ? reasons.join(' + ') : '無明確信號';

    return { signal, reason, confidence };
  }

  /**
   * 檢查賣出信號
   */
  private checkSellSignal(
    current: StockData,
    previous: StockData,
    position: Position,
    strategyParams: StrategyParams,
  ): SellSignalResult {
    const currentProfit =
      (current.close - position.entryPrice) / position.entryPrice;

    // 停損檢查
    if (currentProfit <= -strategyParams.stopLoss) {
      return {
        signal: true,
        reason: `停損(${(currentProfit * 100).toFixed(1)}%)`,
      };
    }

    // 停利檢查
    if (currentProfit >= strategyParams.stopProfit) {
      return {
        signal: true,
        reason: `停利(${(currentProfit * 100).toFixed(1)}%)`,
      };
    }

    // 追蹤停利檢查
    if (
      strategyParams.enableTrailingStop &&
      current.close <= position.trailingStopPrice
    ) {
      return { signal: true, reason: '追蹤停利觸發' };
    }

    // ATR 動態停損檢查
    if (
      strategyParams.enableATRStop &&
      current.atr &&
      position.entryATR &&
      current.close <=
        position.entryPrice - current.atr * strategyParams.atrMultiplier
    ) {
      return { signal: true, reason: 'ATR動態停損' };
    }

    // MACD 死叉
    if (
      current.macd! < current.macdSignal! &&
      previous.macd! >= previous.macdSignal!
    ) {
      const holdingDays = Math.floor(
        (current.date.getTime() - position.entryDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (holdingDays >= strategyParams.minHoldingDays) {
        return { signal: true, reason: 'MACD死叉' };
      }
    }

    return { signal: false, reason: '持續持有' };
  }

  /**
   * 判斷是否為交易日
   */
  private isTradingDay(
    date: Date,
    stockDataMap: Record<string, StockData[]>,
  ): boolean {
    const dateStr = date.toISOString().split('T')[0];
    return Object.values(stockDataMap).some((stockData) =>
      stockData.some(
        (data) => data.date.toISOString().split('T')[0] === dateStr,
      ),
    );
  }

  /**
   * 尋找下一個交易日
   */
  private findNextTradingDay(
    currentDate: Date,
    stockDataMap: Record<string, StockData[]>,
  ): Date | null {
    const maxDaysToCheck = 10;

    for (let i = 1; i <= maxDaysToCheck; i++) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + i);

      if (this.isTradingDay(nextDate, stockDataMap)) {
        return nextDate;
      }
    }

    return null;
  }

  /**
   * 計算回測結果
   */
  private calculateBacktestResults(
    trades: TradeResult[],
    equityCurve: {
      date: string;
      value: number;
      cash: number;
      positions: number;
    }[],
    initialCapital: number,
    finalCapital: number,
  ): BacktestResults {
    // const buyTrades = trades.filter((t) => t.action === 'buy');
    const sellTrades = trades.filter((t) => t.action === 'sell');

    const profits = sellTrades.map((t) => t.profit || 0);
    const winningTrades = profits.filter((p) => p > 0);
    const losingTrades = profits.filter((p) => p <= 0);

    const totalProfit = profits.reduce((sum, p) => sum + p, 0);
    const totalReturn = (finalCapital - initialCapital) / initialCapital;

    // 計算年化報酬率
    const startDate = new Date(equityCurve[0]?.date || new Date());
    const endDate = new Date(
      equityCurve[equityCurve.length - 1]?.date || new Date(),
    );
    const years =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const annualReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

    // 計算各股票表現
    const stockPerformance: {
      stock: string;
      trades: number;
      winRate: number;
      totalProfit: number;
    }[] = [];
    const stockStats: Record<
      string,
      { trades: number; wins: number; profit: number }
    > = {};

    sellTrades.forEach((trade) => {
      if (!stockStats[trade.stock]) {
        stockStats[trade.stock] = { trades: 0, wins: 0, profit: 0 };
      }
      stockStats[trade.stock].trades++;
      if ((trade.profit || 0) > 0) {
        stockStats[trade.stock].wins++;
      }
      stockStats[trade.stock].profit += trade.profit || 0;
    });

    Object.entries(stockStats).forEach(([stock, stats]) => {
      stockPerformance.push({
        stock,
        trades: stats.trades,
        winRate: stats.trades > 0 ? stats.wins / stats.trades : 0,
        totalProfit: stats.profit,
      });
    });

    return {
      performance: {
        initialCapital,
        finalCapital,
        totalReturn,
        annualReturn,
        totalProfit,
      },
      trades: {
        totalTrades: sellTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate:
          sellTrades.length > 0 ? winningTrades.length / sellTrades.length : 0,
        avgWin:
          winningTrades.length > 0
            ? winningTrades.reduce((sum, p) => sum + p, 0) /
              winningTrades.length
            : 0,
        avgLoss:
          losingTrades.length > 0
            ? losingTrades.reduce((sum, p) => sum + p, 0) / losingTrades.length
            : 0,
        maxWin: winningTrades.length > 0 ? Math.max(...winningTrades) : 0,
        maxLoss: losingTrades.length > 0 ? Math.min(...losingTrades) : 0,
        avgHoldingDays:
          sellTrades.reduce((sum, t) => sum + (t.holdingDays || 0), 0) /
            sellTrades.length || 0,
        profitFactor:
          Math.abs(losingTrades.reduce((sum, p) => sum + p, 0)) > 0
            ? winningTrades.reduce((sum, p) => sum + p, 0) /
              Math.abs(losingTrades.reduce((sum, p) => sum + p, 0))
            : 0,
      },
      detailedTrades: trades,
      equityCurve,
      stockPerformance,
    };
  }
}
