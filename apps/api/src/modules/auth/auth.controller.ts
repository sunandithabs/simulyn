import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';
import type { Request, Response } from 'express';

import { REFRESH_COOKIE } from '../../config/configuration';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RefreshTokenGuard } from '../../common/guards/refresh-token.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from './auth.service';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with a username (or email) and password',
    description:
      'Returns a 15 minute access token and sets the rotating refresh token as an httpOnly cookie.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto.username, dto.password, res);
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @ApiCookieAuth(REFRESH_COOKIE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange the refresh cookie for a new access token (rotates the cookie)' })
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.authService.refresh(cookies?.[REFRESH_COOKIE], res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the refresh token and clear the cookie' })
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.authService.logout(cookies?.[REFRESH_COOKIE], res);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change your own password',
    description:
      'Required for accounts flagged with mustChangePassword. Revokes every other session on success.',
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: boolean; mustChangePassword: boolean }> {
    return this.authService.changePassword(userId, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('impersonate/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in as another user (admin)',
    description:
      'Returns that user’s session so an admin can reproduce a report. Admin accounts and deactivated accounts cannot be impersonated, and every use is logged.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  impersonate(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.impersonate(userId, user, res);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current user derived from the access token' })
  @ApiOkResponse({ type: AuthUserDto })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
