import { Component } from '@components/domain/component.aggregate';
import { ComponentRepository } from '@components/domain/service/component.repository';
import { ComponentName } from '@components/domain/value/component-name.vo';
import {
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';

import { ComponentMapper, ComponentRecord } from './component.mapper';

@Injectable()
export class PrismaComponentRepository
  extends PrismaEntityRepository<Component, ComponentRecord>
  implements ComponentRepository
{
  constructor(
    private readonly prisma: PrismaService,
    eventBus: EventBus,
  ) {
    super(prisma.component, eventBus);
  }

  protected toDomain(record: ComponentRecord): Component {
    return ComponentMapper.toDomain(record);
  }

  protected toPersistence(entity: Component): ComponentRecord {
    return ComponentMapper.toPersistence(entity);
  }

  async findByName(name: ComponentName): Promise<Component | null> {
    const record = await this.prisma.component.findUnique({
      where: { name: name.asString() },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(): Promise<Component[]> {
    const records = await this.prisma.component.findMany();
    return records.map((record) => this.toDomain(record));
  }
}
