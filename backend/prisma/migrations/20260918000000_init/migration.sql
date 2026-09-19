-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "SpinResult" AS ENUM ('gold', 'no_gold');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "display_name" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pot_rounds" (
    "id" TEXT NOT NULL,
    "initial_amount" DECIMAL(65,30) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "final_amount" DECIMAL(65,30),
    "winner_user_id" TEXT,
    "winner_spin_id" TEXT,

    CONSTRAINT "pot_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "game_day" DATE NOT NULL,
    "result" "SpinResult" NOT NULL,
    "rng_algorithm" TEXT NOT NULL,
    "rng_raw_output" BIGINT NOT NULL,
    "rng_threshold" BIGINT NOT NULL,
    "rng_drawn_at" TIMESTAMP(3) NOT NULL,
    "pot_before" DECIMAL(65,30) NOT NULL,
    "pot_after" DECIMAL(65,30) NOT NULL,
    "contribution_amount" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pot_wins" (
    "id" TEXT NOT NULL,
    "spin_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_won" DECIMAL(65,30) NOT NULL,
    "won_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pot_wins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "spin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pot_rounds_winner_spin_id_key" ON "pot_rounds"("winner_spin_id");

-- CreateIndex: one_open_round (indice unico parcial, Prisma no lo expresa nativamente)
-- Garantiza que solo puede existir una fila con ended_at IS NULL a la vez.
CREATE UNIQUE INDEX "one_open_round" ON "pot_rounds" ((true)) WHERE "ended_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "spins_user_id_game_day_key" ON "spins"("user_id", "game_day");

-- CreateIndex
CREATE INDEX "spins_user_id_game_day_idx" ON "spins"("user_id", "game_day");

-- CreateIndex
CREATE INDEX "spins_created_at_idx" ON "spins"("created_at");

-- CreateIndex
CREATE INDEX "spins_round_id_idx" ON "spins"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "pot_wins_spin_id_key" ON "pot_wins"("spin_id");

-- CreateIndex
CREATE INDEX "pot_wins_won_at_idx" ON "pot_wins"("won_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_key" ON "idempotency_keys"("user_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex: one_active_token_per_user (indice unico parcial, Prisma no lo expresa nativamente)
-- Garantiza a lo sumo un token de verificacion activo (no usado) por usuario.
CREATE UNIQUE INDEX "one_active_token_per_user" ON "email_verification_tokens"("user_id") WHERE "used_at" IS NULL;

-- AddForeignKey
ALTER TABLE "pot_rounds" ADD CONSTRAINT "pot_rounds_winner_user_id_fkey" FOREIGN KEY ("winner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spins" ADD CONSTRAINT "spins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spins" ADD CONSTRAINT "spins_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "pot_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (pot_rounds.winner_spin_id -> spins.id; se crea despues de "spins"
-- para evitar el ciclo de dependencia entre pot_rounds y spins en el CREATE TABLE)
ALTER TABLE "pot_rounds" ADD CONSTRAINT "pot_rounds_winner_spin_id_fkey" FOREIGN KEY ("winner_spin_id") REFERENCES "spins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pot_wins" ADD CONSTRAINT "pot_wins_spin_id_fkey" FOREIGN KEY ("spin_id") REFERENCES "spins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pot_wins" ADD CONSTRAINT "pot_wins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_spin_id_fkey" FOREIGN KEY ("spin_id") REFERENCES "spins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
