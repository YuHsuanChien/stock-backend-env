import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { BacktestRequestDto, StrategyParamsDto } from './dto/backtest.dto';
import {
  RsiStrategyParams,
  WStrategyParams,
} from '../../interfaces/backtest.interface';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  /**
   * 執行回測
   */
  @Post('run')
  async runRsiBacktest(@Body() request: BacktestRequestDto) {
    try {
      if (!request.strategyParams) {
        throw new HttpException(
          {
            statusCode: 400,
            message: '策略參數不能為空',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const strategyParams = this.validateAndTransformParams(
        request.strategyParams,
      );

      const result =
        request.strategyParams.strategy === 'rsi_macd'
          ? await this.backtestService.runRsiBacktest(
              request.stocks,
              request.startDate,
              request.endDate,
              request.initialCapital,
              strategyParams as RsiStrategyParams,
            )
          : await this.backtestService.runWBacktest(
              request.stocks,
              request.startDate,
              request.endDate,
              request.initialCapital,
              strategyParams as WStrategyParams,
            );

      return {
        statusCode: 200,
        message: '回測執行成功',
        data: result,
      };
    } catch (error) {
      console.error('回測執行失敗:', error);

      if (error instanceof HttpException) {
        throw error;
      }

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

  /**
   * 驗證並轉換策略參數
   */
  private validateAndTransformParams(params: StrategyParamsDto) {
    if (params.strategy === 'rsi_macd') {
      // 為 RSI_MACD 策略設置默認值
      return {
        strategy: 'rsi_macd' as const,
        rsiPeriod: params.rsiPeriod ?? 14,
        rsiOversold: params.rsiOversold ?? 30,
        macdFast: params.macdFast ?? 12,
        macdSlow: params.macdSlow ?? 26,
        macdSignal: params.macdSignal ?? 9,
        volumeThreshold: params.volumeThreshold ?? 100000,
        volumeLimit: params.volumeLimit ?? 1000000,
        maxPositionSize: params.maxPositionSize ?? 0.1,
        stopLoss: params.stopLoss ?? 0.05,
        stopProfit: params.stopProfit ?? 0.15,
        confidenceThreshold: params.confidenceThreshold ?? 0.7,
        enableTrailingStop: params.enableTrailingStop ?? false,
        trailingStopPercent: params.trailingStopPercent ?? 0.02,
        trailingActivatePercent: params.trailingActivatePercent ?? 0.05,
        enableATRStop: params.enableATRStop ?? false,
        atrPeriod: params.atrPeriod ?? 14,
        atrMultiplier: params.atrMultiplier ?? 2,
        minHoldingDays: params.minHoldingDays ?? 1,
        enablePriceMomentum: params.enablePriceMomentum ?? false,
        priceMomentumPeriod: params.priceMomentumPeriod ?? 10,
        priceMomentumThreshold: params.priceMomentumThreshold ?? 0.02,
        enableMA60: params.enableMA60 ?? false,
        maxTotalExposure: params.maxTotalExposure ?? 1.0,
        usePythonLogic: params.usePythonLogic ?? false,
        hierarchicalDecision: params.hierarchicalDecision ?? false,
        dynamicPositionSize: params.dynamicPositionSize ?? false,
      };
    } else if (params.strategy === 'w_strategy') {
      // 為 w_strategy 策略設置默認值（根據需要添加）
      return {
        strategy: 'w_strategy' as const,
        // 添加 w_strategy 策略的默認參數
      };
    }

    throw new HttpException(
      {
        statusCode: 400,
        message: '不支援的策略類型',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
