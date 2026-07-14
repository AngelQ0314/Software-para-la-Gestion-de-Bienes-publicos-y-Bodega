import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RequestsService } from './requests.service';
import { IncidentsService } from './incidents.service';
import { Router } from '@angular/router';

export interface SystemNotification {
  id: string;
  message: string;
  time: Date;
  read: boolean;
  icon: string;
  type: 'REQUEST' | 'INCIDENT' | 'SUCCESS' | 'INFO';
  route: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly notificationsList = signal<SystemNotification[]>([]);

  // Computed properties
  notifications = computed(() => this.notificationsList());
  unreadCount = computed(() => this.notificationsList().filter((n) => !n.read).length);

  constructor(
    private readonly requestsService: RequestsService,
    private readonly incidentsService: IncidentsService,
    private readonly router: Router
  ) {
    // Cargar notificaciones del sistema al iniciar
    this.refreshSystemNotifications();
  }

  // Refresca jalando datos reales de solicitudes y novedades del servidor
  refreshSystemNotifications(): void {
    const list: SystemNotification[] = [];

    // 1. Obtener solicitudes pendientes
    this.requestsService.getAllRequests({ status: 'EN_PROCESO' }).subscribe({
      next: (requests) => {
        requests.forEach((req) => {
          list.push({
            id: `req-${req.id}`,
            message: `Nueva solicitud de ${req.type === 'TRANSFERENCIA' ? 'Traspaso' : 'Bodega'} por ${req.teacher?.nombres || 'Docente'}`,
            time: new Date(req.createdAt),
            read: false,
            icon: req.type === 'TRANSFERENCIA' ? '🔄' : '➕',
            type: 'REQUEST',
            route: '/admin/requests'
          });
        });
        this.updateList(list);
      },
      error: () => {}
    });

    // 2. Obtener novedades pendientes
    this.incidentsService.getAllIncidents({ status: 'PENDIENTE' }).subscribe({
      next: (incidents) => {
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
        this.updateList(list);
      },
      error: () => {}
    });
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
