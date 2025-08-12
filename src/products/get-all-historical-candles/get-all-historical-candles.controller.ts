import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { GetAllHistoricalCandlesService } from './get-all-historical-candles.service';

@Controller('historical-candles')
export class GetAllHistoricalCandlesController {
  @Inject()
  private readonly getAllHistoricalCandlesService: GetAllHistoricalCandlesService;

  @Get()
  findAll() {
    return this.getAllHistoricalCandlesService.findAll();
  }

  @Post(':id')
  findOne(
    @Param('id') id: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
  ) {
    return this.getAllHistoricalCandlesService.findOne(id, startDate, endDate);
  }
}
