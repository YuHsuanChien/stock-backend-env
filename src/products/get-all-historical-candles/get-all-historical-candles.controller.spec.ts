import { Test, TestingModule } from '@nestjs/testing';
import { GetAllHistoricalCandlesController } from './get-all-historical-candles.controller';
import { GetAllHistoricalCandlesService } from './get-all-historical-candles.service';

describe('GetAllHistoricalCandlesController', () => {
  let controller: GetAllHistoricalCandlesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GetAllHistoricalCandlesController],
      providers: [GetAllHistoricalCandlesService],
    }).compile();

    controller = module.get<GetAllHistoricalCandlesController>(GetAllHistoricalCandlesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
