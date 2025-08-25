import { Inject, Injectable } from '@nestjs/common';
import { RunRsiBacktestService } from '../../core/stock/runRsiBacktest.service';
import {
  BacktestResults,
  StrategyParams,
} from '../../interfaces/backtest.interface';

@Injectable()
export class BacktestService {
  @Inject()
  private readonly runRsi: RunRsiBacktestService;

  async runRsiBacktest(
    stocks: string[],
    startDate: string,
    endDate: string,
    initialCapital: number,
    strategyParams: StrategyParams,
  ): Promise<BacktestResults> {
    return await this.runRsi.Backtest(
      stocks,
      startDate,
      endDate,
      initialCapital,
      strategyParams,
    );
  }

  async runWBacktest(
    stocks: string[],
    startDate: string,
    endDate: string,
    initialCapital: number,
    strategyParams: StrategyParams,
  ): Promise<BacktestResults> {
    console.log(11111);
    console.log(stocks, startDate, endDate, initialCapital, strategyParams);
    await Promise.resolve();
    return {
      performance: {
        initialCapital: 0,
        finalCapital: 1,
        totalReturn: 1,
        annualReturn: 1,
        totalProfit: 1,
        maxDrawdown: 1, // 添加缺少的 maxDrawdown 屬性
      },
      trades: {
        totalTrades: 1,
        winningTrades: 1,
        losingTrades: 1,
        winRate: 1,
        avgWin: 1,
        avgLoss: 1,
        maxWin: 1,
        maxLoss: 1,
        avgHoldingDays: 1,
        profitFactor: 1,
      },
      detailedTrades: [],
      equityCurve: {
        date: 'jhjgh',
        value: 1,
        cash: 1,
        positions: 1,
      }[1],
      stockPerformance: {
        stock: 'dfdsf',
        trades: 1,
        winRate: 1,
        totalProfit: 1,
      }[1],
    };
  }
}
