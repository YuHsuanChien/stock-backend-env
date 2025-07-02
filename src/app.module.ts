import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StockApiService } from './core/stock-api/stock-api.service';
import { ConfigModule } from '@nestjs/config';
import bankLogin from './config/bankLogin.config';

@Module({
	imports: [ConfigModule.forRoot({
		isGlobal: true,
		load: [bankLogin],
	})],
	controllers: [AppController],
	providers: [AppService, StockApiService],
})
export class AppModule { }
