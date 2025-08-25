import {
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class RsiStrategyParamsDto {
  @IsString()
  strategy: string;

  @IsNumber()
  rsiPeriod: number;

  @IsNumber()
  rsiOversold: number;

  @IsNumber()
  macdFast: number;

  @IsNumber()
  macdSlow: number;

  @IsNumber()
  macdSignal: number;

  @IsNumber()
  volumeThreshold: number;

  @IsNumber()
  volumeLimit: number;

  @IsNumber()
  maxPositionSize: number;

  @IsNumber()
  stopLoss: number;

  @IsNumber()
  stopProfit: number;

  @IsNumber()
  confidenceThreshold: number;

  @IsBoolean()
  enableTrailingStop: boolean;

  @IsNumber()
  trailingStopPercent: number;

  @IsNumber()
  trailingActivatePercent: number;

  @IsBoolean()
  enableATRStop: boolean;

  @IsNumber()
  atrPeriod: number;

  @IsNumber()
  atrMultiplier: number;

  @IsNumber()
  minHoldingDays: number;

  @IsBoolean()
  enablePriceMomentum: boolean;

  @IsNumber()
  priceMomentumPeriod: number;

  @IsNumber()
  priceMomentumThreshold: number;

  @IsBoolean()
  enableMA60: boolean;

  @IsNumber()
  maxTotalExposure: number;

  @IsBoolean()
  usePythonLogic: boolean;

  @IsBoolean()
  hierarchicalDecision: boolean;

  @IsBoolean()
  dynamicPositionSize: boolean;
}

export class WStrategyParamsDto {
  @IsString()
  strategy: string;
}

export class BacktestRequestDto {
  @IsArray()
  @IsString({ each: true })
  stocks: string[];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  initialCapital: number;

  @IsOptional()
  strategyParams?: RsiStrategyParamsDto | WStrategyParamsDto;
}
