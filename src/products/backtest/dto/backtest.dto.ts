import {
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  IsBoolean,
  IsOptional,
  IsIn,
  ValidateIf,
} from 'class-validator';

export class StrategyParamsDto {
  @IsString()
  @IsIn(['rsi_macd', 'w'], { message: '策略类型必须是 rsi_macd 或 w' })
  strategy: 'rsi_macd' | 'w';

  // === RSI_MACD 策略专用参数 ===
  // 只有当 strategy 为 'rsi_macd' 时才验证这些字段
  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: 'RSI周期必须是数字' })
  rsiPeriod?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: 'RSI超卖线必须是数字' })
  rsiOversold?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: 'MACD快线必须是数字' })
  macdFast?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: 'MACD慢线必须是数字' })
  macdSlow?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: 'MACD信号线必须是数字' })
  macdSignal?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '成交量阈值必须是数字' })
  volumeThreshold?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '成交量限制必须是数字' })
  volumeLimit?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '最大仓位必须是数字' })
  maxPositionSize?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '止损比例必须是数字' })
  stopLoss?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '止盈比例必须是数字' })
  stopProfit?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '信心度阈值必须是数字' })
  confidenceThreshold?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsBoolean({ message: '追踪止盈开关必须是布尔值' })
  enableTrailingStop?: boolean;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '追踪止盈比例必须是数字' })
  trailingStopPercent?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '追踪激活比例必须是数字' })
  trailingActivatePercent?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsBoolean({ message: 'ATR止损开关必须是布尔值' })
  enableATRStop?: boolean;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: 'ATR周期必须是数字' })
  atrPeriod?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: 'ATR倍数必须是数字' })
  atrMultiplier?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '最小持有天数必须是数字' })
  minHoldingDays?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsBoolean({ message: '价格动能开关必须是布尔值' })
  enablePriceMomentum?: boolean;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '价格动能周期必须是数字' })
  priceMomentumPeriod?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '价格动能阈值必须是数字' })
  priceMomentumThreshold?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsBoolean({ message: 'MA60开关必须是布尔值' })
  enableMA60?: boolean;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsNumber({}, { message: '最大总曝险度必须是数字' })
  maxTotalExposure?: number;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsBoolean({ message: 'Python逻辑开关必须是布尔值' })
  usePythonLogic?: boolean;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsBoolean({ message: '层级决策开关必须是布尔值' })
  hierarchicalDecision?: boolean;

  @ValidateIf((o) => o.strategy === 'rsi_macd')
  @IsBoolean({ message: '动态仓位开关必须是布尔值' })
  dynamicPositionSize?: boolean;

  // === W 策略专用参数 ===
  // 只有当 strategy 为 'w' 时才验证这些字段
  // @ValidateIf((o) => o.strategy === 'w')
  // @IsOptional()
  // @IsString({ message: 'W策略参数1必须是字符串' })
  // wCustomParam1?: string;
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
  strategyParams?: StrategyParamsDto;
}
