import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { StockApiModule } from '@core/stock-api/stock-api.module';
import bankLogin from './config/bankLogin.config';
import { GetAllHistoricalCandlesModule } from '@products/get-all-historical-candles/get-all-historical-candles.module';

@Module({
  imports: [
    StockApiModule,
    GetAllHistoricalCandlesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [bankLogin],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
