import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import bankLogin from './config/bankLogin.config';
import { GetAllHistoricalCandlesModule } from '@products/get-all-historical-candles/get-all-historical-candles.module';
import { DatabaseModule } from '@database/database.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    GetAllHistoricalCandlesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [bankLogin],
    }),
    DatabaseModule,
    ScheduleModule.forRoot(), //啟用排程功能
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
