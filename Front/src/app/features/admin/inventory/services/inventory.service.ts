import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { InventorySyncService } from '../../../../core/services/inventory-sync.service';

export interface Category {
  id: string;
  nombre: string;
  baseView: 'BIBLIOTECA' | 'BIENES_PUBLICOS' | 'INSUMOS';
}

export interface Subcategory {
  id: string;
  nombre: string;
  categoriaId: string;
  categoria?: Category;
  configs?: SubcategoryFieldAssociation[];
}

export interface CustomField {
  id: string;
  nombre: string;
  tipo: 'TEXT' | 'NUMBER_INT' | 'NUMBER_DECIMAL' | 'DATE' | 'OPTIONS_LIST';
  opciones: string[] | null;
}

export interface SubcategoryFieldAssociation {
  id?: string;
  customFieldId: string;
  customField?: CustomField;
  orden: number;
  isMandatory: boolean;
}

export interface InventoryItem {
  id?: string;
  name?: string;
  codigoYavirac: string;
  subcategoriaId: string;
  subcategoria?: Subcategory;
  estadoFisico: 'BUENO' | 'REGULAR' | 'MALO' | 'EN_MANTENIMIENTO';
  dynamicValues: Record<string, any>;
  resolvedValues?: Array<{
    fieldId: string;
    label: string;
    tipo: string;
    value: any;
  }>;
  cantidad?: number;
  status?: string;
  isPending?: boolean;
  physicalSpace?: { 
    id: string; 
    name: string; 
    roomNumber?: string; 
    responsibleTeachers?: Array<{ id: string; nombres: string; apellidos: string }> 
  } | null;
  physicalSpaceId?: string | null;
  inventoryView?: { id: string; name: string; code: string } | null;
  disponible?: boolean;
  mensajeDisponibilidad?: string;
  distribucionEspacios?: any[];
}

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;

  constructor(
    private readonly http: HttpClient,
    private readonly syncService: InventorySyncService
  ) {}

  getViews(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/views`);
  }

  // ==========================================
  // CATEGORÍAS
  // ==========================================
  getCategories(): Observable<Category[]> {
    return this.http.get<any[]>(`${this.apiUrl}/categories`).pipe(
      map((cats) =>
        cats.map((c) => ({
          id: c.id,
          nombre: c.name,
          baseView: c.inventoryView?.code || c.inventoryViewCode || 'BIENES_PUBLICOS',
        }))
      )
    );
  }

  createCategory(data: { nombre: string; baseView: string }): Observable<Category> {
    const payload = { name: data.nombre, inventoryViewCode: data.baseView };
    return this.http.post<Category>(`${this.apiUrl}/categories`, payload).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  updateCategory(id: string, data: { nombre: string; baseView: string }): Observable<Category> {
    const payload = { name: data.nombre, inventoryViewCode: data.baseView };
    return this.http.patch<Category>(`${this.apiUrl}/categories/${id}`, payload).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  // ==========================================
  // SUBCATEGORÍAS
  // ==========================================
  getSubcategories(categoryId?: string): Observable<Subcategory[]> {
    let params = new HttpParams();
    if (categoryId) {
      params = params.set('categoryId', categoryId);
    }
    return this.http.get<any[]>(`${this.apiUrl}/subcategories`, { params }).pipe(
      map((subs) =>
        subs.map((s) => ({
          id: s.id,
          nombre: s.name,
          categoriaId: s.categoryId,
          categoria: s.category
            ? {
                id: s.category.id,
                nombre: s.category.name,
                baseView: s.category.inventoryView?.code || s.category.inventoryViewCode || 'BIENES_PUBLICOS',
              }
            : undefined,
        }))
      )
    );
  }

  createSubcategory(data: { nombre: string; categoriaId: string }): Observable<Subcategory> {
    const payload = { name: data.nombre, categoryId: data.categoriaId };
    return this.http.post<Subcategory>(`${this.apiUrl}/subcategories`, payload).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  updateSubcategory(id: string, data: { nombre: string; categoriaId: string }): Observable<Subcategory> {
    const payload = { name: data.nombre, categoryId: data.categoriaId };
    return this.http.patch<Subcategory>(`${this.apiUrl}/subcategories/${id}`, payload).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  deleteSubcategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/subcategories/${id}`).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  // ==========================================
  // CAMPOS PERSONALIZADOS
  // ==========================================
  getCustomFields(): Observable<CustomField[]> {
    return this.http.get<any[]>(`${this.apiUrl}/custom-fields`).pipe(
      map((fields) =>
        fields.map((f) => ({
          id: f.id,
          nombre: f.label || f.name,
          tipo: f.type,
          opciones: f.options || null,
        }))
      )
    );
  }

  createCustomField(data: { nombre: string; tipo: string; opciones?: string[] | null }): Observable<CustomField> {
    const technicalName = data.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
    const payload = {
      name: technicalName,
      label: data.nombre,
      type: data.tipo,
      options: data.opciones || undefined,
    };
    return this.http.post<CustomField>(`${this.apiUrl}/custom-fields`, payload).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  updateCustomField(id: string, data: { nombre: string; tipo: string; opciones?: string[] | null }): Observable<CustomField> {
    const technicalName = data.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
    const payload = {
      name: technicalName,
      label: data.nombre,
      type: data.tipo,
      options: data.opciones || undefined,
    };
    return this.http.patch<CustomField>(`${this.apiUrl}/custom-fields/${id}`, payload).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  deleteCustomField(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/custom-fields/${id}`).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  // ==========================================
  // CAMPOS DINÁMICOS POR SUBCATEGORÍA
  // ==========================================
  getSubcategoryFields(subcategoryId: string): Observable<SubcategoryFieldAssociation[]> {
    return this.http.get<any[]>(`${this.apiUrl}/subcategories/${subcategoryId}/fields`).pipe(
      map((assocs) =>
        assocs.map((a) => ({
          id: a.id,
          customFieldId: a.customFieldId,
          customField: a.customField
            ? {
                id: a.customField.id,
                nombre: a.customField.label || a.customField.name,
                tipo: a.customField.type,
                opciones: a.customField.options || null,
              }
            : undefined,
          orden: a.sortOrder || 0,
          isMandatory: a.isMandatory || false,
        }))
      )
    );
  }

  associateFieldToSubcategory(
    subcategoryId: string,
    assoc: { customFieldId: string; sortOrder: number; isMandatory: boolean }
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/subcategories/${subcategoryId}/fields`, assoc).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  removeFieldFromSubcategory(subcategoryId: string, customFieldId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/subcategories/${subcategoryId}/fields/${customFieldId}`).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  // ==========================================
  // ELEMENTOS DE INVENTARIO
  // ==========================================
  getItems(page: number = 1, limit: number = 10, filters: any = {}): Observable<{
    data: InventoryItem[];
    lastPage: number;
    meta?: any;
  }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    Object.keys(filters).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });

    return this.http.get<any>(`${this.apiUrl}/items`, { params }).pipe(
      map((res) => ({
        data: (res.data || []).map((i: any) => ({
          id: i.id,
          name: i.name,
          codigoYavirac: i.codeValue || '',
          subcategoriaId: i.subcategoryId,
          subcategoria: i.subcategory
            ? {
                id: i.subcategory.id,
                nombre: i.subcategory.name,
                categoriaId: i.subcategory.categoryId,
                categoria: i.subcategory.category
                  ? {
                      id: i.subcategory.category.id,
                      nombre: i.subcategory.category.name,
                      baseView:
                        i.subcategory.category.inventoryView?.code ||
                        i.subcategory.category.inventoryViewCode ||
                        'BIENES_PUBLICOS',
                    }
                  : undefined,
              }
            : undefined,
          estadoFisico: i.estadoFisico || 'BUENO',
          dynamicValues: i.dynamicValues || {},
          resolvedValues: i.resolvedValues || [],
          cantidad: (i.cantidad !== undefined && i.cantidad !== null) ? i.cantidad : 1,
          status: i.status || 'ACTIVO',
          isPending: !!i.isPending,
          physicalSpace: i.physicalSpace ? { 
            id: i.physicalSpace.id, 
            name: i.physicalSpace.name, 
            roomNumber: i.physicalSpace.roomNumber,
            responsibleTeachers: i.physicalSpace.responsibleTeachers || []
          } : null,
          inventoryView: i.inventoryView,
        })),
        total: res.total || 0,
        lastPage: res.lastPage || 1,
        meta: res.meta,
      }))
    );
  }

  getItem(id: string): Observable<InventoryItem> {
    return this.http.get<any>(`${this.apiUrl}/items/${id}`).pipe(
      map((i) => ({
        id: i.id,
        name: i.name,
        codigoYavirac: i.codeValue || '',
        subcategoriaId: i.subcategoryId,
        subcategoria: i.subcategory
          ? {
              id: i.subcategory.id,
              nombre: i.subcategory.name,
              categoriaId: i.subcategory.categoryId,
              categoria: i.subcategory.category
                ? {
                    id: i.subcategory.category.id,
                    nombre: i.subcategory.category.name,
                    baseView:
                      i.subcategory.category.inventoryView?.code ||
                      i.subcategory.category.inventoryViewCode ||
                      'BIENES_PUBLICOS',
                  }
                : undefined,
            }
          : undefined,
        estadoFisico: i.estadoFisico || 'BUENO',
        dynamicValues: i.dynamicValues || {},
        resolvedValues: i.resolvedValues || [],
        cantidad: (i.cantidad !== undefined && i.cantidad !== null) ? i.cantidad : 1,
        status: i.status || 'ACTIVO',
        isPending: !!i.isPending,
        physicalSpace: i.physicalSpace ? { 
          id: i.physicalSpace.id, 
          name: i.physicalSpace.name, 
          roomNumber: i.physicalSpace.roomNumber,
          responsibleTeachers: i.physicalSpace.responsibleTeachers || []
        } : null,
        inventoryView: i.inventoryView,
        distribucionEspacios: i.distribucionEspacios || [],
      }))
    );
  }

  getItemById(id: string): Observable<InventoryItem> {
    return this.getItem(id);
  }

  createItem(item: InventoryItem): Observable<InventoryItem> {
    const payload = {
      name: item.name,
      subcategoryId: item.subcategoriaId || (item as any).subcategoryId,
      codeValue: item.codigoYavirac || (item as any).codeValue,
      cantidad: item.cantidad !== undefined ? Number(item.cantidad) : 1,
      dynamicValues: item.dynamicValues || {},
      estadoFisico: item.estadoFisico || 'BUENO',
      status: item.status || 'ACTIVO',
      isPending: !!item.isPending,
    };
    return this.http.post<InventoryItem>(`${this.apiUrl}/items`, payload).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  updateItem(id: string, item: Partial<InventoryItem>): Observable<InventoryItem> {
    const payload: any = {};
    if (item.name !== undefined) payload.name = item.name;
    
    const subId = item.subcategoriaId || (item as any).subcategoryId;
    if (subId !== undefined) payload.subcategoryId = subId;

    const val = item.codigoYavirac !== undefined ? item.codigoYavirac : (item as any).codeValue;
    if (val !== undefined) payload.codeValue = val;

    if (item.cantidad !== undefined) payload.cantidad = Number(item.cantidad);
    if (item.dynamicValues !== undefined) payload.dynamicValues = item.dynamicValues;
    if (item.estadoFisico !== undefined) payload.estadoFisico = item.estadoFisico;
    if (item.status !== undefined) payload.status = item.status;
    if (item.isPending !== undefined) payload.isPending = !!item.isPending;

    return this.http.patch<InventoryItem>(`${this.apiUrl}/items/${id}`, payload).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  deleteItem(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/items/${id}`).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }


  importItemsFromExcel(file: File, inventoryViewId?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const query = inventoryViewId ? `?inventoryViewId=${inventoryViewId}` : '';
    return this.http.post(`${this.apiUrl}/items/import${query}`, formData).pipe(
      tap(() => this.syncService.notifyChange('INVENTORY_CHANGED'))
    );
  }

  downloadTemplate(inventoryViewId?: string): Observable<Blob> {
    const query = inventoryViewId ? `?inventoryViewId=${inventoryViewId}` : '';
    return this.http.get(`${this.apiUrl}/template${query}`, { responseType: 'blob' });
  }

  exportItemsToExcel(inventoryViewId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/items/export?inventoryViewId=${inventoryViewId}`, { responseType: 'blob' });
  }
}
