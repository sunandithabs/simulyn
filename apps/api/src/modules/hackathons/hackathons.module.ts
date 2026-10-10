import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { HackathonsController } from './hackathons.controller';
import { HackathonsService } from './hackathons.service';

@Module({ imports: [NotificationsModule], controllers: [HackathonsController], providers: [HackathonsService] })
export class HackathonsModule {}
