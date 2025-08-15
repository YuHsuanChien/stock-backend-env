import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { BacktestRequestDto } from './dto/backtest.dto';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  /**
   * 執行回測
   */
  @Post('run')
  async runBacktest(@Body() request: BacktestRequestDto) {
    try {
      // 設置預設策略參數
      const defaultStrategyParams = {
        rsiPeriod: 14,
        rsiOversold: 35,
        macdFast: 12,
        macdSlow: 26,
        macdSignal: 9,
        volumeThreshold: 1.5,
        maxPositionSize: 0.25,
        stopLoss: 0.06,
        stopProfit: 0.12,
        confidenceThreshold: 0.6,
        enableTrailingStop: true,
        trailingStopPercent: 0.05,
        trailingActivatePercent: 0.03,
        enableATRStop: true,
        atrPeriod: 14,
        atrMultiplier: 2.0,
        minHoldingDays: 5,
        enablePriceMomentum: true,
        priceMomentumPeriod: 5,
        priceMomentumThreshold: 0.03,
        enableMA60: false,
        maxTotalExposure: 0.75,
        usePythonLogic: true,
        hierarchicalDecision: true,
        dynamicPositionSize: true,
      };

      const strategyParams = request.strategyParams || defaultStrategyParams;

      const result = await this.backtestService.runBacktest(
        request.stocks,
        request.startDate,
        request.endDate,
        request.initialCapital,
        strategyParams,
      );

      return {
        statusCode: 200,
        message: '回測執行成功',
        data: result,
      };
    } catch (error) {
      console.error('回測執行失敗:', error);
      throw new HttpException(
        {
          statusCode: 500,
          message: '回測執行失敗',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
