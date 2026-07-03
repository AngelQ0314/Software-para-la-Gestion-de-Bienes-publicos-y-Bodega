import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  codigoYavirac: string;
  codigoAuxiliar: string | null;
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
}

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;

  constructor(private readonly http: HttpClient) {}

  // ==========================================
  // CATEGORÍAS
  // ==========================================
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  createCategory(data: { nombre: string; baseView: string }): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, data);
  }

  updateCategory(id: string, data: { nombre: string; baseView: string }): Observable<Category> {
    return this.http.patch<Category>(`${this.apiUrl}/categories/${id}`, data);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`);
  }

  // ==========================================
  // SUBCATEGORÍAS
  // ==========================================
  getSubcategories(): Observable<Subcategory[]> {
    return this.http.get<Subcategory[]>(`${this.apiUrl}/subcategories`);
  }

  createSubcategory(data: { nombre: string; categoriaId: string }): Observable<Subcategory> {
    return this.http.post<Subcategory>(`${this.apiUrl}/subcategories`, data);
  }

  updateSubcategory(id: string, data: { nombre: string; categoriaId: string }): Observable<Subcategory> {
    return this.http.patch<Subcategory>(`${this.apiUrl}/subcategories/${id}`, data);
  }

  deleteSubcategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/subcategories/${id}`);
  }

  // ==========================================
  // CAMPOS PERSONALIZADOS
  // ==========================================
  getCustomFields(): Observable<CustomField[]> {
    return this.http.get<CustomField[]>(`${this.apiUrl}/custom-fields`);
  }

  createCustomField(data: { nombre: string; tipo: string; opciones?: string[] | null }): Observable<CustomField> {
    return this.http.post<CustomField>(`${this.apiUrl}/custom-fields`, data);
  }

  updateCustomField(id: string, data: { nombre: string; tipo: string; opciones?: string[] | null }): Observable<CustomField> {
    return this.http.patch<CustomField>(`${this.apiUrl}/custom-fields/${id}`, data);
  }

  deleteCustomField(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/custom-fields/${id}`);
  }

  // ==========================================
  // TIPOS DE CÓDIGO
  // ==========================================
  getCodeTypes(): Observable<CodeType[]> {
    return this.http.get<CodeType[]>(`${this.apiUrl}/code-types`);
  }

  createCodeType(data: { nombre: string }): Observable<CodeType> {
    return this.http.post<CodeType>(`${this.apiUrl}/code-types`, data);
  }

  updateCodeType(id: string, data: { nombre: string }): Observable<CodeType> {
    return this.http.patch<CodeType>(`${this.apiUrl}/code-types/${id}`, data);
  }

  deleteCodeType(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/code-types/${id}`);
  }

  // ==========================================
  // ASOCIACIÓN DE CAMPOS A TIPO DE CÓDIGO
  // ==========================================
  getCodeTypeFields(codeTypeId: string): Observable<CodeTypeFieldAssociation[]> {
    return this.http.get<CodeTypeFieldAssociation[]>(`${this.apiUrl}/code-types/${codeTypeId}/fields`);
  }

  associateCodeTypeFields(
    codeTypeId: string,
    fields: Array<{ customFieldId: string; orden: number; isMandatory: boolean }>
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/code-types/${codeTypeId}/fields`, { fields });
  }

  // ==========================================
  // ELEMENTOS DE INVENTARIO
  // ==========================================
  getItems(page: number = 1, limit: number = 10, filters: any = {}): Observable<{
    items: InventoryItem[];
    meta: any;
  }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    Object.keys(filters).forEach((key) => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });

    return this.http.get<{ items: InventoryItem[]; meta: any }>(`${this.apiUrl}/items`, { params });
  }

  getItem(id: string): Observable<InventoryItem> {
    return this.http.get<InventoryItem>(`${this.apiUrl}/items/${id}`);
  }

  createItem(item: InventoryItem): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.apiUrl}/items`, item);
  }

  updateItem(id: string, item: InventoryItem): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(`${this.apiUrl}/items/${id}`, item);
  }

  deleteItem(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/items/${id}`);
  }
}
