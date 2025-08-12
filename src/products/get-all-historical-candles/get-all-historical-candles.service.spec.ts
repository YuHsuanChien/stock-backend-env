import { Test, TestingModule } from '@nestjs/testing';
import { GetAllHistoricalCandlesService } from './get-all-historical-candles.service';

describe('GetAllHistoricalCandlesService', () => {
  let service: GetAllHistoricalCandlesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetAllHistoricalCandlesService],
    }).compile();

    service = module.get<GetAllHistoricalCandlesService>(
      GetAllHistoricalCandlesService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
