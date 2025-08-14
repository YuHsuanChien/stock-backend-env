import { Inject, Injectable } from '@nestjs/common';
import { FubonSDK } from 'fubon-neo';
import { ConfigService } from '@nestjs/config';

/**
 * 股票 API 服務
 * 負責與富邦 SDK 的交互，提供純粹的 API 調用功能
 */
@Injectable()
export class StockApiService {
  @Inject()
  private readonly configService: ConfigService;

  sdk: FubonSDK;

  /**
   * 模組初始化
   * 載入設定並登入富邦 SDK
   */
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

    this.sdk.initRealtime(); // 建立行情連線
    if (this.sdk || this.sdk.marketdata) {
      console.log('SDK 連線成功');
    } else {
      console.error('SDK 連線失敗，請檢查設定或憑證');
      throw new Error('SDK 連線失敗，請檢查設定或憑證');
    }
  }

  /**
   * 獲取股票歷史價格數據
   * @param symbol 股票代碼
   * @param from 起始日期
   * @param to 結束日期
   * @returns Promise<any> API 回應資料
   */
  async getStockCandles(symbol: string, from: string, to: string) {
    if (!this.sdk?.marketdata) {
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
        `[getStockCandles] ${symbol} 回傳資料:`,
        JSON.stringify(result)?.slice(0, 500),
      );

      return result;
    } catch (error) {
      console.error(`[getStockCandles] ${symbol} 發生錯誤:`, error);
      throw error;
    }
  }

  /**
   * 獲取特定產業和市場的股票清單
   * @param industryCode 產業代碼
   * @param market 市場資訊 { code: string, exchange: string }
   * @returns Promise<any> API 回應資料
   */
  async getStocksByIndustry(
    industryCode: string,
    market: { code: string; exchange: string },
  ) {
    if (!this.sdk?.marketdata) {
      throw new Error('SDK 尚未初始化或 marketdata 不存在');
    }

    const client = this.sdk.marketdata.restClient;
    try {
      const result = await client.stock.intraday.tickers({
        type: 'EQUITY',
        exchange: market.exchange,
        market: market.code,
        industry: industryCode,
      });

      return result;
    } catch (error) {
      console.error(
        `[getStocksByIndustry] 產業 ${industryCode} 市場 ${market.code} 發生錯誤:`,
        error,
      );
      throw error;
    }
  }
}
