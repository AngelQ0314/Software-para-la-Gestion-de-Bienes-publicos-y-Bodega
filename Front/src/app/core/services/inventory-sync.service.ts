import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type SyncEventType = 'INVENTORY_CHANGED' | 'SPACES_CHANGED' | 'INCIDENTS_CHANGED' | 'USERS_CHANGED';

@Injectable({
  providedIn: 'root'
})
export class InventorySyncService implements OnDestroy {
  private readonly syncChannel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' 
    ? new BroadcastChannel('yavirac_inventory_sync') 
    : null;

  private readonly eventSubject$ = new Subject<SyncEventType>();
  readonly events$: Observable<SyncEventType> = this.eventSubject$.asObservable();

  constructor() {
    if (this.syncChannel) {
      this.syncChannel.onmessage = (event: MessageEvent) => {
        if (event.data?.type) {
          this.eventSubject$.next(event.data.type as SyncEventType);
        }
      };
    }
  }

  /**
   * Emite una notificación de cambio tanto en la pestaña actual (RxJS)
   * como entre pestañas del navegador (BroadcastChannel).
   */
  notifyChange(type: SyncEventType = 'INVENTORY_CHANGED'): void {
    // 1. Notificar en la misma pestaña
    this.eventSubject$.next(type);

    // 2. Notificar cross-tab (pestañas secundarias o abiertas por otros roles)
    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage({ type, timestamp: Date.now() });
      } catch (e) {
        console.warn('[InventorySyncService] Error enviando evento BroadcastChannel:', e);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.syncChannel) {
      this.syncChannel.close();
    }
  }
}
