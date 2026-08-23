import { DefaultAdminSeeder } from '@identity/infrastructure/bootstrap/default-admin-seeder';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  await app.listen(process.env.APP_PORT ?? 3000);
  // Deliberately after `listen()`, not an `OnApplicationBootstrap` hook: that
  // fires on `app.init()` too, which `generate-swagger.ts` calls without a
  // database behind it. See `DefaultAdminSeeder`'s own comment.
  await app.get(DefaultAdminSeeder).seed();
}
void bootstrap();
