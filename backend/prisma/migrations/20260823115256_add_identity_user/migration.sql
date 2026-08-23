-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_user_username_idx" ON "app_user"("username");

-- CreateIndex
-- Hand-added: Prisma's schema DSL has no way to express a *partial* unique
-- index, but uniqueness must hold only among active users -- a soft-deleted
-- user's username has to be free to reuse (see the username field's comment
-- in prisma/schema/identity.prisma). This is what actually enforces username
-- uniqueness at the database level; the plain index above is for lookup
-- performance only.
CREATE UNIQUE INDEX "app_user_username_active_key" ON "app_user"("username") WHERE "is_deleted" = false;
