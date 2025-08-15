import { Injectable } from '@nestjs/common';
import { StockApiService } from '@core/stock-api/stock-api.service';
import { DatabaseService } from '@database/database.service';
import { StockPriceData } from '@interfaces/stockInterface';

/**
 * 股票價格服務
 * 負責處理股票歷史價格數據的獲取、驗證和存儲
 */
@Injectable()
export class StockPriceService {
  constructor(
    private readonly stockApiService: StockApiService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * 獲取指定股票的歷史價格數據
   * @param symbol 股票代碼
   * @returns Promise<StockPriceData[]> 股票價格數據陣列
   */
  async fetchStockHistory(symbol: string): Promise<StockPriceData[]> {
    // 查找股票在資料庫中的 ID
    const stockRecord = await this.databaseService.stock.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!stockRecord) {
      console.error(`股票代碼 ${symbol} 在資料庫中不存在`);
      throw new Error(`股票代碼 ${symbol} 在資料庫中不存在`);
    }

    const stockId = stockRecord.id;
    const rawData = await this.databaseService.dailyPrice.findMany({
      where: { stockId },
      select: {
        stockId: true,
        tradeDate: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });

    // 轉換資料類型以符合 StockPriceData 介面
    const data: StockPriceData[] = rawData.map((item) => ({
      stockId: item.stockId,
      tradeDate: item.tradeDate,
      open: item.open ? Number(item.open) : 0,
      high: item.high ? Number(item.high) : 0,
      low: item.low ? Number(item.low) : 0,
      close: item.close ? Number(item.close) : 0,
      volume: item.volume ? Number(item.volume) : 0,
    }));

    if (data.length > 0) {
      console.log(`股票 ${symbol} 成功查詢 ${data.length} 筆歷史數據`);
    } else {
      console.log(`股票 ${symbol} 在指定期間內無可用資料`);
    }

    return data;
  }

  /**
   * 獲取指定股票的歷史價格數據
   * @param symbol 股票代碼
   * @returns Promise<StockPriceData[]> 股票價格數據陣列
   */
  async fetchStockDurationHistory(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<StockPriceData[]> {
    // 查找股票在資料庫中的 ID
    const stockRecord = await this.databaseService.stock.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!stockRecord) {
      console.error(`股票代碼 ${symbol} 在資料庫中不存在`);
      throw new Error(`股票代碼 ${symbol} 在資料庫中不存在`);
    }

    const stockId = stockRecord.id;
    const rawData = await this.databaseService.dailyPrice.findMany({
      where: {
        stockId,
        tradeDate: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      select: {
        stockId: true,
        tradeDate: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });

    // 轉換資料類型以符合 StockPriceData 介面
    const data: StockPriceData[] = rawData.map((item) => ({
      stockId: item.stockId,
      tradeDate: item.tradeDate,
      open: item.open ? Number(item.open) : 0,
      high: item.high ? Number(item.high) : 0,
      low: item.low ? Number(item.low) : 0,
      close: item.close ? Number(item.close) : 0,
      volume: item.volume ? Number(item.volume) : 0,
    }));

    if (data.length > 0) {
      console.log(`股票 ${symbol} 成功查詢 ${data.length} 筆歷史數據`);
    } else {
      console.log(`股票 ${symbol} 在指定期間內無可用資料`);
    }

    return data;
  }

  /**
   * 獲取指定股票的歷史價格數據並存入資料庫
   * 由於富邦 API 限制，每次只能抓取一年的資料，因此需要循環查詢
   * @param symbol 股票代碼
   * @param startDate 起始日期 (YYYY-MM-DD)
   * @param endDate 結束日期 (YYYY-MM-DD)
   * @returns Promise<StockPriceData[]> 股票價格數據陣列
   */
  async fetchAndSaveStockHistory(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<StockPriceData[]> {
    // 查找股票在資料庫中的 ID
    const stockRecord = await this.databaseService.stock.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!stockRecord) {
      console.error(`股票代碼 ${symbol} 在資料庫中不存在`);
      throw new Error(`股票代碼 ${symbol} 在資料庫中不存在`);
    }

    const stockId = stockRecord.id;
    const data = await this.fetchStockDataByYear(
      symbol,
      startDate,
      endDate,
      stockId,
    );

    if (data.length > 0) {
      // 將數據存入資料庫
      await this.databaseService.dailyPrice.createMany({ data });
      console.log(`股票 ${symbol} 成功存入 ${data.length} 筆歷史數據`);
    } else {
      console.log(`股票 ${symbol} 在指定期間內無可用資料`);
    }

    return data;
  }

  /**
   * 按年份獲取股票數據（因富邦 API 限制）
   * 將日期範圍拆分為年份，逐年查詢數據
   * @param symbol 股票代碼
   * @param startDate 起始日期
   * @param endDate 結束日期
   * @param stockId 股票在資料庫中的 ID
   * @returns Promise<StockPriceData[]> 股票價格數據陣列
   */
  private async fetchStockDataByYear(
    symbol: string,
    startDate: string,
    endDate: string,
    stockId: number,
  ): Promise<StockPriceData[]> {
    const data: StockPriceData[] = [];
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    const currentYear = new Date().getFullYear();

    // 逐年查詢數據
    for (let year = startYear; year <= Math.min(endYear, currentYear); year++) {
      // 計算當年的查詢起止日期
      const yearStartDate = this.formatTradeDate(
        year === startYear ? startDate : `${year}-01-01`,
      )!;
      const yearEndDate = this.formatTradeDate(
        year === endYear ? endDate : `${year}-12-31`,
      )!;
      try {
        console.log(`正在查詢股票 ${symbol} ${year} 年的數據...`);

        const apiResponse = await this.stockApiService.getStockCandles(
          symbol,
          yearStartDate,
          yearEndDate,
        );

        if (apiResponse?.data && Array.isArray(apiResponse.data)) {
          for (const item of apiResponse.data) {
            data.push({
              stockId,
              tradeDate: new Date(item.date),
              open: item.open || 0,
              high: item.high || 0,
              low: item.low || 0,
              close: item.close || 0,
              volume: item.volume || 0,
            });
          }
          console.log(
            `股票 ${symbol} ${year} 年獲取到 ${apiResponse.data.length} 筆數據`,
          );
        } else {
          console.log(`股票 ${symbol} ${year} 年無資料或資料格式錯誤`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`股票 ${symbol} ${year} 年查詢失敗:`, errorMessage);
        // 繼續處理下一年，不中斷整個流程
      }
    }

    // 按日期排序確保資料順序正確
    return data.sort(
      (a, b) =>
        new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime(),
    );
  }

  /**
   * 驗證和格式化交易日期
   * 將各種格式的日期字串轉換為 ISO-8601 格式
   * @param dateString 日期字串
   * @returns string | null ISO-8601 格式的日期字串，無效時返回 null
   */
  private formatTradeDate(dateString: any): string | null {
    if (
      !dateString ||
      typeof dateString !== 'string' ||
      dateString.trim() === ''
    ) {
      return null;
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString();
    } catch {
      return null;
    }
  }
}
