import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  // `RolesGuard` depends on `UserRoleProvider`, an abstract port with no
  // binding here — the same as `JwtAuthGuard` depending on `Clock` from the
  // separate global `ClockModule`. Whichever module binds `UserRoleProvider`
  // to a concrete implementation must do so globally too, or this
  // constructor fails to resolve; see `identity.module.ts`.
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, JwtModule, RolesGuard],
})
export class AuthModule {}
