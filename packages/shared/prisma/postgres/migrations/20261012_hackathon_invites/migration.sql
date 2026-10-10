-- CreateTable
CREATE TABLE "HackathonInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HackathonInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HackathonInvite_teamId_inviteeId_key" ON "HackathonInvite"("teamId", "inviteeId");
CREATE INDEX "HackathonInvite_inviteeId_idx" ON "HackathonInvite"("inviteeId");
ALTER TABLE "HackathonInvite" ADD CONSTRAINT "HackathonInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HackathonTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HackathonInvite" ADD CONSTRAINT "HackathonInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HackathonInvite" ADD CONSTRAINT "HackathonInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Hackathon" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'PROJECT';
CREATE TABLE "HackathonProblem" ("id" TEXT NOT NULL, "hackathonId" TEXT NOT NULL, "problemId" TEXT NOT NULL, CONSTRAINT "HackathonProblem_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "HackathonProblem_hackathonId_problemId_key" ON "HackathonProblem"("hackathonId", "problemId");
ALTER TABLE "HackathonProblem" ADD CONSTRAINT "HackathonProblem_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HackathonProblem" ADD CONSTRAINT "HackathonProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Hackathon" ADD COLUMN "startNotifiedAt" TIMESTAMP(3);
