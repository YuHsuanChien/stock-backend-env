import { Test, TestingModule } from '@nestjs/testing';
import { StockApiService } from './stock-api.service';

describe('StockApiService', () => {
  let service: StockApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockApiService],
    }).compile();

    service = module.get<StockApiService>(StockApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
