import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Inject,
} from '@nestjs/common';
import { GetAllHistoricalCandlesService } from './get-all-historical-candles.service';

@Controller('historical-candles')
export class GetAllHistoricalCandlesController {
  @Inject()
  private readonly getAllHistoricalCandlesService: GetAllHistoricalCandlesService;

  @Get()
  findAll() {
    return this.getAllHistoricalCandlesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getAllHistoricalCandlesService.findOne(id);
  }
}
