import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RequestItem {
  id?: string;
  itemId: string;
  cantidad: number;
  inventoryItem?: any;
  item?: any;
}

export interface InventoryRequest {
  id: string;
  teacherId: string;
  spaceId: string;
  destinationSpaceId: string | null;
  destinationTeacherId?: string | null;
  academicPeriodId?: string | null;
  academicPeriod?: any;
  type: string;
  status: 'EN_PROCESO' | 'APROBADA' | 'RECHAZADA';
  motive: string;
  rejectionReason: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  createdAt: string;
  updatedAt: string;
  teacher?: any;
  space?: any;
  destinationSpace?: any;
  destinationTeacher?: any;
  items?: RequestItem[];
}

@Injectable({
  providedIn: 'root',
})
export class RequestsService {
  private readonly apiUrl = `${environment.apiUrl}/requests`;

  constructor(private readonly http: HttpClient) {}

  // Crear solicitud
  createRequest(data: {
    spaceId: string;
    destinationSpaceId?: string | null;
    type: 'NUEVO_INVENTARIO' | 'TRANSFERENCIA' | 'TRASPASO_DOCENTE' | 'SOLICITUD_TRASPASO';
    motive: string;
    items: { itemId: string; cantidad: number }[];
  }): Observable<InventoryRequest> {
    return this.http.post<InventoryRequest>(this.apiUrl, data);
  }

  // Obtener todas las solicitudes con filtros
  getAllRequests(filters: any = {}): Observable<InventoryRequest[]> {
    let params = new HttpParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });
    return this.http.get<InventoryRequest[]>(this.apiUrl, { params });
  }

  // Detalle de solicitud
  getRequestById(id: string): Observable<InventoryRequest> {
    return this.http.get<InventoryRequest>(`${this.apiUrl}/${id}`);
  }

  // Aprobar solicitud
  approveRequest(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/approve`, {});
  }

  // Rechazar solicitud
  rejectRequest(id: string, rejectionReason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/reject`, { rejectionReason });
  }

  // Obtener URL de descarga del acta PDF
  getActaDownloadUrl(id: string): string {
    return `${this.apiUrl}/${id}/acta`;
  }

  // Descargar Acta de Entrega-Recepción de forma segura inyectando el token JWT mediante HttpClient
  downloadActaPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/acta`, { responseType: 'blob' });
  }
}
