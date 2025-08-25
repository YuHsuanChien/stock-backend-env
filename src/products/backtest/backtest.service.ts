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

interface RSIOversoldTracker {
  isOversold: boolean; // 是否曾經超賣
  oversoldDate: Date; // 超賣發生日期
  minRSI: number; // 超賣期間的最低RSI
  waitingForRecovery: boolean; // 是否等待回升中
}

@Injectable()
export class BacktestService {
  @Inject()
  private readonly databaseService: DatabaseService;
  private rsiTrackers: Record<string, RSIOversoldTracker> = {};

  /**
   * 執行回測
   */
  // 🎯 完全複製前端邏輯的後端 runBacktest 實現

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
    > = {}; // 待執行的買入訂單
    const pendingSellOrders: Record<
      string,
      {
        reason: string;
        signalDate: Date;
        targetExecutionDate: Date | null;
        position: Position;
      }
    > = {}; // 待執行的賣出訂單
    const equityCurve: {
      date: string;
      value: number;
      cash: number;
      positions: number;
    }[] = [];

    console.log('🚀 開始獲取股票數據...');

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

    const allDates = [
      ...new Set(
        Object.values(allStockData)
          .flat()
          .map((d) => d.date.toISOString().split('T')[0]),
      ),
    ].sort();

    // 🎯 完全複製前端的主迴圈邏輯
    for (const dateStr of allDates) {
      const currentDate = new Date(dateStr);

      // 使用動態交易日判斷，如果不是則跳過
      if (!this.isTradingDay(currentDate, allStockData)) {
        const dayName = [
          '星期日',
          '星期一',
          '星期二',
          '星期三',
          '星期四',
          '星期五',
          '星期六',
        ][currentDate.getDay()];
        console.log(`📅 跳過非交易日: ${dateStr} (${dayName})`);
        continue;
      }

      for (const stock of validStocks) {
        const stockData = allStockData[stock];
        const currentIndex = stockData.findIndex(
          (d) => d.date.toISOString().split('T')[0] === dateStr,
        );

        // 🔍 檢查是否找到當前日期的數據
        if (currentIndex === -1) {
          console.log(`⚠️ ${dateStr} ${stock} 找不到數據，跳過處理`);
          continue;
        }

        // 確保指標數據已經計算完成（至少需要 MACD 計算完成的天數）
        const minRequiredIndex =
          strategyParams.macdSlow + strategyParams.macdSignal;
        if (currentIndex < minRequiredIndex) continue;

        const current = stockData[currentIndex];
        const previous = stockData[currentIndex - 1];

        // 🔍 重要：驗證日期匹配性，如果不匹配則跳過
        const currentDataDateStr = current.date.toISOString().split('T')[0];
        if (currentDataDateStr !== dateStr) {
          console.log(`❌ ${dateStr} ${stock} 日期不匹配！
          迴圈日期: ${dateStr}
          數據日期: ${currentDataDateStr}
          跳過此股票處理`);
          continue;
        }

        console.log(`✅ ${dateStr} ${stock} 日期匹配確認 - 使用正確數據`);

        // 確認當前數據有完整的技術指標
        if (!current.rsi || !current.macd || !current.macdSignal) {
          console.log(
            `🚫 ${dateStr} ${stock} 指標數據不完整: RSI=${current.rsi}, MACD=${current.macd}, Signal=${current.macdSignal}`,
          );
          continue;
        }

        // 🎯 複製前端邏輯1: 首先處理待執行的賣出訂單（使用T+1日開盤價）
        if (pendingSellOrders[stock]) {
          const sellOrder = pendingSellOrders[stock];

          // 彈性T+1邏輯：目標日期或之後的第一個有資料日執行
          const shouldExecute =
            sellOrder.targetExecutionDate &&
            currentDate >= sellOrder.targetExecutionDate;

          if (shouldExecute) {
            const position = sellOrder.position;

            // 使用開盤價計算賣出
            const sellAmount = current.open * position.quantity * 0.995575; // 修正：扣除0.4425%手續費+交易稅
            const profit = sellAmount - position.investAmount;
            const profitRate = profit / position.investAmount;
            const holdingDays = Math.floor(
              (currentDate.getTime() - position.entryDate.getTime()) /
                (1000 * 60 * 60 * 24),
            );

            // 檢查是否延後執行
            const targetDateStr =
              sellOrder.targetExecutionDate?.toISOString().split('T')[0] ||
              '未設定';
            const isDelayed = targetDateStr !== dateStr;
            const delayInfo = isDelayed
              ? ` (原定${targetDateStr}，延後執行)`
              : '';

            console.log(
              `💰 ${dateStr} ${stock} T+1賣出執行${delayInfo}: 出場價${current.open.toFixed(
                2,
              )} | 獲利率${(profitRate * 100).toFixed(2)}% | 持有${holdingDays}天`,
            );

            // 從原始reason中提取基本原因，移除舊的獲利率資訊
            let baseReason = sellOrder.reason;
            // 移除可能存在的獲利率信息（如"當前獲利: X%"、"獲利: X%"、"虧損: X%"等）
            baseReason = baseReason.replace(
              /，[最高獲利當前虧損]{2,4}:\s*-?\d+\.?\d*%/g,
              '',
            );
            baseReason = baseReason.replace(/，獲利:\s*-?\d+\.?\d*%/g, '');
            baseReason = baseReason.replace(/，虧損:\s*-?\d+\.?\d*%/g, '');

            // 根據實際獲利率添加正確的後綴
            const actualReason =
              profitRate >= 0
                ? `${baseReason}，實際獲利: ${(profitRate * 100).toFixed(2)}%`
                : `${baseReason}，實際虧損: ${(
                    Math.abs(profitRate) * 100
                  ).toFixed(2)}%`;

            trades.push({
              stock,
              action: 'SELL',
              date: currentDate, // T+1賣出執行日期
              price: current.open, // T+1開盤價
              quantity: position.quantity,
              amount: sellAmount,
              entryPrice: position.entryPrice,
              entryDate: position.entryDate,
              holdingDays,
              profit,
              profitRate,
              confidence: position.confidence,
              reason: `${actualReason} (T+1開盤價執行)`,
              // 詳細日期資訊
              buySignalDate: position.buySignalDate, // 原始買進訊號日期
              sellSignalDate: sellOrder.signalDate, // 賣出訊號日期
              actualBuyDate: position.entryDate, // 實際購買日期
              actualSellDate: currentDate, // 實際賣出日期
            });

            currentCapital += sellAmount;
            delete positions[stock];
            delete pendingSellOrders[stock];
          }
        }

        // 🎯 複製前端邏輯2: 然後處理待執行的買入訂單（使用T+1日開盤價）
        if (pendingBuyOrders[stock]) {
          const buyOrder = pendingBuyOrders[stock];

          // 彈性T+1邏輯：目標日期或之後的第一個有資料日執行
          const shouldExecute =
            buyOrder.targetExecutionDate &&
            currentDate >= buyOrder.targetExecutionDate;

          if (shouldExecute) {
            // 優化版：使用動態倉位管理系統
            const currentExposure = this.calculateCurrentExposure(
              positions,
              currentCapital,
              allStockData,
              dateStr,
            );

            const dynamicPositionSize = this.calculateDynamicPositionSize(
              buyOrder.confidence || 0,
              currentExposure,
              strategyParams,
            );

            const investAmount = Math.min(
              currentCapital * dynamicPositionSize,
              currentCapital * strategyParams.maxPositionSize,
            );

            console.log(`💰 ${dateStr} ${stock} T+1執行買入 (開盤價):
            信心度: ${((buyOrder.confidence || 0) * 100).toFixed(1)}%
            當前曝險度: ${(currentExposure * 100).toFixed(1)}%
            動態倉位: ${(dynamicPositionSize * 100).toFixed(1)}%
            投資金額: ${investAmount.toLocaleString()}`);

            if (investAmount > 10000) {
              // 使用開盤價計算
              const quantity = Math.floor(
                investAmount / (current.open * 1.001425),
              );
              const actualInvestAmount = current.open * quantity * 1.001425;

              // 檢查是否延後執行
              const targetDateStr =
                buyOrder.targetExecutionDate?.toISOString().split('T')[0] ||
                '未設定';
              const isDelayed = targetDateStr !== dateStr;
              const delayInfo = isDelayed
                ? ` (原定${targetDateStr}，延後執行)`
                : '';

              console.log(
                `💰 ${dateStr} ${stock} T+1買入執行${delayInfo}: 進場價${current.open.toFixed(
                  2,
                )} | 股數${quantity.toLocaleString()} | 投資${actualInvestAmount.toLocaleString()}`,
              );

              if (actualInvestAmount <= currentCapital) {
                positions[stock] = {
                  entryDate: currentDate, // 實際進場日期（T+1執行日）
                  entryPrice: current.open, // 使用T+1日開盤價
                  quantity,
                  investAmount: actualInvestAmount,
                  confidence: buyOrder.confidence,
                  buySignalDate: buyOrder.signalDate, // 記錄原始訊號日期
                  // 初始化追蹤停利相關欄位
                  highPriceSinceEntry: current.open,
                  trailingStopPrice:
                    current.open * (1 - strategyParams.trailingStopPercent),
                  atrStopPrice: current.atr
                    ? current.open - strategyParams.atrMultiplier * current.atr
                    : undefined,
                  entryATR: current.atr,
                };

                trades.push({
                  stock,
                  action: 'BUY',
                  date: currentDate, // 實際交易日期
                  price: current.open, // T+1開盤價
                  quantity,
                  amount: actualInvestAmount,
                  confidence: buyOrder.confidence,
                  reason: `${buyOrder.reason} (T+1開盤價執行)`,
                  // 詳細日期資訊
                  buySignalDate: buyOrder.signalDate, // 買進訊號日期
                  actualBuyDate: currentDate, // 實際購買日期
                  entryDate: currentDate, // 向後相容
                  entryPrice: current.open, // 向後相容
                });

                currentCapital -= actualInvestAmount;
                console.log(
                  `✅ ${dateStr} ${stock} T+1買入成功: 餘額${currentCapital.toLocaleString()}`,
                );
              }
            } else {
              console.log(
                `💸 ${dateStr} ${stock} T+1投資金額不足最低要求 (${investAmount.toLocaleString()} < 10,000)`,
              );
            }

            // 清除已執行的買入訂單
            delete pendingBuyOrders[stock];
          }
        }

        // 🎯 複製前端邏輯3: 處理賣出信號檢查（產生T+1賣出訂單）
        if (positions[stock] && !pendingSellOrders[stock]) {
          const position = positions[stock];
          const holdingDays = Math.floor(
            (currentDate.getTime() - position.entryDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          const sellCheck = this.checkSellSignal(
            current,
            position,
            holdingDays,
            strategyParams,
          );

          if (sellCheck.signal) {
            // 計算下一個交易日，用於T+1執行
            const nextTradingDay = this.findNextTradingDay(
              currentDate,
              allStockData,
            );

            // 產生T+1賣出訂單
            pendingSellOrders[stock] = {
              reason: sellCheck.reason,
              signalDate: currentDate,
              targetExecutionDate: nextTradingDay, // 記錄目標執行日期
              position: { ...position }, // 複製position避免後續修改影響
            };

            console.log(`📋 ${dateStr} ${stock} 產生T+1賣出訂單:
            信號價格: ${current.close.toFixed(2)}
            原因: ${sellCheck.reason}
            目標執行日: ${
              nextTradingDay?.toISOString().split('T')[0] || '待確定'
            }
            將於下一交易日開盤執行`);
          }
        }

        // 🎯 複製前端邏輯4: 處理買入信號檢查（產生T+1買入訂單）
        if (!positions[stock] && !pendingBuyOrders[stock]) {
          const buyCheck = this.checkBuySignal(
            current,
            previous,
            strategyParams,
            stock,
          );

          if (buyCheck.signal) {
            // 計算下一個交易日，用於T+1執行
            const nextTradingDay = this.findNextTradingDay(
              currentDate,
              allStockData,
            );

            // 產生T+1買入訂單
            pendingBuyOrders[stock] = {
              confidence: buyCheck.confidence || 0,
              reason: buyCheck.reason,
              signalDate: currentDate,
              targetExecutionDate: nextTradingDay, // 記錄目標執行日期
            };

            console.log(`📋 ${dateStr} ${stock} 產生T+1買入訊號:
            信號價格: ${current.close}
            信心度: ${((buyCheck.confidence || 0) * 100).toFixed(1)}%
            原因: ${buyCheck.reason}
            目標執行日: ${
              nextTradingDay?.toISOString().split('T')[0] || '待確定'
            }
            將於下一交易日開盤執行`);
          }
        }

        // 🎯 複製前端邏輯5: 更新持倉的追蹤停損價
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

          // 更新ATR停損價
          if (strategyParams.enableATRStop && current.atr) {
            position.atrStopPrice =
              position.entryPrice - strategyParams.atrMultiplier * current.atr;
          }
        }
      }

      // 🎯 複製前端邏輯6: 記錄權益曲線
      let positionValue = 0;
      for (const [stock, position] of Object.entries(positions)) {
        const stockData = allStockData[stock];
        const currentData = stockData.find(
          (d) => d.date.toISOString().split('T')[0] === dateStr,
        );
        if (currentData) {
          positionValue += currentData.close * position.quantity;
        }
      }

      const totalValue = currentCapital + positionValue;
      equityCurve.push({
        date: dateStr,
        value: totalValue,
        cash: currentCapital,
        positions: positionValue,
      });
    }

    // 記錄回測結束時的待執行訂單（應該很少，因為採用延後執行策略）
    const pendingBuyOrdersCount = Object.keys(pendingBuyOrders).length;
    const pendingSellOrdersCount = Object.keys(pendingSellOrders).length;

    if (pendingBuyOrdersCount > 0) {
      console.log(
        `⚠️ 回測結束時仍有 ${pendingBuyOrdersCount} 個未執行的買入訂單：`,
      );
      Object.entries(pendingBuyOrders).forEach(([stock, order]) => {
        const signalDate = order.signalDate.toISOString().split('T')[0];
        const targetDate =
          order.targetExecutionDate?.toISOString().split('T')[0] || '未設定';
        console.log(
          `   ${stock}: 訊號日期 ${signalDate}, 目標執行日期 ${targetDate} - 原因: 回測期間結束前未找到交易日`,
        );
      });
    }

    if (pendingSellOrdersCount > 0) {
      console.log(
        `⚠️ 回測結束時仍有 ${pendingSellOrdersCount} 個未執行的賣出訂單：`,
      );
      Object.entries(pendingSellOrders).forEach(([stock, order]) => {
        const signalDate = order.signalDate.toISOString().split('T')[0];
        const targetDate =
          order.targetExecutionDate?.toISOString().split('T')[0] || '未設定';
        console.log(
          `   ${stock}: 訊號日期 ${signalDate}, 目標執行日期 ${targetDate} - 原因: 回測期間結束前未找到交易日`,
        );
      });
    }

    // 🎯 複製前端邏輯7: 計算回測結果
    const completedTrades = trades.filter((t) => t.action === 'SELL');
    const winningTrades = completedTrades.filter((t) => (t.profit || 0) > 0);
    const losingTrades = completedTrades.filter((t) => (t.profit || 0) <= 0);

    const finalValue =
      equityCurve.length > 0
        ? equityCurve[equityCurve.length - 1].value
        : initialCapital;
    const totalReturn = (finalValue - initialCapital) / initialCapital;
    const years =
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
      (1000 * 60 * 60 * 24 * 365.25);
    const annualReturn =
      years > 0 ? Math.pow(finalValue / initialCapital, 1 / years) - 1 : 0;

    // 計算最大回撤
    let maxDrawdown = 0;
    let peak = initialCapital;
    for (const point of equityCurve) {
      if (point.value > peak) {
        peak = point.value;
      }
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const resultsData = {
      performance: {
        initialCapital,
        finalCapital: finalValue,
        totalReturn,
        annualReturn,
        totalProfit: finalValue - initialCapital,
        maxDrawdown: maxDrawdown,
      },
      trades: {
        totalTrades: completedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate:
          completedTrades.length > 0
            ? winningTrades.length / completedTrades.length
            : 0,
        avgWin:
          winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + (t.profitRate || 0), 0) /
              winningTrades.length
            : 0,
        avgLoss:
          losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + (t.profitRate || 0), 0) /
              losingTrades.length
            : 0,
        maxWin:
          winningTrades.length > 0
            ? Math.max(...winningTrades.map((t) => t.profitRate || 0))
            : 0,
        maxLoss:
          losingTrades.length > 0
            ? Math.min(...losingTrades.map((t) => t.profitRate || 0))
            : 0,
        avgHoldingDays:
          completedTrades.length > 0
            ? completedTrades.reduce(
                (sum, t) => sum + (t.holdingDays || 0),
                0,
              ) / completedTrades.length
            : 0,
        // 新增獲利因子計算
        profitFactor: (() => {
          const totalGains = winningTrades.reduce(
            (sum, t) => sum + Math.abs(t.profit || 0),
            0,
          );
          const totalLosses = losingTrades.reduce(
            (sum, t) => sum + Math.abs(t.profit || 0),
            0,
          );
          return totalLosses > 0
            ? totalGains / totalLosses
            : totalGains > 0
              ? 999
              : 0;
        })(),
      },
      detailedTrades: completedTrades,
      equityCurve,
      stockPerformance: validStocks.map((stock) => {
        const stockTrades = completedTrades.filter((t) => t.stock === stock);
        const stockWins = stockTrades.filter((t) => (t.profit || 0) > 0);
        return {
          stock,
          trades: stockTrades.length,
          winRate:
            stockTrades.length > 0 ? stockWins.length / stockTrades.length : 0,
          totalProfit: stockTrades.reduce((sum, t) => sum + (t.profit || 0), 0),
        };
      }),
    };

    console.log(`🎉 回測完成！共執行 ${completedTrades.length} 筆交易`);
    console.log('resultsData', resultsData);
    return resultsData;
  }

  /**
   * 從資料庫獲取股票數據
   */
  private async getStockData(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<StockData[]> {
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
   * 計算技術指標 (修正版 - 與前端邏輯完全一致)
   */
  private calculateIndicators(
    data: StockData[],
    strategyParams: StrategyParams,
  ): StockData[] {
    console.log(`🔍 開始計算技術指標，數據筆數: ${data.length}`);
    const result = [...data];

    // ====== RSI 計算 (使用威爾德平滑法，與前端完全一致) ======
    console.log(`📊 開始計算 RSI，週期: ${strategyParams.rsiPeriod}`);
    for (let i = 1; i < result.length; i++) {
      const change = result[i].close - result[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      if (i === strategyParams.rsiPeriod) {
        // 初始值：使用簡單移動平均（威爾德方法）
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
        // 後續使用威爾德平滑法（比標準EMA更穩定）
        const alpha = 1 / strategyParams.rsiPeriod;
        result[i].avgGain =
          (1 - alpha) * (result[i - 1].avgGain || 0) + alpha * gain;
        result[i].avgLoss =
          (1 - alpha) * (result[i - 1].avgLoss || 0) + alpha * loss;
      }

      // 計算 RSI
      if (i >= strategyParams.rsiPeriod) {
        const avgGain = result[i].avgGain || 0;
        const avgLoss = result[i].avgLoss || 0;

        // 避免除零錯誤
        if (avgLoss === 0) {
          result[i].rsi = 100;
        } else {
          const rs = avgGain / avgLoss;
          result[i].rsi = 100 - 100 / (1 + rs);
        }

        // 數據品質檢查
        if (
          isNaN(result[i].rsi!) ||
          result[i].rsi! < 0 ||
          result[i].rsi! > 100
        ) {
          console.warn(`⚠️ RSI 異常值: ${result[i].rsi} at index ${i}`);
          result[i].rsi = i > 0 ? result[i - 1].rsi : 50; // 使用前值或中性值
        }
      }
    }

    // ====== MACD 計算 (與前端邏輯完全一致) ======
    console.log(
      `📈 開始計算 MACD，參數: ${strategyParams.macdFast}/${strategyParams.macdSlow}/${strategyParams.macdSignal}`,
    );
    const fastMultiplier = 2 / (strategyParams.macdFast + 1);
    const slowMultiplier = 2 / (strategyParams.macdSlow + 1);
    const signalMultiplier = 2 / (strategyParams.macdSignal + 1);

    for (let i = 0; i < result.length; i++) {
      if (i === 0) {
        // 初始值
        result[i].ema12 = result[i].close;
        result[i].ema26 = result[i].close;
      } else {
        // EMA 計算公式: EMA = (Close - EMA_prev) * multiplier + EMA_prev
        result[i].ema12 =
          (result[i].close - (result[i - 1].ema12 || 0)) * fastMultiplier +
          (result[i - 1].ema12 || 0);
        result[i].ema26 =
          (result[i].close - (result[i - 1].ema26 || 0)) * slowMultiplier +
          (result[i - 1].ema26 || 0);
      }

      // MACD = EMA12 - EMA26
      if (i >= strategyParams.macdSlow - 1) {
        result[i].macd = (result[i].ema12 || 0) - (result[i].ema26 || 0);

        // 信號線計算 (MACD 的 9 日 EMA)
        if (i === strategyParams.macdSlow - 1) {
          result[i].macdSignal = result[i].macd || 0; // 初始值
        } else if (i > strategyParams.macdSlow - 1) {
          result[i].macdSignal =
            ((result[i].macd || 0) - (result[i - 1].macdSignal || 0)) *
              signalMultiplier +
            (result[i - 1].macdSignal || 0);
        }

        // MACD 柱狀圖
        if (result[i].macdSignal !== undefined) {
          result[i].macdHistogram =
            (result[i].macd || 0) - (result[i].macdSignal || 0);
        }
      }
    }

    // ====== 移動平均線和成交量計算 (與前端一致) ======
    for (let i = 0; i < result.length; i++) {
      // MA5 - 修正：使用 i >= 4 而不是 i >= 5
      if (i >= 4) {
        let sum = 0;
        for (let j = i - 4; j <= i; j++) {
          sum += result[j].close;
        }
        result[i].ma5 = sum / 5;
      }

      // MA20 - 修正：使用 i >= 19 而不是 i >= 20
      if (i >= 19) {
        let sum = 0;
        for (let j = i - 19; j <= i; j++) {
          sum += result[j].close;
        }
        result[i].ma20 = sum / 20;

        // 成交量相關計算
        let volumeSum = 0;
        for (let j = i - 19; j <= i; j++) {
          volumeSum += result[j].volume;
        }
        result[i].volumeMA20 = volumeSum / 20;
        result[i].volumeRatio = result[i].volume / (result[i].volumeMA20 || 1);
      }

      // MA60 (季線) - 修正：使用 i >= 59 而不是 i >= 60
      if (i >= 59 && strategyParams.enableMA60) {
        let sum = 0;
        for (let j = i - 59; j <= i; j++) {
          sum += result[j].close;
        }
        result[i].ma60 = sum / 60;
      }

      // ====== ATR (Average True Range) 計算 ======
      if (i > 0 && strategyParams.enableATRStop) {
        if (i >= strategyParams.atrPeriod) {
          let atrSum = 0;
          for (let j = i - strategyParams.atrPeriod + 1; j <= i; j++) {
            if (j > 0) {
              const tr = Math.max(
                result[j].high - result[j].low,
                Math.abs(result[j].high - result[j - 1].close),
                Math.abs(result[j].low - result[j - 1].close),
              );
              atrSum += tr;
            }
          }
          result[i].atr = atrSum / strategyParams.atrPeriod;
        }
      }

      // ====== 價格動能指標計算 ======
      if (
        i >= strategyParams.priceMomentumPeriod &&
        strategyParams.enablePriceMomentum
      ) {
        const currentPrice = result[i].close;
        const pastPrice = result[i - strategyParams.priceMomentumPeriod].close;
        result[i].priceMomentum = (currentPrice - pastPrice) / pastPrice;
      }
    }

    console.log(
      `✅ 技術指標計算完成，有效數據從第 ${
        strategyParams.macdSlow + strategyParams.macdSignal
      } 天開始`,
    );

    return result;
  }

  /**
   * 檢查買入信號 (正確版本 - 追蹤RSI超賣回升過程)
   */
  private checkBuySignal(
    current: StockData,
    previous: StockData,
    strategyParams: StrategyParams,
    stock: string, // 新增股票代碼參數
  ): BuySignalResult {
    const dateStr = current.date.toISOString().split('T')[0];
    const isPythonMode = strategyParams.usePythonLogic;

    console.log(
      `🔍 ${dateStr} ${stock} 開始${isPythonMode ? 'Python階層' : '標準'}決策分析...`,
    );

    // 第一層：數據完整性檢查
    if (!current.rsi || !current.macd || !current.macdSignal) {
      console.log(
        `🚫 ${dateStr} ${stock} 數據不足: RSI=${current.rsi}, MACD=${current.macd}, Signal=${current.macdSignal}`,
      );
      return { signal: false, reason: '數據不足' };
    }

    const rsi = current.rsi;
    const macd = current.macd;
    const macdSignal = current.macdSignal;
    const volumeRatio = current.volumeRatio || 0;
    const currentVolume = current.volume; // 當日成交量 (股)

    // 🆕 第一.5層：基本成交量檢查 (在 RSI 分析之前先過濾)
    const volumeInLots = currentVolume / 1000; // 轉換為張數 (1張 = 1000股)
    if (volumeInLots < strategyParams.volumeLimit) {
      console.log(
        `🚫 ${dateStr} ${stock} 成交量過低: ${volumeInLots.toFixed(0)}張 < ${strategyParams.volumeLimit}張`,
      );
      return {
        signal: false,
        reason: `成交量過低: ${volumeInLots.toFixed(0)}張 < ${strategyParams.volumeLimit}張`,
      };
    }

    console.log(
      `✅ ${dateStr} ${stock} 成交量符合要求: ${volumeInLots.toFixed(0)}張 >= ${strategyParams.volumeLimit}張`,
    );

    // 初始化追蹤器
    if (!this.rsiTrackers[stock]) {
      this.rsiTrackers[stock] = {
        isOversold: false,
        oversoldDate: new Date(),
        minRSI: 100,
        waitingForRecovery: false,
      };
    }

    const tracker = this.rsiTrackers[stock];

    console.log(
      `📊 ${dateStr} ${stock} RSI: ${rsi.toFixed(2)}, 追蹤狀態: ${
        tracker.waitingForRecovery ? '等待回升中' : '正常監控'
      }`,
    );

    // 🎯 核心邏輯：RSI 超賣回升追蹤
    if (rsi < 30) {
      // 進入或維持超賣狀態
      if (!tracker.isOversold) {
        // 首次進入超賣
        tracker.isOversold = true;
        tracker.oversoldDate = current.date;
        tracker.minRSI = rsi;
        tracker.waitingForRecovery = false;

        console.log(
          `📉 ${dateStr} ${stock} 進入超賣狀態: RSI=${rsi.toFixed(2)}`,
        );
      } else {
        // 更新最低RSI
        if (rsi < tracker.minRSI) {
          tracker.minRSI = rsi;
        }
        console.log(
          `📉 ${dateStr} ${stock} 持續超賣: RSI=${rsi.toFixed(2)}, 最低=${tracker.minRSI.toFixed(2)}`,
        );
      }

      return {
        signal: false,
        reason: `RSI超賣中: ${rsi.toFixed(2)}, 等待回升至30以上`,
      };
    }

    // RSI >= 30，檢查是否為回升信號
    if (tracker.isOversold && rsi >= 30) {
      // 從超賣狀態回升！
      if (!tracker.waitingForRecovery) {
        tracker.waitingForRecovery = true;
        console.log(
          `📈 ${dateStr} ${stock} RSI回升確認！從最低${tracker.minRSI.toFixed(2)}回升至${rsi.toFixed(2)}`,
        );
      }

      // 檢查是否在理想買點區間
      const upperLimit = isPythonMode ? 40 : strategyParams.rsiOversold; // Python模式40，標準模式35

      if (rsi > upperLimit) {
        console.log(
          `🚫 ${dateStr} ${stock} RSI回升過頭: ${rsi.toFixed(2)} > ${upperLimit}，錯過買點`,
        );

        // 重置追蹤器，等待下一次超賣
        this.resetRSITracker(stock);

        return {
          signal: false,
          reason: `RSI回升過頭: ${rsi.toFixed(2)} > ${upperLimit}，錯過買點`,
        };
      }

      console.log(
        `✅ ${dateStr} ${stock} RSI在理想買點區間: ${rsi.toFixed(2)} (30-${upperLimit})`,
      );

      // 繼續其他技術指標檢查...
    } else if (!tracker.isOversold) {
      // 從未超賣過，不符合買入條件
      console.log(
        `🚫 ${dateStr} ${stock} RSI=${rsi.toFixed(2)}，但未曾進入超賣狀態`,
      );
      return {
        signal: false,
        reason: `RSI=${rsi.toFixed(2)}，但未曾進入超賣狀態，等待超賣機會`,
      };
    } else {
      // 曾經超賣但還沒回升到30
      console.log(
        `🚫 ${dateStr} ${stock} 等待RSI回升中: ${rsi.toFixed(2)} < 30`,
      );
      return {
        signal: false,
        reason: `等待RSI從超賣回升: ${rsi.toFixed(2)} < 30`,
      };
    }

    // 📋 執行到這裡表示：RSI已從超賣回升且在理想區間，繼續其他檢查

    // 第二層：RSI 回升趨勢確認
    if (!previous || rsi <= (previous.rsi || 0)) {
      console.log(
        `🚫 ${dateStr} ${stock} RSI回升力度不足: ${rsi.toFixed(2)} <= ${previous?.rsi?.toFixed(2) || 'N/A'}`,
      );
      return { signal: false, reason: 'RSI回升力度不足' };
    }

    // 第三層：MACD 黃金交叉確認
    if (macd <= macdSignal) {
      console.log(
        `🚫 ${dateStr} ${stock} MACD未黃金交叉: ${macd.toFixed(4)} <= ${macdSignal.toFixed(4)}`,
      );
      return { signal: false, reason: 'MACD未黃金交叉' };
    }

    // MACD 交叉強度檢查（Python模式額外條件）
    if (isPythonMode) {
      const macdHistogram = current.macdHistogram || 0;
      if (macdHistogram <= 0) {
        console.log(
          `🚫 ${dateStr} ${stock} Python模式 - MACD柱狀圖未轉正: ${macdHistogram.toFixed(4)}`,
        );
        return { signal: false, reason: 'MACD柱狀圖未轉正' };
      }
    }

    // 第四層：成交量確認
    if (volumeRatio < strategyParams.volumeThreshold) {
      console.log(
        `🚫 ${dateStr} ${stock} 成交量不足: ${volumeRatio.toFixed(2)} < ${strategyParams.volumeThreshold}`,
      );
      return { signal: false, reason: '成交量不足' };
    }

    // 第五層：K線型態確認
    if (current.close <= current.open) {
      console.log(
        `🚫 ${dateStr} ${stock} 收黑K線: Close=${current.close} <= Open=${current.open}`,
      );
      return { signal: false, reason: '收黑K線' };
    }

    // 第六層：價格動能確認（Python額外條件）
    if (
      strategyParams.enablePriceMomentum &&
      current.priceMomentum !== undefined
    ) {
      if (isPythonMode && current.priceMomentum < 0) {
        console.log(
          `🚫 ${dateStr} ${stock} Python模式 - 價格動能為負: ${(current.priceMomentum * 100).toFixed(2)}%`,
        );
        return { signal: false, reason: '價格動能為負' };
      }
    }

    // 第七層：均線趨勢確認（可選）
    if (strategyParams.enableMA60 && current.ma60) {
      const close = current.close;
      const ma20 = current.ma20 || 0;
      const ma60 = current.ma60;

      if (isPythonMode) {
        if (close < ma60) {
          console.log(
            `🚫 ${dateStr} ${stock} Python模式 - 股價低於季線: ${close} < ${ma60.toFixed(2)}`,
          );
          return { signal: false, reason: '股價低於季線' };
        }
      } else {
        if (close < ma20) {
          console.log(
            `🚫 ${dateStr} ${stock} 標準模式 - 股價低於月線: ${close} < ${ma20.toFixed(2)}`,
          );
          return { signal: false, reason: '股價低於月線' };
        }
      }
    }

    // 第八層：信心度評估
    const confidence = this.calculateConfidence(
      current,
      strategyParams,
      previous,
    );
    const confidenceThreshold = strategyParams.confidenceThreshold;

    if (confidence < confidenceThreshold) {
      console.log(
        `🚫 ${dateStr} ${stock} 信心度不足: ${(confidence * 100).toFixed(1)}% < ${(
          confidenceThreshold * 100
        ).toFixed(1)}%`,
      );
      return {
        signal: false,
        reason: `信心度不足: ${(confidence * 100).toFixed(1)}% < ${(
          confidenceThreshold * 100
        ).toFixed(1)}%`,
      };
    }

    // 🎉 通過所有檢查！產生買入信號並重置追蹤器
    const recoveryDays = Math.floor(
      (current.date.getTime() - tracker.oversoldDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    console.log(
      `✅ ${dateStr} ${stock} 買入信號確認！
    RSI從超賣${tracker.minRSI.toFixed(2)}回升至${rsi.toFixed(2)}
    回升耗時: ${recoveryDays}天
    MACD: ${macd.toFixed(4)} > ${macdSignal.toFixed(4)}
    量比: ${volumeRatio.toFixed(2)}
    信心度: ${(confidence * 100).toFixed(1)}%`,
    );

    // 重置追蹤器，準備下一輪
    this.resetRSITracker(stock);

    return {
      signal: true,
      reason: `RSI從超賣${tracker.minRSI.toFixed(2)}回升至${rsi.toFixed(2)}(${recoveryDays}天)，信心度: ${(
        confidence * 100
      ).toFixed(1)}%`,
      confidence,
    };
  }

  /**
   * 重置 RSI 追蹤器
   */
  private resetRSITracker(stock: string): void {
    this.rsiTrackers[stock] = {
      isOversold: false,
      oversoldDate: new Date(),
      minRSI: 100,
      waitingForRecovery: false,
    };
    console.log(`🔄 ${stock} RSI追蹤器已重置`);
  }

  /**
   * 買入信心度計算器 (與前端邏輯完全一致)
   */
  private calculateConfidence(
    current: StockData,
    strategyParams: StrategyParams,
    previous?: StockData,
  ): number {
    // Python 風格：較低的起始信心度，透過嚴格評估提升
    let confidence = strategyParams.usePythonLogic ? 0.3 : 0.45;

    console.log(
      `🧮 開始計算信心度，Python模式: ${strategyParams.usePythonLogic}`,
    );

    // RSI 深度分析（Python 風格更嚴格）
    const rsi = current.rsi || 0;
    if (strategyParams.usePythonLogic) {
      // Python 階層決策：更嚴格的 RSI 評分
      if (rsi < 20) {
        confidence += 0.35; // 極度超賣，高度看多
      } else if (rsi < 25) {
        confidence += 0.3; // 深度超賣
      } else if (rsi < 30) {
        confidence += 0.25; // 標準超賣
      } else if (rsi < 35) {
        confidence += 0.15; // 輕度超賣
      } else {
        // RSI > 35，Python 模式下直接降低信心度
        confidence -= 0.1;
      }
    } else {
      // 原版較寬鬆的評分
      if (rsi < 25) {
        confidence += 0.25;
      } else if (rsi < 35) {
        confidence += 0.2;
      } else if (rsi < 45) {
        confidence += 0.15;
      }
    }

    // RSI 回升趨勢（兩種模式都支援）
    if (previous && rsi > (previous.rsi || 0)) {
      const rsiImprovement = rsi - (previous.rsi || 0);
      if (rsiImprovement > 3) {
        confidence += 0.15; // 強勢回升
      } else if (rsiImprovement > 1) {
        confidence += 0.1; // 一般回升
      } else {
        confidence += 0.05; // 輕微回升
      }
    }

    // MACD 趨勢確認（Python 風格更注重交叉強度）
    const macd = current.macd || 0;
    const macdSignal = current.macdSignal || 0;
    const macdHisto = current.macdHistogram || 0;

    if (macd > macdSignal) {
      // 檢查是否為新的黃金交叉
      const prevMacd = previous?.macd || 0;
      const prevSignal = previous?.macdSignal || 0;
      const isNewGoldenCross = prevMacd <= prevSignal && macd > macdSignal;

      if (strategyParams.usePythonLogic) {
        if (isNewGoldenCross && macdHisto > 0) {
          confidence += 0.25; // 新黃金交叉且柱狀圖為正
        } else if (isNewGoldenCross) {
          confidence += 0.2; // 新黃金交叉
        } else if (macdHisto > 0) {
          confidence += 0.15; // 持續黃金交叉且強化
        } else {
          confidence += 0.1; // 基本黃金交叉
        }
      } else {
        confidence += 0.15; // 原版固定加分
      }
    }

    // 成交量驗證（Python 風格更高門檻）
    const volumeRatio = current.volumeRatio || 0;
    const volumeThreshold = strategyParams.volumeThreshold;

    if (strategyParams.usePythonLogic) {
      if (volumeRatio > volumeThreshold * 1.5) {
        confidence += 0.15; // 爆量
      } else if (volumeRatio > volumeThreshold) {
        confidence += 0.1; // 量增
      } else {
        confidence -= 0.05; // 量不足扣分
      }
    } else {
      if (volumeRatio > volumeThreshold) {
        confidence += 0.1;
      }
    }

    // 趨勢排列確認
    const close = current.close;
    const ma5 = current.ma5 || 0;
    const ma20 = current.ma20 || 0;
    const ma60 = current.ma60 || 0;
    console.log('current', current);

    if (strategyParams.usePythonLogic) {
      // Python 風格：更注重多頭排列
      if (
        strategyParams.enableMA60 &&
        close > ma5 &&
        ma5 > ma20 &&
        ma20 > ma60
      ) {
        confidence += 0.15; // 完美多頭排列
      } else if (close > ma5 && ma5 > ma20) {
        confidence += 0.12; // 短中期多頭排列
      } else if (close > ma20) {
        confidence += 0.08; // 基本多頭
      } else {
        confidence -= 0.05; // 空頭排列扣分
      }
    } else {
      // 原版評分
      if (close > ma20) {
        confidence += 0.08;
      }
    }

    // 價格動能評估
    const priceMomentum = current.priceMomentum || 0;
    if (strategyParams.enablePriceMomentum) {
      if (priceMomentum > strategyParams.priceMomentumThreshold) {
        confidence += 0.1; // 強勢動能
      } else if (priceMomentum > 0) {
        confidence += 0.05; // 正動能
      } else if (priceMomentum < -strategyParams.priceMomentumThreshold) {
        confidence -= 0.05; // 負動能扣分
      }
    }

    // 最終調整
    const finalConfidence = Math.max(0, Math.min(confidence, 0.95));

    console.log(
      `📊 信心度計算完成: ${(finalConfidence * 100).toFixed(
        1,
      )}% (RSI: ${rsi.toFixed(1)}, MACD: ${macd > macdSignal ? '✅' : '❌'})`,
    );

    return finalConfidence;
  }

  /**
   * 檢查賣出信號 (修正版 - 與前端邏輯一致)
   */
  private checkSellSignal(
    current: StockData,
    position: Position,
    holdingDays: number,
    strategyParams: StrategyParams,
  ): SellSignalResult {
    const currentPrice = current.close;
    const entryPrice = position.entryPrice;
    const profitRate = (currentPrice - entryPrice) / entryPrice;
    const dateStr = current.date.toISOString().split('T')[0];

    // 🔧 更精確的持有天數計算
    const preciseHoldingDays = Math.ceil(
      (current.date.getTime() - position.entryDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    console.log(`🔍 後端 ${dateStr} 持有天數檢查: 
    - 傳入 holdingDays: ${holdingDays}
    - 精確 preciseHoldingDays: ${preciseHoldingDays}
    - 保護期設定: ${strategyParams.minHoldingDays} 天`);

    // 🛡️ 【最高優先級】持有天數保護 - 策略的核心邏輯
    if (preciseHoldingDays <= strategyParams.minHoldingDays) {
      console.log(
        `🛡️ 後端 ${dateStr} 保護期內 (第${preciseHoldingDays}/${strategyParams.minHoldingDays}天)，當前獲利: ${(profitRate * 100).toFixed(2)}%`,
      );

      // 災難性虧損閾值 (stopLoss * 2.0)
      const catastrophicLoss = -strategyParams.stopLoss * 2.0;

      if (profitRate <= catastrophicLoss) {
        console.log(
          `🚨 後端 ${dateStr} 保護期內災難性虧損: ${(profitRate * 100).toFixed(2)}% <= ${(catastrophicLoss * 100).toFixed(1)}%`,
        );
        return {
          signal: true,
          reason: `保護期內災難性虧損出場 (第${preciseHoldingDays}天)，虧損: ${(profitRate * 100).toFixed(2)}%`,
        };
      }

      // 跌停板風險保護
      if (profitRate <= -0.095) {
        console.log(
          `🚨 後端 ${dateStr} 保護期內跌停風險: ${(profitRate * 100).toFixed(2)}%`,
        );
        return {
          signal: true,
          reason: `保護期內跌停風險出場 (第${preciseHoldingDays}天)，虧損: ${(profitRate * 100).toFixed(2)}%`,
        };
      }

      // 🛡️ 核心保護：即使達到基礎停利條件，也要堅持到保護期結束
      if (profitRate >= strategyParams.stopProfit) {
        console.log(
          `🛡️ 後端 ${dateStr} 保護期內達到停利條件 ${(profitRate * 100).toFixed(2)}% - 但策略保護，繼續持有`,
        );
      }

      // 保護期內絕對不出場的原則
      return {
        signal: false,
        reason: `保護期內策略保護 (第${preciseHoldingDays}/${strategyParams.minHoldingDays}天)`,
      };
    }

    // ✅ 保護期結束，執行正常賣出邏輯
    console.log(
      `✅ 後端 ${dateStr} 保護期已過 (第${preciseHoldingDays}天)，執行正常賣出檢查`,
    );

    // 更新進場後最高價 (使用當日最高價)
    if (current.high > position.highPriceSinceEntry) {
      position.highPriceSinceEntry = current.high;
    }

    // 高優先級: 追蹤停利機制
    if (strategyParams.enableTrailingStop) {
      const profitSinceEntry =
        (position.highPriceSinceEntry - entryPrice) / entryPrice;

      if (profitSinceEntry >= strategyParams.trailingActivatePercent) {
        const trailingStopPrice =
          position.highPriceSinceEntry *
          (1 - strategyParams.trailingStopPercent);
        position.trailingStopPrice = trailingStopPrice;

        if (currentPrice <= trailingStopPrice) {
          return {
            signal: true,
            reason: `追蹤停利出場，最高點回落: ${(strategyParams.trailingStopPercent * 100).toFixed(1)}%，最高獲利: ${(profitSinceEntry * 100).toFixed(2)}%`,
          };
        }
      }
    }

    // 中優先級: ATR動態停損
    if (strategyParams.enableATRStop && position.atrStopPrice) {
      if (currentPrice <= position.atrStopPrice) {
        return {
          signal: true,
          reason: `ATR動態停損出場，虧損: ${(profitRate * 100).toFixed(2)}%`,
        };
      }
    }

    // 基礎停利停損 (保護期後才生效)
    if (profitRate >= strategyParams.stopProfit) {
      console.log(
        `🔴 後端 ${dateStr} 基礎停利觸發: ${(profitRate * 100).toFixed(2)}%`,
      );
      return {
        signal: true,
        reason: `固定停利出場，獲利: ${(profitRate * 100).toFixed(2)}%`,
      };
    }

    if (profitRate <= -strategyParams.stopLoss) {
      console.log(
        `🔴 後端 ${dateStr} 基礎停損觸發: ${(profitRate * 100).toFixed(2)}%`,
      );
      return {
        signal: true,
        reason: `固定停損出場，虧損: ${(profitRate * 100).toFixed(2)}%`,
      };
    }

    // 技術指標出場
    if ((current.rsi || 0) > 70) {
      return { signal: true, reason: 'RSI超買出場' };
    }

    if (
      (current.macd || 0) < (current.macdSignal || 0) &&
      (current.macdHistogram || 0) < 0
    ) {
      return { signal: true, reason: 'MACD死亡交叉出場' };
    }

    // 長期持有出場
    if (preciseHoldingDays > 30) {
      return { signal: true, reason: '持有超過30天出場' };
    }

    return { signal: false, reason: '' };
  }

  /**
   * 計算當前總曝險度
   * 根據持倉和當前資本計算
   * @param positions 持倉資訊
   * @param currentCapital 當前資本
   * @param allStockData 所有股票數據
   * @param currentDateStr 當前日期字串
   */
  private calculateCurrentExposure(
    positions: Record<string, Position>,
    currentCapital: number,
    allStockData: Record<string, StockData[]>,
    currentDateStr: string,
  ): number {
    let totalPositionValue = 0;

    for (const [stock, position] of Object.entries(positions)) {
      const stockData = allStockData[stock];
      if (stockData) {
        const currentData = stockData.find(
          (d) => d.date.toISOString().split('T')[0] === currentDateStr,
        );
        if (currentData) {
          totalPositionValue += currentData.close * position.quantity;
        }
      }
    }

    const totalCapital = currentCapital + totalPositionValue;
    const exposure = totalPositionValue / totalCapital;

    console.log(
      `📊 當前曝險度計算: 持倉價值 ${totalPositionValue.toLocaleString()}, 總資本 ${totalCapital.toLocaleString()}, 曝險度: ${(
        exposure * 100
      ).toFixed(1)}%`,
    );

    return exposure;
  }

  /**
   * 動態倉位大小計算器 (Python風格優化版)
   * 根據信心度和當前曝險度動態調整
   */
  private calculateDynamicPositionSize(
    confidence: number,
    currentTotalExposure: number,
    strategyParams: StrategyParams,
  ): number {
    if (!strategyParams.dynamicPositionSize) {
      // 如果未啟用動態倉位，使用固定邏輯
      return confidence > 0.8 ? 0.225 : confidence > 0.65 ? 0.15 : 0.105;
    }

    console.log(
      `💰 開始計算動態倉位 - 信心度: ${(confidence * 100).toFixed(
        1,
      )}%, 當前曝險度: ${(currentTotalExposure * 100).toFixed(1)}%`,
    );

    // Python風格的基礎倉位計算
    const basePosition = 0.15; // 15% 基礎倉位
    let multiplier = 1.0;

    // 根據信心度調整倍數
    if (confidence > 0.8) {
      multiplier = 1.5; // 高信心度
      console.log(`📈 高信心度模式 (>80%)，倍數: ${multiplier}`);
    } else if (confidence > 0.65) {
      multiplier = 1.0; // 中等信心度
      console.log(`📊 中信心度模式 (65-80%)，倍數: ${multiplier}`);
    } else {
      multiplier = 0.7; // 低信心度
      console.log(`📉 低信心度模式 (<65%)，倍數: ${multiplier}`);
    }

    let suggestedPosition = basePosition * multiplier;

    // Python風格風險控制：當總曝險度過高時減少倉位
    if (currentTotalExposure > strategyParams.maxTotalExposure) {
      const riskReduction = 0.5; // 減半
      suggestedPosition *= riskReduction;
      console.log(
        `⚠️ 總曝險度過高 (${(currentTotalExposure * 100).toFixed(1)}% > ${(
          strategyParams.maxTotalExposure * 100
        ).toFixed(1)}%)，倉位減半至: ${(suggestedPosition * 100).toFixed(1)}%`,
      );
    } else if (currentTotalExposure > 0.6) {
      // 當曝險度接近限制時，適度減少倉位
      const riskReduction = 0.75;
      suggestedPosition *= riskReduction;
      console.log(
        `🔶 曝險度偏高 (${(currentTotalExposure * 100).toFixed(
          1,
        )}% > 60%)，倉位調整至: ${(suggestedPosition * 100).toFixed(1)}%`,
      );
    }

    // 最終限制：不能超過單一持股上限
    const finalPosition = Math.min(
      suggestedPosition,
      strategyParams.maxPositionSize,
    );

    console.log(
      `💼 最終倉位決定: ${(finalPosition * 100).toFixed(1)}% (限制: ${(
        strategyParams.maxPositionSize * 100
      ).toFixed(1)}%)`,
    );

    return finalPosition;
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
    const sellTrades = trades.filter((t) => t.action === 'SELL');

    const profits = sellTrades.map((t) => t.profit || 0);
    const profitRates = sellTrades.map((t) => t.profitRate || 0);
    const winningTrades = profits.filter((p) => p > 0);
    const losingTrades = profits.filter((p) => p <= 0);
    const winningRates = profitRates.filter((p) => p > 0);
    const losingRates = profitRates.filter((p) => p <= 0);

    const totalProfit = profits.reduce((sum, p) => sum + p, 0);
    const totalReturn = (finalCapital - initialCapital) / initialCapital;

    // 計算年化報酬率
    const startDate = new Date(equityCurve[0]?.date || new Date());
    const endDate = new Date(
      equityCurve[equityCurve.length - 1]?.date || new Date(),
    );
    const years =
      (endDate.getTime() - startDate.getTime()) /
      (1000 * 60 * 60 * 24 * 365.25);
    const annualReturn =
      years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

    // 計算最大回撤
    let maxDrawdown = 0;
    let peak = initialCapital;
    for (const point of equityCurve) {
      if (point.value > peak) {
        peak = point.value;
      }
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

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

    // 計算獲利因子
    const totalGains = winningTrades.reduce((sum, p) => sum + Math.abs(p), 0);
    const totalLosses = losingTrades.reduce((sum, p) => sum + Math.abs(p), 0);
    const profitFactor =
      totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 999 : 0;

    return {
      performance: {
        initialCapital,
        finalCapital,
        totalReturn,
        annualReturn,
        totalProfit,
        maxDrawdown,
      },
      trades: {
        totalTrades: sellTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate:
          sellTrades.length > 0 ? winningTrades.length / sellTrades.length : 0,
        avgWin:
          winningRates.length > 0
            ? winningRates.reduce((sum, p) => sum + p, 0) / winningRates.length
            : 0,
        avgLoss:
          losingRates.length > 0
            ? losingRates.reduce((sum, p) => sum + p, 0) / losingRates.length
            : 0,
        maxWin: winningRates.length > 0 ? Math.max(...winningRates) : 0,
        maxLoss: losingRates.length > 0 ? Math.min(...losingRates) : 0,
        avgHoldingDays:
          sellTrades.length > 0
            ? sellTrades.reduce((sum, t) => sum + (t.holdingDays || 0), 0) /
              sellTrades.length
            : 0,
        profitFactor,
      },
      detailedTrades: trades,
      equityCurve,
      stockPerformance,
    };
  }
}
