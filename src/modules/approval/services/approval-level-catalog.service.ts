import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import { ApprovalLevel } from 'src/database/entities/approval-level.entity';

const CACHE_TTL_MS = 60_000;

@Injectable()
export class ApprovalLevelCatalogService {
  private cache: { expiresAt: number; levels: ApprovalLevel[] } | null = null;

  constructor(
    @InjectRepository(ApprovalLevel)
    private readonly approvalLevelRepository: Repository<ApprovalLevel>,
  ) {}

  invalidate(): void {
    this.cache = null;
  }

  async getActiveLevels(manager?: EntityManager): Promise<ApprovalLevel[]> {
    if (manager) {
      return this.loadActiveLevels(manager);
    }

    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.levels;
    }

    const levels = await this.loadActiveLevels(
      this.approvalLevelRepository.manager,
    );
    this.cache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      levels,
    };
    return levels;
  }

  private loadActiveLevels(manager: EntityManager): Promise<ApprovalLevel[]> {
    return manager.getRepository(ApprovalLevel).find({
      where: { isActive: true },
      relations: { role: true },
      order: { level: 'ASC' },
    });
  }
}
