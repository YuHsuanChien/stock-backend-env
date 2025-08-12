import { Inject, Injectable } from '@nestjs/common';
import { StockApiService } from '@core/stock-api/stock-api.service';
import { DatabaseService } from '@database/database.service';

@Injectable()
export class GetAllHistoricalCandlesService {
  @Inject()
  private readonly stockApiService: StockApiService;

  @Inject()
  private readonly databaseService: DatabaseService;

  async findAll() {
    // 獲取所有股票列表
    const stockList = await this.stockApiService.getStockList();
    //寫進db stocks裡
    if (!stockList || stockList.length === 0) {
      console.log('沒有股票資料可供查詢');
      return [];
    } else {
      console.log(`共有 ${stockList.length} 支股票資料`);
      // 清除整張 stock table
      await this.databaseService.stock.deleteMany({});
      // 將股票列表寫入資料庫
      await this.databaseService.stock.createMany({
        data: stockList,
        skipDuplicates: true, // 避免重複插入
      });
      return stockList;
    }
  }

  /**
   * 獲取指定股票的歷史數據(包括開盤價、最高價、最低價、收盤價、成交量等)
   * 富邦指定每次只能抓取一年的資料，因此需要循環查詢每年資料
   * @param id 股票代碼
   * @param startDate 起始日期
   * @param endDate 結束日期
   * @returns { symbol: string; type: string; exchange: string; market: string; data: any[] } | null
   */
  async findOne(id: string, startDate: string, endDate: string) {
    let data: {
      symbol: string;
      type: string;
      exchange: string;
      market: string;
      data: any[];
    } | null = null;

    const nowYear = new Date();
    let currentYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();

    console.log(
      `查詢股票: ${id}, 起始年: ${currentYear}, 結束年: ${endYear}, 現在年: ${nowYear.getFullYear()}`,
    );

    while (currentYear <= nowYear.getFullYear() && currentYear <= endYear) {
      // 計算每次查詢的起訖日
      let yearStartDate = `${currentYear}-01-01`;
      let yearEndDate = `${currentYear}-12-31`;

      if (currentYear === new Date(startDate).getFullYear()) {
        yearStartDate = startDate;
      }
      if (currentYear === new Date(endDate).getFullYear()) {
        yearEndDate = endDate;
      }

      console.log(
        `請求年份: ${currentYear}, 日期區間: ${yearStartDate} ~ ${yearEndDate}`,
      );

      const res = await this.stockApiService.getStockData(
        id,
        yearStartDate,
        yearEndDate,
      );

      if (data && data.data) {
        res.data.forEach((item: any) => {
          data!.data.push(item);
        });
        console.log(
          `年份 ${currentYear} 取得 ${res.data.length} 筆資料，累計 ${data.data.length} 筆`,
        );
      } else {
        data = res;
        console.log(
          `年份 ${currentYear} 初始化資料，取得 ${res.data.length} 筆`,
        );
      }

      currentYear++;
    }

    if (data && data.data.length > 0) {
      data.data.sort((a: any, b: any) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      // 轉換格式
      const symbol = data.symbol;
      const mapped = data.data.map((item: any) => ({
        symbol,
        date: new Date(item.date),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));
      return mapped;
    } else {
      console.log('查無資料');
      return [];
    }
  }
}
