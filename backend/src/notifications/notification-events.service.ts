import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { Subject } from 'rxjs';

@Injectable()
export class NotificationEventsService {
  private readonly subject = new Subject<Notification>();
  readonly events$ = this.subject.asObservable();

  publish(notification: Notification): void {
    this.subject.next(notification);
  }
}
