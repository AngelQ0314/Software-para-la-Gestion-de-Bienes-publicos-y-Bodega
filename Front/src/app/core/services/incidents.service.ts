import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InventorySyncService } from './inventory-sync.service';

export interface IncidentReport {
  id: string;
  teacherId: string;
  spaceId: string;
  academicPeriodId: string;
  jornada: 'MATUTINA' | 'VESPERTINA' | 'NOCTURNA';
  description: string;
  status: 'PENDIENTE' | 'REVISADO' | 'RESUELTO';
  estadoFisico?: string;
  createdAt: string;
  updatedAt: string;
  teacher?: any;
  space?: any;
  academicPeriod?: any;
  items?: any[];
}

@Injectable({
  providedIn: 'root',
})
export class IncidentsService {
  private readonly apiUrl = `${environment.apiUrl}/incidents`;

  constructor(
    private readonly http: HttpClient,
    private readonly syncService: InventorySyncService
  ) {}

  // Crear reporte de novedad
  createIncident(data: {
    spaceId: string;
    jornada: string;
    description: string;
    itemIds: string[];
    itemsPayload?: Array<{ itemId: string; cantidadAfectada?: number }>;
  }): Observable<any> {
    return this.http.post(this.apiUrl, data).pipe(
      tap(() => {
        this.syncService.notifyChange('INCIDENTS_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }

  // Obtener novedades con filtros
  getAllIncidents(filters: any = {}): Observable<IncidentReport[]> {
    let params = new HttpParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });
    return this.http.get<IncidentReport[]>(this.apiUrl, { params });
  }

  // Detalle de novedad
  getIncidentById(id: string): Observable<IncidentReport> {
    return this.http.get<IncidentReport>(`${this.apiUrl}/${id}`);
  }

  // Actualizar estado de novedad
  updateIncidentStatus(id: string, status: 'PENDIENTE' | 'REVISADO' | 'RESUELTO'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/status`, { status }).pipe(
      tap(() => {
        this.syncService.notifyChange('INCIDENTS_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }
}
