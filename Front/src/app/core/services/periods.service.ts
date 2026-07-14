import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AcademicPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'CONFIGURADO' | 'ACTIVO' | 'CERRADO';
  notified48h: boolean;
  closedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PeriodsService {
  private readonly apiUrl = `${environment.apiUrl}/periods`;

  constructor(private readonly http: HttpClient) {}

  // Obtener todos los períodos
  getAllPeriods(): Observable<AcademicPeriod[]> {
    return this.http.get<AcademicPeriod[]>(this.apiUrl);
  }

  // Obtener detalle de un período
  getPeriodById(id: string): Observable<AcademicPeriod> {
    return this.http.get<AcademicPeriod>(`${this.apiUrl}/${id}`);
  }

  // Crear período académico
  createPeriod(data: {
    name: string;
    startDate: string;
    endDate: string;
  }): Observable<AcademicPeriod> {
    return this.http.post<AcademicPeriod>(this.apiUrl, data);
  }

  // Activar período académico
  activatePeriod(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/activate`, {});
  }

  // Cerrar período académico
  closePeriod(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/close`, {});
  }
}
