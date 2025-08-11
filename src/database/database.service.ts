import { Global, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
@Global()
@Injectable()
export class DatabaseService extends PrismaClient {
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('PrismaClient initialized successfully');
    } catch (error) {
      console.error('Error during PrismaClient initialization:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
