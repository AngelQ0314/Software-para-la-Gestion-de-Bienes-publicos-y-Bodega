import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReportItem {
  id: string;
  code: string;
  type: 'CIERRE_PERIODO' | 'NOVEDADES_CONSOLIDADO' | 'AUDITORIA_INVENTARIO' | 'PERIODO_ACADEMICO' | 'NOVEDADES';
  academicPeriodId: string;
  generatedById: string;
  createdAt: string;
  academicPeriod?: any;
  generatedBy?: any;
  filePath?: string;
  reportData?: any;
}

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  constructor(private readonly http: HttpClient) {}

  // Obtener historial de reportes con filtros
  getReports(filters: any = {}): Observable<ReportItem[]> {
    let params = new HttpParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });
    return this.http.get<ReportItem[]>(this.apiUrl, { params });
  }

  // Obtener novedades/incidencias activas
  getActiveNovelties(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/novedades/activas`);
  }

  // Generar un reporte consolidado de novedades
  generateNoveltyReport(academicPeriodId?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/novedades/generar`, { academicPeriodId });
  }

  // Obtener el reporte de cierre de período
  getClosureReport(periodId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/period/${periodId}`);
  }

  // Obtener detalle de un reporte específico
  getReportDetails(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  // Descargar PDF de forma segura inyectando el token JWT mediante HttpClient
  downloadReportPdf(reportId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${reportId}/download`, { responseType: 'blob' });
  }
}
