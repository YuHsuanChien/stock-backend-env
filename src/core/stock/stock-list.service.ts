import { Injectable } from '@nestjs/common';
import { StockApiService } from '@core/stock-api/stock-api.service';
import { DatabaseService } from '@database/database.service';

/**
 * 股票基本資訊介面
 */
export interface StockInfo {
  symbol: string;
  companyName: string;
  industry: string;
  industryName: string;
  market: string;
}

/**
 * 股票清單服務
 * 負責處理股票清單的獲取、存儲和管理
 */
@Injectable()
export class StockListService {
  // 所有支援的產業代碼
  private readonly industries = [
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '08',
    '09',
    '10',
    '11',
    '12',
    '14',
    '15',
    '16',
    '17',
    '19',
    '20',
    '21',
    '22',
    '23',
    '24',
    '25',
    '26',
    '27',
    '28',
    '29',
    '30',
    '31',
    '32',
    '33',
    '35',
    '36',
    '37',
    '38',
    '80',
  ];

  // 所有支援的市場
  private readonly markets = [
    { code: 'TSE', name: '上市', exchange: 'TWSE' },
    { code: 'OTC', name: '上櫃', exchange: 'TPEx' },
    { code: 'ESB', name: '興櫃一般板', exchange: 'TPEx' },
    { code: 'TIB', name: '臺灣創新板', exchange: 'TPEx' },
    { code: 'PSB', name: '興櫃戰略新板', exchange: 'TPEx' },
  ];

  constructor(
    private readonly stockApiService: StockApiService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * 獲取所有股票清單
   * 從富邦 API 獲取所有產業別和市場的股票資訊
   * @returns Promise<StockInfo[]> 股票資訊陣列
   */
  async getAllStocks(): Promise<StockInfo[]> {
    const allStocks: StockInfo[] = [];

    // 遍歷所有產業別和市場組合
    for (const industryCode of this.industries) {
      for (const market of this.markets) {
        try {
          console.log(
            `正在獲取產業別 ${industryCode} (${this.getIndustryName(industryCode)}) 在 ${market.name} 的股票資料...`,
          );

          const apiResponse = await this.stockApiService.getStocksByIndustry(
            industryCode,
            market,
          );

          if (apiResponse.data && Array.isArray(apiResponse.data)) {
            apiResponse.data.forEach((stock: any) => {
              allStocks.push({
                symbol: stock.symbol,
                companyName: stock.name,
                industry: industryCode,
                industryName: this.getIndustryName(industryCode),
                market: market.name,
              });
            });

            console.log(
              `產業別 ${industryCode} 在 ${market.name} 獲取到 ${apiResponse.data.length} 支股票`,
            );
          }

          // 避免 API 請求過於頻繁
          await this.delay(100);
        } catch (error) {
          console.error(
            `獲取產業別 ${industryCode} 在 ${market.name} 資料失敗:`,
            error,
          );
        }
      }
    }

    console.log(`總共獲取到 ${allStocks.length} 支股票`);
    return allStocks;
  }

  /**
   * 更新資料庫中的股票清單
   * 清除舊資料並插入最新的股票清單
   * @returns Promise<void>
   */
  async updateStockListInDatabase(): Promise<void> {
    const stockList = await this.getAllStocks();

    if (stockList.length === 0) {
      throw new Error('無法獲取股票清單');
    }

    console.log(`準備更新資料庫，共 ${stockList.length} 支股票`);

    // 由於外鍵關係，必須先清除 dailyPrice 再清除 stock
    await this.databaseService.dailyPrice.deleteMany({});
    await this.databaseService.stock.deleteMany({});

    // 插入新的股票清單
    await this.databaseService.stock.createMany({
      data: stockList,
      skipDuplicates: true,
    });

    console.log('股票清單更新完成');
  }

  /**
   * 根據產業別代碼獲取產業別名稱
   * @param industryCode 產業別代碼
   * @returns string 產業別名稱
   */
  private getIndustryName(industryCode: string): string {
    const industryMap: { [key: string]: string } = {
      '01': '水泥工業',
      '02': '食品工業',
      '03': '塑膠工業',
      '04': '紡織纖維',
      '05': '電機機械',
      '06': '電器電纜',
      '08': '玻璃陶瓷',
      '09': '造紙工業',
      '10': '鋼鐵工業',
      '11': '橡膠工業',
      '12': '汽車工業',
      '14': '建材營造',
      '15': '航運業',
      '16': '觀光餐旅',
      '17': '金融保險',
      '19': '綜合',
      '20': '其他',
      '21': '化學工業',
      '22': '生技醫療業',
      '23': '油電燃氣業',
      '24': '半導體業',
      '25': '電腦及週邊設備業',
      '26': '光電業',
      '27': '通信網路業',
      '28': '電子零組件業',
      '29': '電子通路業',
      '30': '資訊服務業',
      '31': '其他電子業',
      '32': '文化創意業',
      '33': '農業科技業',
      '35': '綠能環保',
      '36': '數位雲端',
      '37': '運動休閒',
      '38': '居家生活',
      '80': '管理股票',
    };

    return industryMap[industryCode] || '未知產業';
  }

  /**
   * 延遲執行的輔助方法
   * 用於避免 API 請求過於頻繁
   * @param ms 延遲毫秒數
   * @returns Promise<void>
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
