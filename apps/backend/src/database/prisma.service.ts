import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'query' }, { emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
    });

    // Soft-delete middleware: exclude deleted records from all findMany/findFirst/findUnique
    this.$use(async (params, next) => {
      const modelsWithSoftDelete = ['User'];
      if (modelsWithSoftDelete.includes(params.model ?? '')) {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          params.action = 'findFirst';
          params.args.where = { ...params.args.where, deletedAt: null };
        }
        if (params.action === 'findMany') {
          if (!params.args) params.args = {};
          if (!params.args.where) params.args.where = {};
          params.args.where.deletedAt = null;
        }
      }
      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
