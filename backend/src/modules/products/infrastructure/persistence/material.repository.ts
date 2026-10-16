import { DomainEventDispatcher } from '@framework/application';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
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
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<MaterialRecord> {
    return this.txHost.tx.material;
  }

  protected toDomain(record: MaterialRecord): Material {
    return MaterialMapper.toDomain(record);
  }

  protected toPersistence(entity: Material): MaterialRecord {
    return MaterialMapper.toPersistence(entity);
  }

  async findByName(name: MaterialName): Promise<Material | null> {
    const record = await this.txHost.tx.material.findUnique({
      where: { name: name.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(): Promise<Material[]> {
    const records = await this.txHost.tx.material.findMany();
    return records.map((record) => this.toDomain(record));
  }
}
