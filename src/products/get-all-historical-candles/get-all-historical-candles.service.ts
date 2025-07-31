import { Inject, Injectable } from '@nestjs/common';
import { StockApiService } from '@core/stock-api/stock-api.service';

@Injectable()
export class GetAllHistoricalCandlesService {
  @Inject()
  private readonly stockApiService: StockApiService;

  async findAll() {
    let data: any[] = [];
    return this.stockApiService.getStockList();
  }

  async findOne(id: string) {
    let data: {
      symbol: string;
      type: string;
      exchange: string;
      market: string;
      data: any[];
    } | null = null;

    let startYear = 2015;
    const nowYear = new Date().getFullYear();

    while (startYear <= nowYear) {
      const startDate = `${startYear}-01-01`;
      const endDate = `${startYear}-12-31`;

      const res = await this.stockApiService.getStockData(
        id,
        startDate,
        endDate,
      );

      if (data && data.data) {
        // 如果已經有 data，就把當年資料加進去
        res.data.forEach((item: any) => {
          data!.data.push(item);
        });
      } else {
        // 初始化第一筆
        data = res;
      }

      startYear++;
    }

    if (data && data.data.length > 0) {
      // 將資料按照時間排序
      data.data.sort((a: any, b: any) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    }

    return data;
  }
}
