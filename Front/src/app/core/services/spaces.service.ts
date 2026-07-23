import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InventorySyncService } from './inventory-sync.service';

export interface PhysicalSpace {
  id: string;
  roomNumber: string;
  name: string;
  type: 'AULA' | 'LABORATORIO' | 'TALLER' | 'OFICINA' | 'BODEGA';
  location: string;
  capacity: number;
  jornadas: string[];
  createdAt?: string;
  updatedAt?: string;
  responsibleTeachers?: any[];
  items?: any[];
}

@Injectable({
  providedIn: 'root',
})
export class SpacesService {
  private readonly apiUrl = `${environment.apiUrl}/spaces`;

  constructor(
    private readonly http: HttpClient,
    private readonly syncService: InventorySyncService
  ) {}

  // Obtener todos los espacios con filtros
  getAllSpaces(filters: any = {}): Observable<PhysicalSpace[]> {
    let params = new HttpParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });
    return this.http.get<PhysicalSpace[]>(this.apiUrl, { params });
  }

  // Obtener detalle de un espacio
  getSpaceById(id: string, allowExternal?: boolean): Observable<PhysicalSpace> {
    let params = new HttpParams();
    if (allowExternal) {
      params = params.set('allowExternal', 'true');
    }
    return this.http.get<PhysicalSpace>(`${this.apiUrl}/${id}`, { params });
  }

  // Crear espacio físico
  createSpace(data: {
    roomNumber: string;
    name: string;
    type: string;
    location: string;
    capacity: number;
    jornadas: string[];
  }): Observable<PhysicalSpace> {
    return this.http.post<PhysicalSpace>(this.apiUrl, data).pipe(
      tap(() => {
        this.syncService.notifyChange('SPACES_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }

  // Editar espacio físico
  updateSpace(id: string, data: any): Observable<PhysicalSpace> {
    return this.http.patch<PhysicalSpace>(`${this.apiUrl}/${id}`, data).pipe(
      tap(() => {
        this.syncService.notifyChange('SPACES_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }

  // Eliminar espacio físico
  deleteSpace(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.syncService.notifyChange('SPACES_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }

  // Vincular docentes
  linkTeachers(spaceId: string, teacherIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/${spaceId}/teachers`, { teacherIds }).pipe(
      tap(() => {
        this.syncService.notifyChange('SPACES_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }

  // Desvincular un docente
  unlinkTeacher(spaceId: string, teacherId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${spaceId}/teachers/${teacherId}`).pipe(
      tap(() => {
        this.syncService.notifyChange('SPACES_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }

  // Asignar artículos al espacio
  assignItems(spaceId: string, items: { itemId: string; cantidad: number }[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/${spaceId}/items`, { items }).pipe(
      tap(() => {
        this.syncService.notifyChange('SPACES_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }

  // Desasociar un artículo
  removeItem(spaceId: string, itemId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${spaceId}/items/${itemId}`).pipe(
      tap(() => {
        this.syncService.notifyChange('SPACES_CHANGED');
        this.syncService.notifyChange('INVENTORY_CHANGED');
      })
    );
  }

  // Obtener inventario asignado global (Docentes / Admins)
  getAssignedInventory(filters: any = {}): Observable<any[]> {
    let params = new HttpParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });
    return this.http.get<any[]>(`${this.apiUrl}/assigned-inventory/items`, { params });
  }

  // Obtener inventario por jornada/shift
  getInventoryByShift(spaceId: string, jornada?: string): Observable<any[]> {
    let params = new HttpParams();
    if (jornada) {
      params = params.set('jornada', jornada);
    }
    return this.http.get<any[]>(`${this.apiUrl}/${spaceId}/inventory`, { params });
  }
}
