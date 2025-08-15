import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { DatabaseModule } from '@database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BacktestController],
  providers: [BacktestService],
  exports: [BacktestService],
})
export class BacktestModule {}
