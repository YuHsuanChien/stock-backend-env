import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { DatabaseModule } from '@database/database.module';
import { RunRsiBacktestService } from '@core/stock/runRsiBacktest.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BacktestController],
  providers: [BacktestService, RunRsiBacktestService],
  exports: [BacktestService],
})
export class BacktestModule {}
