import { DomainEventDispatcher } from '@framework/application';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { UserRepository } from '@identity/domain/service/user.repository';
import { User } from '@identity/domain/user.aggregate';
import { Username } from '@identity/domain/value/username.vo';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { User as PrismaUser } from '@prisma/client';

import { UserMapper } from './user.mapper';

@Injectable()
export class PrismaUserRepository
  extends PrismaEntityRepository<User, PrismaUser>
  implements UserRepository
{
  constructor(
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<PrismaUser> {
    return this.txHost.tx.user;
  }

  protected toDomain(record: PrismaUser): User {
    return UserMapper.toDomain(record);
  }

  protected toPersistence(entity: User): PrismaUser {
    return UserMapper.toPersistence(entity);
  }

  async findByUsername(username: Username): Promise<User | null> {
    const record = await this.txHost.tx.user.findFirst({
      where: { username: username.asString(), isDeleted: false },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(): Promise<User[]> {
    const records = await this.txHost.tx.user.findMany({
      where: { isDeleted: false },
    });
    return records.map((record) => this.toDomain(record));
  }
}
