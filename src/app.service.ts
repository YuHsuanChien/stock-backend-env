import { Inject, Injectable } from '@nestjs/common';
import { StockApiService } from '@core/stock-api/stock-api.service';

@Injectable()
export class AppService {
	@Inject()
	private readonly stockApiService: StockApiService;
}
