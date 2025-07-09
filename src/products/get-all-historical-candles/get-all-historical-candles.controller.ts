import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GetAllHistoricalCandlesService } from './get-all-historical-candles.service';

@Controller('get-all-historical-candles')
export class GetAllHistoricalCandlesController {
  constructor(private readonly getAllHistoricalCandlesService: GetAllHistoricalCandlesService) {}

  @Get()
  findAll() {
    return this.getAllHistoricalCandlesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getAllHistoricalCandlesService.findOne(id);
  }
}
