import { Inject, Injectable } from '@nestjs/common';
import {
  FubonSDK,
  BSAction,
  TimeInForce,
  OrderType,
  PriceType,
  MarketType,
} from 'fubon-neo';
import { ConfigService } from '@nestjs/config';

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
  }

  async getStockData(symbol: string, from: string, to: string) {
    if (!this.sdk || !this.sdk.marketdata) {
      throw new Error('SDK 尚未初始化或 marketdata 不存在');
    }
    const client = this.sdk.marketdata.restClient;
    return await client.stock.historical.candles({
      symbol,
      from,
      to,
      fields: 'open,high,low,close,volume,change',
    });
  }
}
