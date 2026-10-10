-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 4,
    "criteria" TEXT NOT NULL DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "resultsPublished" BOOLEAN NOT NULL DEFAULT false,
    "hostId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hackathon_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HackathonTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hackathonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HackathonTeam_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HackathonMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HackathonMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HackathonTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HackathonMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HackathonSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "repoUrl" TEXT,
    "demoUrl" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HackathonSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HackathonTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HackathonScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HackathonScore_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HackathonSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HackathonScore_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
