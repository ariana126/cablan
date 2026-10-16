import {
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Material } from '@products/domain/material.aggregate';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { MaterialMapper, MaterialRecord } from './material.mapper';

@Injectable()
export class PrismaMaterialRepository
  extends PrismaEntityRepository<Material, MaterialRecord>
  implements MaterialRepository
{
  constructor(
    private readonly prisma: PrismaService,
    eventBus: EventBus,
  ) {
    super(prisma.material, eventBus);
  }

  protected toDomain(record: MaterialRecord): Material {
    return MaterialMapper.toDomain(record);
  }

  protected toPersistence(entity: Material): MaterialRecord {
    return MaterialMapper.toPersistence(entity);
  }

  async findByName(name: MaterialName): Promise<Material | null> {
    const record = await this.prisma.material.findUnique({
      where: { name: name.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(): Promise<Material[]> {
    const records = await this.prisma.material.findMany();
    return records.map((record) => this.toDomain(record));
  }
}
