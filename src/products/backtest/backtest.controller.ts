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
  async runRsiBacktest(@Body() request: BacktestRequestDto) {
    try {
      const strategyParams = request.strategyParams;

      const result =
        request.strategyParams!.strategy == 'rsi_macd'
          ? await this.backtestService.runRsiBacktest(
              request.stocks,
              request.startDate,
              request.endDate,
              request.initialCapital,
              strategyParams!,
            )
          : await this.backtestService.runWBacktest(
              request.stocks,
              request.startDate,
              request.endDate,
              request.initialCapital,
              strategyParams!,
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
