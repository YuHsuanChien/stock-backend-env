import { Module } from '@nestjs/common';
import { StockListService } from '@core/stock/stock-list.service';
import { StockPriceService } from '@core/stock/stock-price.service';
import { ProcessingStatusService } from '@core/stock/processing-status.service';
import { StockApiService } from '@core/stock-api/stock-api.service';
import { SnapshotService } from '@core/stock/snapshot.service';
import { DatabaseModule } from '@database/database.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [
    StockListService,
    StockPriceService,
    ProcessingStatusService,
    StockApiService,
    SnapshotService,
  ],
  exports: [
    StockListService,
    StockPriceService,
    ProcessingStatusService,
    StockApiService,
    SnapshotService,
  ],
})
export class StockShareModule {}
