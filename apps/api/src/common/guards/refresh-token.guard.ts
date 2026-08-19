import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Authenticates POST /auth/refresh using the httpOnly refresh cookie. */
@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {}
