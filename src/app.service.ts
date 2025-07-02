import { Inject, Injectable } from '@nestjs/common';
import { StockApiService } from './core/stock-api/stock-api.service';

@Injectable()
export class AppService {
	@Inject()
	private readonly stockApiService: StockApiService;

	getStockData(): any {
		return this.stockApiService.getStockData('0050', '2022-02-09', '2023-02-08');
	}
}
