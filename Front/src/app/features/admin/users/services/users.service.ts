import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { User } from '../../../../core/auth/auth.service';

export interface UsersResponse {
  items: User[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface UserLog {
  id: string;
  accion: string;
  detalle: string;
  observacion: string | null;
  createdAt: string;
  ejecutor: {
    cedula: string;
    nombres: string;
    apellidos: string;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  // Listar usuarios con filtros y paginación
  getUsers(page: number = 1, limit: number = 10, filters: any = {}): Observable<UsersResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    Object.keys(filters).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });

    return this.http.get<UsersResponse>(this.apiUrl, { params });
  }

  // Registrar un nuevo usuario
  createUser(data: {
    cedula: string;
    correoInstitucional: string;
    rol: 'ADMINISTRADOR' | 'DOCENTE' | 'RESPONSABLE_DE_BIENES';
    areas?: string[];
    jornadas?: string[];
    horarioIngles?: string;
  }): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  // Actualizar rol administrativamente
  updateRole(id: string, rol: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/rol`, { rol });
  }

  // Actualizar estado administrativamente (con justificación)
  updateStatus(id: string, estado: string, observacion?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/estado`, { estado, observacion });
  }

  // Obtener log de auditoría
  getUserLogs(id: string): Observable<UserLog[]> {
    return this.http.get<UserLog[]>(`${this.apiUrl}/${id}/logs`);
  }

  // Restablecer contraseña
  resetPassword(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/reset-password`, {});
  }

  // Actualizar datos de un usuario
  updateUser(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}`, data);
  }
}
