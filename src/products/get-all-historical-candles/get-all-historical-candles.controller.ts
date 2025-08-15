import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { GetAllHistoricalCandlesService } from './get-all-historical-candles.service';

@Controller('historical-candles')
export class GetAllHistoricalCandlesController {
  @Inject()
  private readonly getAllHistoricalCandlesService: GetAllHistoricalCandlesService;

  /**
   * 取得所有股票清單寫進stock table
   * 將所有股票的歷史K線資料寫進dailyPrice table
   * 並回傳處理狀態
   * @returns 回傳處理狀態
   */
  @Get()
  createAll() {
    return this.getAllHistoricalCandlesService.createAll();
  }

  /**
   * 取得所有股票清單
   */
  @Get('stockList')
  findAllList() {
    return this.getAllHistoricalCandlesService.findAllList();
  }

  /**
   * 取得findAll處理狀態
   * @returns 回傳處理狀態
   */
  @Get('status')
  getStatus() {
    return this.getAllHistoricalCandlesService.getProcessingStatus();
  }

  /**
   * 更新所有股票快照，把當日交易資料寫進資料庫
   * @returns 回傳處理狀態
   */
  @Get('snapshot')
  updateByDate() {
    return this.getAllHistoricalCandlesService.updateByDate();
  }

  /**
   * 查詢單隻股票的歷史K線資料
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getAllHistoricalCandlesService.findOne(id);
  }

  /**
   * 寫入單隻股票的歷史K線資料
   * @param id 股票ID
   * @param startDate 開始日期
   * @param endDate 結束日期
   * @returns
   */
  @Post(':id')
  createOne(
    @Param('id') id: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
  ) {
    console.log(id, startDate, endDate);
    return this.getAllHistoricalCandlesService.createOne(
      id,
      startDate,
      endDate,
    );
  }

  /**
   * 查詢單隻股票的期間歷史K線資料
   * @param id 股票ID
   * @param startDate 開始日期
   * @param endDate 結束日期
   * @returns
   */
  @Post('duration/:id')
  findOneDateToDate(
    @Param('id') id: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
  ) {
    return this.getAllHistoricalCandlesService.findOneDuration(
      id,
      startDate,
      endDate,
    );
  }
}
