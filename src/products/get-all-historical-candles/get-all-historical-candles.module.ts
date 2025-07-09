import { Module } from '@nestjs/common';
import { GetAllHistoricalCandlesService } from './get-all-historical-candles.service';
import { GetAllHistoricalCandlesController } from './get-all-historical-candles.controller';

@Module({
  controllers: [GetAllHistoricalCandlesController],
  providers: [GetAllHistoricalCandlesService],
})
export class GetAllHistoricalCandlesModule {}
