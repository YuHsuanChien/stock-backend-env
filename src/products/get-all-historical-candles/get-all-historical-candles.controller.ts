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
  findAll() {
    return this.getAllHistoricalCandlesService.findAll();
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
   * 取得單隻股票的歷史K線資料
   * @param id 股票ID
   * @param startDate 開始日期
   * @param endDate 結束日期
   * @returns
   */
  @Post(':id')
  findOne(
    @Param('id') id: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
  ) {
    console.log(id, startDate, endDate);
    return this.getAllHistoricalCandlesService.findOne(id, startDate, endDate);
  }
}
