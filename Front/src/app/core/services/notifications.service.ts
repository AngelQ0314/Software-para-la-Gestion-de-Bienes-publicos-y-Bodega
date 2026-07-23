import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RequestsService } from './requests.service';
import { IncidentsService } from './incidents.service';
import { Router } from '@angular/router';

import { InventoryService } from '../../features/admin/inventory/services/inventory.service';

export interface SystemNotification {
  id: string;
  message: string;
  time: Date;
  read: boolean;
  icon: string;
  type: 'REQUEST' | 'INCIDENT' | 'SUCCESS' | 'INFO' | 'STOCK_ALERT';
  route: string;
  itemId?: string;
  queryParams?: any;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly notificationsList = signal<SystemNotification[]>([]);

  // Subject para abrir el modal de edición de un artículo directamente al pulsar la notificación
  readonly openEditModalRequested$ = new Subject<string>();

  // Computed properties
  notifications = computed(() => this.notificationsList());
  unreadCount = computed(() => this.notificationsList().filter((n) => !n.read).length);


  constructor(
    private readonly requestsService: RequestsService,
    private readonly incidentsService: IncidentsService,
    private readonly inventoryService: InventoryService,
    private readonly router: Router
  ) {
    // Cargar notificaciones del sistema al iniciar
    this.refreshSystemNotifications();
  }

  // Refresca jalando datos reales de solicitudes, novedades y alertas de stock del servidor
  refreshSystemNotifications(): void {
    forkJoin({
      requests: this.requestsService.getAllRequests({ status: 'EN_PROCESO' }).pipe(catchError(() => of([]))),
      incidents: this.incidentsService.getAllIncidents({ status: 'PENDIENTE' }).pipe(catchError(() => of([]))),
      inventory: this.inventoryService.getItems(1, 100, { inventoryViewCode: 'INSUMOS' }).pipe(catchError(() => of({ data: [] })))
    }).subscribe({
      next: ({ requests, incidents, inventory }) => {
        const list: SystemNotification[] = [];

        // 1. Obtener solicitudes pendientes
        requests.forEach((req) => {
          const readableType = this.formatRequestType(req.type);
          list.push({
            id: `req-${req.id}`,
            message: `Nueva solicitud de ${readableType} por ${req.teacher?.nombres || 'Docente'}`,
            time: new Date(req.createdAt),
            read: false,
            icon: this.getRequestIcon(req.type),
            type: 'REQUEST',
            route: '/admin/requests'
          });
        });

        // 2. Obtener novedades pendientes
        incidents.forEach((inc) => {
          list.push({
            id: `inc-${inc.id}`,
            message: `Novedad reportada en Aula ${inc.space?.roomNumber}: ${inc.description}`,
            time: new Date(inc.createdAt),
            read: false,
            icon: '⚠️',
            type: 'INCIDENT',
            route: '/admin/incidents'
          });
        });

        // 3. Obtener suministros/insumos con stock 0
        const items = inventory.data || [];
        items.forEach((item: any) => {
          if ((item.cantidad ?? 0) <= 0) {
            list.push({
              id: `stock-${item.id}`,
              message: `El artículo '${item.name || item.codigoYavirac}' se quedó sin stock. Por favor aumente el stock.`,
              time: new Date(),
              read: false,
              icon: '📦',
              type: 'STOCK_ALERT',
              route: '/admin/inventory',
              itemId: item.id,
              queryParams: { editItemId: item.id }
            });
          }
        });

        this.updateList(list);
      },
      error: () => {}
    });
  }

  private formatRequestType(type: string): string {
    if (type === 'NUEVO_INVENTARIO') return 'Nuevo Inventario';
    if (type === 'TRASPASO_DOCENTE') return 'Traspaso a Docente';
    if (type === 'TRANSFERENCIA_AULAS') return 'Transferencia entre Aulas';
    if (type === 'SOLICITUD_EXTERNA') return 'Solicitud de Aula Ajena';
    if (type === 'DEVOLUCION_BODEGA') return 'Devolución a Bodega';
    if (type === 'BAJA_DEFINITIVA') return 'Baja Definitiva';
    if (type === 'MANTENIMIENTO') return 'Mantenimiento';
    return type;
  }

  private getRequestIcon(type: string): string {
    if (type === 'NUEVO_INVENTARIO') return '➕';
    if (type === 'TRASPASO_DOCENTE' || type === 'TRANSFERENCIA_AULAS' || type === 'SOLICITUD_EXTERNA') return '🔄';
    if (type === 'DEVOLUCION_BODEGA') return '⏪';
    if (type === 'BAJA_DEFINITIVA') return '🗑️';
    if (type === 'MANTENIMIENTO') return '🛠️';
    return '📋';
  }


  private updateList(newList: SystemNotification[]): void {
    // Combinar con notificaciones locales existentes para no perder las de éxito local
    const current = this.notificationsList();
    const localOnly = current.filter((c) => c.type === 'SUCCESS' || c.type === 'INFO');
    
    const combined = [...newList, ...localOnly].sort(
      (a, b) => b.time.getTime() - a.time.getTime()
    );
    this.notificationsList.set(combined);
  }

  // Agregar una notificación local manual (ej: al crear un usuario con éxito)
  addNotification(message: string, type: 'SUCCESS' | 'INFO' = 'SUCCESS', icon: string = '👤'): void {
    const notif: SystemNotification = {
      id: `local-${Date.now()}`,
      message,
      time: new Date(),
      read: false,
      icon,
      type,
      route: ''
    };

    const updated = [notif, ...this.notificationsList()].sort(
      (a, b) => b.time.getTime() - a.time.getTime()
    );
    this.notificationsList.set(updated);
  }

  markAllAsRead(): void {
    const updated = this.notificationsList().map((n) => ({ ...n, read: true }));
    this.notificationsList.set(updated);
  }

  markAsRead(id: string): void {
    const updated = this.notificationsList().map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    this.notificationsList.set(updated);
  }

  clearNotification(id: string): void {
    const updated = this.notificationsList().filter((n) => n.id !== id);
    this.notificationsList.set(updated);
  }
}
