import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DiscussionsService, type PostView } from './discussions.service';
import { CreatePostDto, UpdatePostDto } from './dto/discussion.dto';

@ApiTags('discussions')
@ApiBearerAuth()
@Controller('problems/:problemId/discussions')
export class ProblemDiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @Get()
  @ApiOperation({ summary: 'Discussion thread for a problem, replies nested under their parent' })
  list(
    @Param('problemId') problemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PostView[]> {
    return this.discussions.listForProblem(problemId, user);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Post to the thread, or reply by passing parentId' })
  create(
    @Param('problemId') problemId: string,
    @Body() dto: CreatePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PostView> {
    return this.discussions.create(problemId, dto, user);
  }
}

@ApiTags('discussions')
@ApiBearerAuth()
@Controller('discussions')
export class DiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Edit your own post, or pin one as a teacher' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discussions.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a post (author, teacher or admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.discussions.remove(id, user);
  }

  @Post(':id/upvote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle your upvote on a post' })
  upvote(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.discussions.toggleUpvote(id, user);
  }
}
