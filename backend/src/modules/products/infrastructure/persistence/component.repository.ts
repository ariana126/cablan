import { DomainEventDispatcher } from '@framework/application';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Component } from '@products/domain/component.aggregate';
import { ComponentRepository } from '@products/domain/service/component.repository';
import { ComponentName } from '@products/domain/value/component-name.vo';

import { ComponentMapper, ComponentRecord } from './component.mapper';

@Injectable()
export class PrismaComponentRepository
  extends PrismaEntityRepository<Component, ComponentRecord>
  implements ComponentRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<ComponentRecord> {
    return this.txHost.tx.component;
  }

  protected toDomain(record: ComponentRecord): Component {
    return ComponentMapper.toDomain(record);
  }

  protected toPersistence(entity: Component): ComponentRecord {
    return ComponentMapper.toPersistence(entity);
  }

  async findByName(name: ComponentName): Promise<Component | null> {
    const record = await this.txHost.tx.component.findUnique({
      where: { name: name.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(): Promise<Component[]> {
    const records = await this.txHost.tx.component.findMany();
    return records.map((record) => this.toDomain(record));
  }
}
