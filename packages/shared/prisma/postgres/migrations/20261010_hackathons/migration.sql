-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 4,
    "criteria" TEXT NOT NULL DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "resultsPublished" BOOLEAN NOT NULL DEFAULT false,
    "hostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonTeam" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HackathonTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HackathonMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonSubmission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "repoUrl" TEXT,
    "demoUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HackathonSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonScore" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HackathonScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hackathon_hostId_idx" ON "Hackathon"("hostId");
CREATE INDEX "Hackathon_startsAt_idx" ON "Hackathon"("startsAt");
CREATE UNIQUE INDEX "HackathonTeam_joinCode_key" ON "HackathonTeam"("joinCode");
CREATE INDEX "HackathonTeam_hackathonId_idx" ON "HackathonTeam"("hackathonId");
CREATE UNIQUE INDEX "HackathonTeam_hackathonId_name_key" ON "HackathonTeam"("hackathonId", "name");
CREATE INDEX "HackathonMember_teamId_idx" ON "HackathonMember"("teamId");
CREATE UNIQUE INDEX "HackathonMember_hackathonId_userId_key" ON "HackathonMember"("hackathonId", "userId");
CREATE UNIQUE INDEX "HackathonSubmission_teamId_key" ON "HackathonSubmission"("teamId");
CREATE INDEX "HackathonScore_judgeId_idx" ON "HackathonScore"("judgeId");
CREATE UNIQUE INDEX "HackathonScore_submissionId_judgeId_key" ON "HackathonScore"("submissionId", "judgeId");

-- AddForeignKey
ALTER TABLE "Hackathon" ADD CONSTRAINT "Hackathon_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonTeam" ADD CONSTRAINT "HackathonTeam_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonMember" ADD CONSTRAINT "HackathonMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HackathonTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonMember" ADD CONSTRAINT "HackathonMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonSubmission" ADD CONSTRAINT "HackathonSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HackathonTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonScore" ADD CONSTRAINT "HackathonScore_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HackathonSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonScore" ADD CONSTRAINT "HackathonScore_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
