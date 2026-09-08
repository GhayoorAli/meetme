-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('active', 'ended');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('host', 'guest');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('waiting', 'admitted', 'denied', 'left');

-- CreateEnum
CREATE TYPE "PermissionStatus" AS ENUM ('none', 'pending', 'approved', 'denied');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" SERIAL NOT NULL,
    "host_id" INTEGER,
    "guest_host_token" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "livekit_room" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'active',
    "waiting_room_enabled" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_participants" (
    "id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "display_name" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'guest',
    "status" "ParticipantStatus" NOT NULL DEFAULT 'waiting',
    "recording_permission" "PermissionStatus" NOT NULL DEFAULT 'none',
    "screen_share_permission" "PermissionStatus" NOT NULL DEFAULT 'none',
    "hand_raised" BOOLEAN NOT NULL DEFAULT false,
    "admit_token" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_guest_host_token_key" ON "meetings"("guest_host_token");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_code_key" ON "meetings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_livekit_room_key" ON "meetings"("livekit_room");

-- CreateIndex
CREATE INDEX "meetings_host_id_status_idx" ON "meetings"("host_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_participants_admit_token_key" ON "meeting_participants"("admit_token");

-- CreateIndex
CREATE INDEX "meeting_participants_meeting_id_status_idx" ON "meeting_participants"("meeting_id", "status");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
