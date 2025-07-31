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
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';

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

  async getStockList() {
    let urls = [
      'https://isin.twse.com.tw/isin/C_public.jsp?strMode=2', // 上市證券
      'https://isin.twse.com.tw/isin/C_public.jsp?strMode=4', // 上櫃證券
      'https://isin.twse.com.tw/isin/C_public.jsp?strMode=5', // 興櫃證券
    ];

    let allStocks: any[] = [];

    for (const url of urls) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const text = iconv.decode(Buffer.from(buffer), 'big5');
      /**
       * 使用 cheerio 解析 HTML，因為node.js是後端不會有DOM元素可以操作
       */
      const $ = cheerio.load(text);
      const rows = $('table tbody tr');

      rows.each((i, row) => {
				if(i<2) return; // 跳過前兩行標題行
        const cells = $(row).find('td');
        if (cells.length > 0) {
          const cellText = $(cells[0]).text().trim();
          const [symbol, companyName] = cellText.split(/\s+/); // 依空白分割
          const stock = {
            symbol: symbol,
            companyName: companyName,
            industry: $(cells[4]).text().trim(),
						ipoDate: $(cells[2]).text().trim(),
          };
          allStocks.push(stock);
        }
      });
    }

    return allStocks;
  }
}
