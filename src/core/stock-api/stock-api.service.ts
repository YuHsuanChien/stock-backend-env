import { Inject, Injectable } from '@nestjs/common';
import { FubonSDK } from 'fubon-neo';
import { ConfigService } from '@nestjs/config';

export interface stockList {
  symbol: string;
  companyName: string;
  industry: string;
  industryName: string;
  market: string;
}

@Injectable()
export class StockApiService {
  @Inject()
  private readonly configService: ConfigService;

  sdk: FubonSDK;

  onModuleInit() {
    const account = this.configService.get<string>('bankLogin.account');
    const password = this.configService.get<string>('bankLogin.password');
    const certPath = this.configService.get<string>('bankLogin.certPath');
    const certPassword = this.configService.get<string>(
      'bankLogin.certPassword',
    );

    // 載入設定檔與登入
    this.sdk = new FubonSDK();
    this.sdk.login(account, password, certPath, certPassword);
    // const accounts = sdk.login("您的身分證號", "您的登入密碼", "您的憑證路徑位置","憑證密碼");  // 若憑證選用＂預設密碼＂, SDK v1.3.2與較新版本適用

    this.sdk.initRealtime(); // 建立行情連線
    if (this.sdk || this.sdk.marketdata) {
      console.log('SDK 連線成功');
    } else {
      console.error('SDK 連線失敗，請檢查設定或憑證');
      throw new Error('SDK 連線失敗，請檢查設定或憑證');
    }
  }

  /**
   * 獲取指定股票的歷史數據(包括開盤價、最高價、最低價、收盤價、成交量等)
   * @param symbol 股票代碼
   * @param from 從什麼時候開始
   * @param to 到什麼時候
   * @returns
   */
  async getStockData(symbol: string, from: string, to: string) {
    if (!this.sdk || !this.sdk.marketdata) {
      throw new Error('SDK 尚未初始化或 marketdata 不存在');
    }
    const client = this.sdk.marketdata.restClient;
    try {
      const result = await client.stock.historical.candles({
        symbol,
        from,
        to,
        fields: 'open,high,low,close,volume,change',
      });
      console.log(
        `[getStockData] 回傳資料:`,
        JSON.stringify(result)?.slice(0, 500),
      ); // 只顯示前500字
      return result;
    } catch (error) {
      console.error(`[getStockData] 發生錯誤:`, error);
      throw error;
    }
  }

  /**
   * 獲取股票列表
   * @returns {Promise<any[]>} 返回股票列表
   */
  async getStockList(): Promise<any[]> {
    const allStocks: Array<stockList> = []; // 改名避免衝突

    if (!this.sdk || !this.sdk.marketdata) {
      throw new Error('SDK 尚未初始化或 marketdata 不存在');
    }

    const industries = [
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

    const markets = [
      { code: 'TSE', name: '上市', exchange: 'TWSE' },
      { code: 'OTC', name: '上櫃', exchange: 'TPEx' },
      { code: 'ESB', name: '興櫃一般板', exchange: 'TPEx' },
      { code: 'PSB', name: '興櫃戰略新板', exchange: 'TPEx' }, // 新增戰略新板
    ];

    const client = this.sdk.marketdata.restClient;

    try {
      // 使用 for...of 迴圈來正確處理非同步操作
      for (const industryCode of industries) {
        for (const market of markets) {
          try {
            console.log(`正在獲取產業別 ${industryCode} 的股票資料...`);

            const apiResponse = await client.stock.intraday.tickers({
              // 改名避免衝突
              type: 'EQUITY',
              exchange: market.exchange, // ← 使用對應的交易所
              market: market.code,
              industry: industryCode,
            });

            if (apiResponse.data && Array.isArray(apiResponse.data)) {
              apiResponse.data.forEach((stock: any) => {
                const stockData = {
                  symbol: stock.symbol,
                  companyName: stock.name, // API 可能返回 name 而不是 companyName
                  industry: industryCode, // 使用查詢的產業代碼
                  industryName: this.getIndustryName(industryCode), // 加入產業名稱
                  market: market.name, // 加入市場名稱
                };
                allStocks.push(stockData); // 推入外層陣列
              });

              console.log(
                `產業別 ${industryCode} 獲取到 ${apiResponse.data.length} 支股票`,
              );
            }

            // 避免 API 請求過於頻繁
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (industryError) {
            console.error(
              `獲取產業別 ${industryCode} 資料失敗:`,
              industryError,
            );
            // 繼續處理下一個產業別
          }
        }
      }

      console.log(`總共獲取到 ${allStocks.length} 支股票`);
      return allStocks;
    } catch (err) {
      console.error(`[getStockList] 發生錯誤:`, err);
      throw err;
    }
  }

  /**
   * 根據產業別代碼獲取產業別名稱
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
}
