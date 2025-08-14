import { Module } from '@nestjs/common';
import { GetAllHistoricalCandlesService } from './get-all-historical-candles.service';
import { GetAllHistoricalCandlesController } from './get-all-historical-candles.controller';
import { StockShareModule } from '@core/stockShare.module';

@Module({
  imports: [StockShareModule],
  controllers: [GetAllHistoricalCandlesController],
  providers: [GetAllHistoricalCandlesService],
})
export class GetAllHistoricalCandlesModule {}
