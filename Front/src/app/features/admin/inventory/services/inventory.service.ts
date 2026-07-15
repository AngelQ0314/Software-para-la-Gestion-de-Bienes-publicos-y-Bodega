import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../../environments/environment';

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
}

export interface CustomField {
  id: string;
  nombre: string;
  tipo: 'TEXT' | 'NUMBER_INT' | 'NUMBER_DECIMAL' | 'DATE' | 'OPTIONS_LIST';
  opciones: string[] | null;
}

export interface CodeType {
  id: string;
  nombre: string;
}

export interface CodeTypeFieldAssociation {
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
  codigoTipoId: string;
  codigoTipo?: CodeType;
  subcategoriaId: string;
  subcategoria?: Subcategory;
  estadoFisico: 'BUENO' | 'REGULAR' | 'MALO';
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
  physicalSpace?: { id: string; name: string } | null;
}

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;

  constructor(private readonly http: HttpClient) {}

  getViews(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/views`);
  }

  // ==========================================
  // CATEGORÍAS
  // ==========================================
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
    return this.http.post<Category>(`${this.apiUrl}/categories`, payload);
  }

  updateCategory(id: string, data: { nombre: string; baseView: string }): Observable<Category> {
    const payload = { name: data.nombre, inventoryViewCode: data.baseView };
    return this.http.patch<Category>(`${this.apiUrl}/categories/${id}`, payload);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`);
  }

  // ==========================================
  // SUBCATEGORÍAS
  // ==========================================
  getSubcategories(): Observable<Subcategory[]> {
    return this.http.get<any[]>(`${this.apiUrl}/subcategories`).pipe(
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
    return this.http.post<Subcategory>(`${this.apiUrl}/subcategories`, payload);
  }

  updateSubcategory(id: string, data: { nombre: string; categoriaId: string }): Observable<Subcategory> {
    const payload = { name: data.nombre, categoryId: data.categoriaId };
    return this.http.patch<Subcategory>(`${this.apiUrl}/subcategories/${id}`, payload);
  }

  deleteSubcategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/subcategories/${id}`);
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
    return this.http.post<CustomField>(`${this.apiUrl}/custom-fields`, payload);
  }

  updateCustomField(id: string, data: { nombre: string; tipo: string; opciones?: string[] | null }): Observable<CustomField> {
    const technicalName = data.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
    const payload = {
      name: technicalName,
      label: data.nombre,
      type: data.tipo,
      options: data.opciones || undefined,
    };
    return this.http.patch<CustomField>(`${this.apiUrl}/custom-fields/${id}`, payload);
  }

  deleteCustomField(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/custom-fields/${id}`);
  }

  // ==========================================
  // TIPOS DE CÓDIGO
  // ==========================================
  getCodeTypes(): Observable<CodeType[]> {
    return this.http.get<any[]>(`${this.apiUrl}/code-types`).pipe(
      map((cts) =>
        cts.map((c) => ({
          id: c.id,
          nombre: c.name,
        }))
      )
    );
  }

  createCodeType(data: { nombre: string }): Observable<CodeType> {
    const payload = { name: data.nombre };
    return this.http.post<CodeType>(`${this.apiUrl}/code-types`, payload);
  }

  updateCodeType(id: string, data: { nombre: string }): Observable<CodeType> {
    const payload = { name: data.nombre };
    return this.http.patch<CodeType>(`${this.apiUrl}/code-types/${id}`, payload);
  }

  deleteCodeType(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/code-types/${id}`);
  }

  // ==========================================
  // ASOCIACIÓN DE CAMPOS A TIPO DE CÓDIGO
  // ==========================================
  getCodeTypeFields(codeTypeId: string): Observable<CodeTypeFieldAssociation[]> {
    return this.http.get<any[]>(`${this.apiUrl}/code-types/${codeTypeId}/fields`).pipe(
      map((assocs) =>
        assocs.map((a) => ({
          id: a.id,
          customFieldId: a.id,
          customField: {
            id: a.id,
            nombre: a.label || a.name,
            tipo: a.type,
            opciones: a.options || null,
          },
          orden: a.sortOrder || 0,
          isMandatory: a.isMandatory || false,
        }))
      )
    );
  }


  associateFieldToCodeTypeSingle(
    codeTypeId: string,
    assoc: { customFieldId: string; sortOrder: number; isMandatory: boolean }
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/code-types/${codeTypeId}/fields`, assoc);
  }

  removeFieldFromCodeType(codeTypeId: string, customFieldId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/code-types/${codeTypeId}/fields/${customFieldId}`);
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
          codigoTipoId: i.codeTypeId,
          codigoTipo: i.codeType ? { id: i.codeType.id, nombre: i.codeType.name } : undefined,
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
          cantidad: i.cantidad || 1,
          status: i.status || 'ACTIVO',
          isPending: !!i.isPending,
          physicalSpace: i.physicalSpace ? { id: i.physicalSpace.id, name: i.physicalSpace.name } : null,
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
        codigoTipoId: i.codeTypeId,
        codigoTipo: i.codeType ? { id: i.codeType.id, nombre: i.codeType.name } : undefined,
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
        cantidad: i.cantidad || 1,
        status: i.status || 'ACTIVO',
        isPending: !!i.isPending,
        physicalSpace: i.physicalSpace ? { id: i.physicalSpace.id, name: i.physicalSpace.name } : null,
      }))
    );
  }

  createItem(item: InventoryItem): Observable<InventoryItem> {
    const payload = {
      name: item.name,
      subcategoryId: item.subcategoriaId,
      codeTypeId: item.codigoTipoId,
      codeValue: item.codigoYavirac,
      cantidad: item.cantidad !== undefined ? Number(item.cantidad) : 1,
      dynamicValues: item.dynamicValues || {},
      estadoFisico: item.estadoFisico || 'BUENO',
      status: item.status || 'ACTIVO',
      isPending: !!item.isPending,
    };
    return this.http.post<InventoryItem>(`${this.apiUrl}/items`, payload);
  }

  updateItem(id: string, item: InventoryItem): Observable<InventoryItem> {
    const payload = {
      name: item.name,
      subcategoryId: item.subcategoriaId,
      codeTypeId: item.codigoTipoId,
      codeValue: item.codigoYavirac,
      cantidad: item.cantidad !== undefined ? Number(item.cantidad) : 1,
      dynamicValues: item.dynamicValues || {},
      estadoFisico: item.estadoFisico || 'BUENO',
      status: item.status || 'ACTIVO',
      isPending: !!item.isPending,
    };
    return this.http.patch<InventoryItem>(`${this.apiUrl}/items/${id}`, payload);
  }

  deleteItem(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/items/${id}`);
  }


  importItemsFromExcel(file: File, inventoryViewId?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const query = inventoryViewId ? `?inventoryViewId=${inventoryViewId}` : '';
    return this.http.post(`${this.apiUrl}/items/import${query}`, formData);
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/template`, { responseType: 'blob' });
  }
}

