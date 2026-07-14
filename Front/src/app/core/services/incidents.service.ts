import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IncidentReport {
  id: string;
  teacherId: string;
  spaceId: string;
  academicPeriodId: string;
  jornada: 'MATUTINA' | 'VESPERTINA' | 'NOCTURNA';
  description: string;
  status: 'PENDIENTE' | 'REVISADO' | 'RESUELTO';
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

  constructor(private readonly http: HttpClient) {}

  // Crear reporte de novedad
  createIncident(data: {
    spaceId: string;
    jornada: string;
    description: string;
    itemIds: string[];
  }): Observable<any> {
    return this.http.post(this.apiUrl, data);
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
    return this.http.patch(`${this.apiUrl}/${id}/status`, { status });
  }
}
