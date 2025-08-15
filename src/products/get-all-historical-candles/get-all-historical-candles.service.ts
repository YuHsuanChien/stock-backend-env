import { Inject, Injectable } from '@nestjs/common';
import { StockListService } from '@core/stock/stock-list.service';
import { StockPriceService } from '@core/stock/stock-price.service';
import { ProcessingStatusService } from '@core/stock/processing-status.service';
import { DatabaseService } from '@database/database.service';
import { SnapshotService } from '@core/stock/snapshot.service';

/**
 * 獲取所有股票歷史K線數據服務
 * 負責協調股票清單和價格數據的批次處理
 *
 * 功能包括：
 * 1. 更新股票清單到資料庫
 * 2. 批次處理股票歷史價格數據
 * 3. 管理處理狀態和進度追蹤
 * 4. 提供處理狀態查詢接口
 */
@Injectable()
export class GetAllHistoricalCandlesService {
  // 批次處理設定
  private readonly BATCH_SIZE = 5; // 每批次處理5支股票
  private readonly BATCH_DELAY = 75000; // 批次間隔時間 (75秒)
  private readonly DEFAULT_START_DATE = '2015-01-01'; // 預設起始日期
  @Inject()
  private readonly processingStatusService: ProcessingStatusService;
  @Inject()
  private readonly stockPriceService: StockPriceService;
  @Inject()
  private readonly databaseService: DatabaseService;
  @Inject()
  private readonly stockListService: StockListService;
  @Inject()
  private readonly snapshotService: SnapshotService;

  /**
   * 獲取並處理所有股票歷史數據
   * 主要流程：
   * 1. 更新股票清單到資料庫
   * 2. 取得所有股票代碼
   * 3. 初始化處理狀態
   * 4. 開始背景批次處理
   * @returns Promise<object> 處理請求接受回應
   */
  async createAll() {
    try {
      // 更新股票清單到資料庫
      await this.stockListService.updateStockListInDatabase();

      // 查詢所有股票代碼
      const stockSymbols = await this.databaseService.stock.findMany({
        select: { symbol: true },
      });

      const stockSymbolsArray = stockSymbols.map((stock) => stock.symbol);

      if (stockSymbolsArray.length === 0) {
        console.log('沒有股票資料可供查詢');
        return {
          statusCode: 404,
          message: '沒有股票資料可供查詢',
          data: [],
        };
      }

      console.log(`共有 ${stockSymbolsArray.length} 支股票資料`);

      // 初始化處理狀態
      this.processingStatusService.initializeProcessing(
        stockSymbolsArray.length,
        this.BATCH_SIZE,
      );

      // 開始非同步背景處理
      this.processStockDataSequentially(stockSymbolsArray);

      // 立即回傳 202 Accepted
      return {
        statusCode: 202,
        message: '資料處理請求已接受，正在背景處理中',
        data: {
          totalStocks: stockSymbolsArray.length,
          estimatedProcessingTime: `約 ${Math.ceil(stockSymbolsArray.length / this.BATCH_SIZE) * 2.17} 分鐘`,
          status: 'processing',
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('初始化處理失敗:', errorMessage);
      this.processingStatusService.markFailed(errorMessage);

      return {
        statusCode: 500,
        message: '處理初始化失敗',
        error: errorMessage,
      };
    }
  }

  /**
   * 順序處理股票資料
   * 使用批次處理來避免 API 頻率限制
   * @param stockSymbolsArray 股票代碼陣列
   */
  private async processStockDataSequentially(stockSymbolsArray: string[]) {
    try {
      for (let i = 0; i < stockSymbolsArray.length; i += this.BATCH_SIZE) {
        const batch = stockSymbolsArray.slice(i, i + this.BATCH_SIZE);
        const currentBatch = Math.floor(i / this.BATCH_SIZE) + 1;

        // 更新批次進度
        this.processingStatusService.updateBatchProgress(
          currentBatch,
          `正在處理第 ${currentBatch} 批次`,
        );

        // 並行處理當前批次的股票
        const promises = batch.map((symbol) =>
          this.stockPriceService.fetchAndSaveStockHistory(
            symbol,
            this.DEFAULT_START_DATE,
            new Date().toISOString().split('T')[0],
          ),
        );

        // 等待當前批次完成
        await Promise.all(promises);

        const status = this.processingStatusService.getStatus();
        console.log(
          `已完成第 ${status.currentBatch} 批次，共 ${status.totalBatches} 批次`,
        );

        // 如果不是最後一批，等待一段時間再處理下一批
        if (i + this.BATCH_SIZE < stockSymbolsArray.length) {
          console.log('等待 1 分 15 秒後處理下一批次...');
          await this.delay(this.BATCH_DELAY);
        }
      }

      // 處理完成
      this.processingStatusService.markCompleted('所有股票歷史資料處理完成');
      console.log('所有股票歷史資料處理完成');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.processingStatusService.markFailed(errorMessage);
      console.error('處理股票資料時發生錯誤:', error);
    }
  }

  /**
   * 獲取處理狀態
   * @returns 處理狀態的標準回應格式
   */
  getProcessingStatus() {
    return this.processingStatusService.getStatusResponse();
  }

  /**
   * 獲取指定股票的歷史數據(包括開盤價、最高價、最低價、收盤價、成交量等)
   * 富邦指定每次只能抓取一年的資料，因此需要循環查詢每年資料
   * 此方法已重構到 StockPriceService，保留此方法用於向後兼容
   * @param id 股票代碼
   * @param startDate 起始日期
   * @param endDate 結束日期
   * @returns Promise<any> 股票歷史數據 | null
   */
  async createOne(id: string, startDate: string, endDate: string) {
    // console.warn(
    //   'findOne 方法已棄用，建議使用 StockPriceService.fetchAndSaveStockHistory',
    // );
    return this.stockPriceService.fetchAndSaveStockHistory(
      id,
      startDate,
      endDate,
    );
  }

  /**
   * 延遲執行的輔助方法
   * @param ms 延遲毫秒數
   * @returns Promise<void>
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 更新所有股票快照，把當日交易資料寫進資料庫
   * @returns
   */
  async updateByDate() {
    return await this.snapshotService.updateByDate();
  }

  /**
   * 查詢單隻股票的全歷史K線資料
   */
  async findOne(id: string) {
    return await this.stockPriceService.fetchStockHistory(id);
  }

  /**
   * 查詢單隻股票的期間歷史K線資料
   */
  async findOneDuration(id: string, startDate: string, endDate: string) {
    return await this.stockPriceService.fetchStockDurationHistory(
      id,
      startDate,
      endDate,
    );
  }

  /**
   * 查詢所有票清單
   */
  findAllList() {
    return this.databaseService.stock.findMany({
      select: {
        symbol: true,
      },
    });
  }
}
