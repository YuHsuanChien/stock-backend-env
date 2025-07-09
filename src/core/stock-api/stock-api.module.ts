import { Global, Module } from '@nestjs/common';
import { StockApiService } from './stock-api.service';
@Global()
@Module({
  providers: [StockApiService],
  exports: [StockApiService],
})
export class StockApiModule {}
