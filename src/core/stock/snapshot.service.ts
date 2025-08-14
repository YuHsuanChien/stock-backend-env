import { Inject, Injectable } from '@nestjs/common';
import { StockApiService } from '@core/stock-api/stock-api.service';
import { SnapshotData, StockPriceData } from '@interfaces/stockInterface';
import { DatabaseService } from '@database/database.service';
import { Cron } from '@nestjs/schedule';
import { IntradayTicker } from '@interfaces/stockInterface';

@Injectable()
export class SnapshotService {
  @Inject()
  private readonly stockApiService: StockApiService;
  @Inject()
  private readonly databaseService: DatabaseService;
  // 所有支援的市場
  private readonly markets = [
    { code: 'TSE', name: '上市', exchange: 'TWSE' },
    { code: 'OTC', name: '上櫃', exchange: 'TPEx' },
    { code: 'ESB', name: '興櫃一般板', exchange: 'TPEx' },
    { code: 'PSB', name: '興櫃戰略新板', exchange: 'TPEx' },
  ];

  /**
   * 執行排成，每天晚上10點執行更新
   */
  // @Cron('00 22 * * *', {
  //   name: 'updateStockSnapshots',
  //   timeZone: 'Asia/Taipei',
  // })
  // async scheduleUpdateByDate() {
  //   console.log('開始執行每日股票快照更新...');

  //   // 基本的非交易日檢查
  //   if (!(await this.isBasicTradeDay())) {
  //     console.log('今日非交易日，跳過股票快照更新');
  //     return;
  //   }

  //   try {
  //     const result = await this.updateByDate();
  //     console.log(`股票快照更新完成，共處理 ${result.length} 筆資料`);
  //   } catch (error) {
  //     console.error('股票快照更新失敗:', error);
  //   }
  // }

  /**
   * 更新所有股票快照，把當日交易資料寫進資料庫
   * @returns
   */
  async updateByDate() {
    const snapshotArray: SnapshotData[] = [];
    if (this.stockApiService.sdk && this.stockApiService.sdk.marketdata) {
      const client = this.stockApiService.sdk.marketdata.restClient;

      for (const market of this.markets) {
        const snapshot: SnapshotData = await client.stock.snapshot.quotes({
          market: market.code,
        });
        snapshotArray.push(snapshot);
      }
    }
    //將快照資料拿出來整理成pricedaily需要的格式
    const finishData: StockPriceData[] = [];

    if (snapshotArray.length > 0) {
      // 1. 收集所有股票代號
      const allSymbols = new Set<string>();
      snapshotArray.forEach((snapshot) => {
        snapshot.data.forEach((data) => {
          allSymbols.add(data.symbol);
        });
      });

      // 2. 批次查詢所有股票
      const stocks = await this.databaseService.stock.findMany({
        where: {
          symbol: { in: Array.from(allSymbols) },
        },
      });

      // 3. 建立 symbol -> id 的對應表
      const symbolToIdMap = new Map<string, number>();
      stocks.forEach((stock) => {
        symbolToIdMap.set(stock.symbol, stock.id);
      });

      // 4. 處理快照資料
      snapshotArray.forEach((snapshot) => {
        snapshot.data.forEach((data) => {
          const stockId = symbolToIdMap.get(data.symbol);

          if (stockId) {
            const pricedailyData: StockPriceData = {
              stockId: stockId,
              tradeDate: new Date(snapshot.date),
              open: data.openPrice,
              high: data.highPrice,
              low: data.lowPrice,
              close: data.closePrice,
              volume: data.tradeVolume,
            };
            finishData.push(pricedailyData);
          } else {
            console.warn(`Stock not found for symbol: ${data.symbol}`);
          }
        });
      });

      //把最終資料寫進pricedaily table
      await this.databaseService.dailyPrice.createMany({
        data: finishData,
        skipDuplicates: true, // 避免重複插入
      });
    }
    return finishData;
  }

  private async isBasicTradeDay(): Promise<boolean> {
    const testStocks = ['2330', '2317', '3231', '2303', '2338', '2408'];
    const today = new Date().toISOString().split('T')[0];
    const client = this.stockApiService.sdk.marketdata.restClient;

    try {
      const tradeDayChecks = await Promise.all(
        testStocks.map(async (stock) => {
          try {
            const res: IntradayTicker = await client.stock.intraday.ticker({
              symbol: stock,
            });

            // 檢查是否為今日資料
            const isToday = (res.date ?? '') === today;

            // 檢查今天有沒有參考價
            const hasReferencePrice = (res.referencePrice ?? 0) > 0;

            return isToday && hasReferencePrice;
          } catch (error) {
            console.warn(`檢查股票 ${stock} 失敗:`, error);
            return false;
          }
        }),
      );

      // 至少要有一半以上的股票有今日交易資料
      const validChecks = tradeDayChecks.filter(Boolean);
      console.log(
        '今日交易日檢查結果:',
        validChecks.length >= Math.ceil(testStocks.length / 2),
      );
      return validChecks.length >= Math.ceil(testStocks.length / 2);
    } catch (error) {
      console.error('檢查交易日失敗:', error);
      return false;
    }
  }
}
