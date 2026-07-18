import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl, FormsModule } from '@angular/forms';
import { InventoryService, InventoryItem, Subcategory, SubcategoryFieldAssociation, Category, CustomField } from '../services/inventory.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-items-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.css'
})
export class ItemsListComponent implements OnInit {
  items = signal<InventoryItem[]>([]);
  loading = signal(false);
  currentPage = signal(1);
  totalPages = signal(1);

  categories = signal<Category[]>([]);
  subcategories = signal<Subcategory[]>([]);
  customFields = signal<CustomField[]>([]);
  dynamicFields = signal<SubcategoryFieldAssociation[]>([]);

  // Navegación contextual jerárquica
  selectedView = signal<'BIENES_PUBLICOS' | 'INSUMOS' | 'BIBLIOTECA' | null>(null);
  selectedCategory = signal<Category | null>(null);
  selectedSubcategory = signal<Subcategory | null>(null);

  // Formularios base
  filterForm: FormGroup;
  itemForm: FormGroup;
  categoryForm: FormGroup;
  subcategoryForm: FormGroup;

  // Formulario de Atributos simplificado por Subcategoría
  customFieldForm: FormGroup;

  // Formulario de Reactivación interactiva
  reactivateForm: FormGroup;

  // Estados de Modales
  showFormModal = signal(false);
  showDetailModal = signal(false);
  showCategoryModal = signal(false);
  showSubcategoryModal = signal(false);
  showReactivateModal = signal(false);

  // Modal de Configuración por Subcategoría
  showCategoryConfigModal = signal(false);
  selectedSubcategoryForConfig = signal<Subcategory | null>(null);
  subcategoryConfigFields = signal<SubcategoryFieldAssociation[]>([]);

  // Reactivación interactiva
  selectedItemForReactivate = signal<InventoryItem | null>(null);
  reactivateCategory = signal<Category | null>(null);
  selectedReactivateSubId = signal<string>('');
  reactivateFields = signal<SubcategoryFieldAssociation[]>([]);

  modalLoading = signal(false);
  modalErrorMessage = signal<string | null>(null);

  // Edición
  editingItemId = signal<string | null>(null);
  editingCategoryId = signal<string | null>(null);
  editingSubcategoryId = signal<string | null>(null);

  selectedItem = signal<InventoryItem | null>(null);

  // Importación de Excel
  showImportModal = signal(false);
  importErrorMessage = signal<string | null>(null);
  importSuccessMessage = signal<string | null>(null);
  importErrorsList = signal<string[]>([]);
  selectedFile: File | null = null;

  // Opciones temporales para tipos OPTIONS_LIST
  newOption = '';
  tempOptions = signal<string[]>([]);
  editingCustomFieldAssoc = signal<SubcategoryFieldAssociation | null>(null);

  // Filtros dinámicos locales
  dynamicFilters = signal<Record<string, string>>({});

  // Estados para artículos huérfanos / sin clasificar
  viewingOrphans = signal(false);
  filterOrphansDeletedType = signal<'TODOS' | 'SIN_CLASIFICAR' | 'ELIMINADOS'>('TODOS');
  showDeleted = signal(false); // Control de visualización de eliminados
  showReclassifyModal = signal(false);
  selectedItemForReclassify = signal<InventoryItem | null>(null);
  reclassifyCategory = signal<Category | null>(null);
  viewsList = signal<any[]>([]);

  // Mapeo de IDs de vistas del backend (valores por defecto)
  private readonly viewIds: Record<string, string> = {
    'BIENES_PUBLICOS': 'e76d12b9-a730-45e6-9fdc-10b8cab5eff3',
    'INSUMOS': '5affdda0-ccf2-46a2-953c-4e2bb456020b',
    'BIBLIOTECA': '6b6a2f93-023e-47b2-b0fd-a214a887b74a'
  };

  // Filtrado local reactivo de ítems
  filteredItems = computed(() => {
    let list = this.items();

    // 1. Filtro por Código Yavirac
    const codeFilter = this.filterForm.get('codigoYavirac')?.value?.trim().toLowerCase();
    if (codeFilter) {
      list = list.filter(item => item.codigoYavirac?.toLowerCase().includes(codeFilter));
    }

    // 2. Filtro por Estado Físico
    const physicalFilter = this.filterForm.get('estadoFisico')?.value;
    if (physicalFilter) {
      list = list.filter(item => item.estadoFisico === physicalFilter);
    }

    // 3. Filtros dinámicos basados en campos personalizados
    const dynFilters = this.dynamicFilters();
    Object.keys(dynFilters).forEach((fieldId) => {
      const searchVal = dynFilters[fieldId];
      list = list.filter((item) => {
        const resolved = item.resolvedValues?.find(rv => rv.fieldId === fieldId);
        return resolved && String(resolved.value).toLowerCase().includes(searchVal);
      });
    });

    return list;
  });



  constructor(private readonly fb: FormBuilder, private readonly inventoryService: InventoryService) {
    this.filterForm = this.fb.group({
      codigoYavirac: [''],
      estadoFisico: [''],
      categoryId: [''],
      subcategoryId: [''],
    });

    this.itemForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      codigoYavirac: ['', [Validators.required]],
      subcategoriaId: [''],
      estadoFisico: ['BUENO', [Validators.required]],
      cantidad: [1, [Validators.required, Validators.min(0)]],
      status: ['ACTIVO', [Validators.required]],
      dynamicValues: this.fb.group({}),
    });

    this.categoryForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
    });

    this.subcategoryForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
    });

    this.customFieldForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      tipo: ['TEXT', [Validators.required]],
      isMandatory: [false],
    });

    this.reactivateForm = this.fb.group({
      dynamicValues: this.fb.group({}),
    });
  }

  ngOnInit(): void {
    this.loadMetadata();

    // Listeners para refresco automático de filtros en eliminados
    this.filterForm.get('categoryId')?.valueChanges.subscribe(() => {
      this.filterForm.get('subcategoryId')?.setValue('', { emitEvent: false });
      this.currentPage.set(1);
      this.loadItems();
    });
    this.filterForm.get('subcategoryId')?.valueChanges.subscribe(() => {
      this.currentPage.set(1);
      this.loadItems();
    });
    this.filterForm.get('estadoFisico')?.valueChanges.subscribe(() => {
      this.currentPage.set(1);
      this.loadItems();
    });
  }

  loadMetadata(): void {
    this.inventoryService.getViews().subscribe((data) => this.viewsList.set(data));
    this.inventoryService.getCategories().subscribe((data) => this.categories.set(data));
    this.inventoryService.getSubcategories().subscribe((data) => this.subcategories.set(data));
    this.inventoryService.getCustomFields().subscribe((data) => this.customFields.set(data));
  }

  // Navegación
  selectView(viewCode: 'BIENES_PUBLICOS' | 'INSUMOS' | 'BIBLIOTECA'): void {
    this.selectedView.set(viewCode);
    this.selectedCategory.set(null);
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.showDeleted.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
    this.loadMetadata();
  }

  selectCategory(cat: Category): void {
    this.selectedCategory.set(cat);
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.showDeleted.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
  }

  selectSubcategory(sub: Subcategory): void {
    this.selectedSubcategory.set(sub);
    this.viewingOrphans.set(false);
    this.showDeleted.set(false);
    this.currentPage.set(1);
    this.dynamicFilters.set({});
    this.loadItems();
  }

  selectOrphans(): void {
    const viewCode = this.selectedView();
    if (!viewCode) return;

    this.viewingOrphans.set(true);
    this.selectedCategory.set(null);
    this.selectedSubcategory.set(null);
    this.showDeleted.set(false);
    this.currentPage.set(1);
    this.dynamicFilters.set({});
    this.loadItems();
  }

  goBackToViews(): void {
    this.selectedView.set(null);
    this.selectedCategory.set(null);
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.showDeleted.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
  }

  goBackToCategories(): void {
    this.selectedCategory.set(null);
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.showDeleted.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
  }

  goBackToSubcategories(): void {
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.showDeleted.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
  }

  loadItems(): void {
    const viewCode = this.selectedView();
    if (!viewCode) return;

    this.loading.set(true);
    const filters = { ...this.filterForm.value };

    const currentView = this.viewsList().find(v => v.code === viewCode);
    const resolvedViewId = currentView ? currentView.id : this.viewIds[viewCode];

    if (this.viewingOrphans()) {
      filters.inventoryViewId = resolvedViewId;
      filters.status = 'INACTIVO';
    } else if (this.selectedSubcategory()) {
      filters.subcategoryId = this.selectedSubcategory()!.id;
    } else if (this.showDeleted()) {
      // Nivel de vista general para buscar eliminados en toda la sección
      filters.inventoryViewId = resolvedViewId;
      filters.status = 'INACTIVO';
    } else {
      this.loading.set(false);
      return;
    }

    this.inventoryService.getItems(this.currentPage(), 12, filters).subscribe({
      next: (res: any) => {
        this.items.set(res.data || []);
        this.totalPages.set(res.lastPage || 1);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadItems();
  }

  resetFilters(): void {
    this.filterForm.reset({
      codigoYavirac: '',
      estadoFisico: '',
    });
    this.dynamicFilters.set({});
    this.currentPage.set(1);
    this.loadItems();
  }

  setPage(page: number): void {
    this.currentPage.set(page);
    this.loadItems();
  }

  // Extracción de campos de filtro dinámicos basados en resolvedValues presentes en los productos cargados
  getDynamicFilterFields(): Array<{ fieldId: string; label: string }> {
    const fieldsMap = new Map<string, string>();
    this.items().forEach(item => {
      if (item.resolvedValues) {
        item.resolvedValues.forEach(val => {
          fieldsMap.set(val.fieldId, val.label);
        });
      }
    });
    return Array.from(fieldsMap.entries()).map(([fieldId, label]) => ({ fieldId, label }));
  }

  updateDynamicFilter(fieldId: string, value: string): void {
    const current = { ...this.dynamicFilters() };
    if (value.trim()) {
      current[fieldId] = value.trim().toLowerCase();
    } else {
      delete current[fieldId];
    }
    this.dynamicFilters.set(current);
  }

  // Métodos de Categorías
  openCategoryModal(cat?: Category): void {
    this.modalErrorMessage.set(null);
    if (cat) {
      this.editingCategoryId.set(cat.id);
      this.categoryForm.patchValue({ nombre: cat.nombre });
    } else {
      this.editingCategoryId.set(null);
      this.categoryForm.reset({ nombre: '' });
    }
    this.showCategoryModal.set(true);
  }

  closeCategoryModal(): void {
    this.showCategoryModal.set(false);
  }

  submitCategory(): void {
    if (this.categoryForm.invalid) return;

    const name = this.categoryForm.value.nombre.trim();
    const viewCode = this.selectedView();
    if (!viewCode) return;

    this.modalLoading.set(true);
    const catId = this.editingCategoryId();

    if (catId) {
      this.inventoryService.updateCategory(catId, { nombre: name, baseView: viewCode }).subscribe({
        next: () => {
          this.modalLoading.set(false);
          this.closeCategoryModal();
          this.loadMetadata();
          Swal.fire('¡Éxito!', 'Categoría actualizada correctamente.', 'success');
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al actualizar la categoría.');
        }
      });
    } else {
      this.inventoryService.createCategory({ nombre: name, baseView: viewCode }).subscribe({
        next: () => {
          this.modalLoading.set(false);
          this.closeCategoryModal();
          this.loadMetadata();
          Swal.fire('¡Éxito!', 'Categoría creada correctamente.', 'success');
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al crear la categoría.');
        }
      });
    }
  }

  deleteCategory(cat: Category): void {
    Swal.fire({
      title: `¿Eliminar categoría "${cat.nombre}"?`,
      text: 'Esta acción eliminará la categoría y sus subcategorías. Nota: El sistema impedirá la eliminación si existen artículos vinculados a esta categoría.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e05638',
      cancelButtonColor: '#4f5e71'
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventoryService.deleteCategory(cat.id).subscribe({
          next: () => {
            this.loadMetadata();
            Swal.fire('¡Eliminada!', 'Categoría eliminada con éxito.', 'success');
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar la categoría.', 'error');
          }
        });
      }
    });
  }

  // Métodos de Subcategorías
  openSubcategoryModal(sub?: Subcategory): void {
    this.modalErrorMessage.set(null);
    if (sub) {
      this.editingSubcategoryId.set(sub.id);
      this.subcategoryForm.patchValue({ nombre: sub.nombre });
    } else {
      this.editingSubcategoryId.set(null);
      this.subcategoryForm.reset({ nombre: '' });
    }
    this.showSubcategoryModal.set(true);
  }

  closeSubcategoryModal(): void {
    this.showSubcategoryModal.set(false);
  }

  submitSubcategory(): void {
    if (this.subcategoryForm.invalid) return;

    const name = this.subcategoryForm.value.nombre.trim();
    const cat = this.selectedCategory();
    if (!cat) return;

    this.modalLoading.set(true);
    const subId = this.editingSubcategoryId();

    if (subId) {
      this.inventoryService.updateSubcategory(subId, { nombre: name, categoriaId: cat.id }).subscribe({
        next: () => {
          this.modalLoading.set(false);
          this.closeSubcategoryModal();
          this.loadMetadata();
          Swal.fire('¡Éxito!', 'Subcategoría actualizada correctamente.', 'success');
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al actualizar la subcategoría.');
        }
      });
    } else {
      this.inventoryService.createSubcategory({ nombre: name, categoriaId: cat.id }).subscribe({
        next: () => {
          this.modalLoading.set(false);
          this.closeSubcategoryModal();
          this.loadMetadata();
          Swal.fire('¡Éxito!', 'Subcategoría creada correctamente.', 'success');
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al crear la subcategoría.');
        }
      });
    }
  }

  deleteSubcategory(sub: Subcategory): void {
    Swal.fire({
      title: `¿Eliminar subcategoría "${sub.nombre}"?`,
      text: 'Nota: El sistema impedirá la eliminación si existen artículos asociados a esta subcategoría.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e05638',
      cancelButtonColor: '#4f5e71'
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventoryService.deleteSubcategory(sub.id).subscribe({
          next: () => {
            this.loadMetadata();
            Swal.fire('¡Eliminada!', 'Subcategoría eliminada con éxito.', 'success');
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar la subcategoría.', 'error');
          }
        });
      }
    });
  }

  // Filtrado de Datos
  getFilteredCategories(): Category[] {
    const viewCode = this.selectedView();
    if (!viewCode) return [];
    return this.categories().filter((cat) => cat.baseView === viewCode);
  }

  getSubcategoriesForCategory(catId: string): Subcategory[] {
    return this.subcategories().filter((sub) => sub.categoriaId === catId);
  }

  // Control de Artículos
  isFieldInvalid(field: string): boolean {
    const ctrl = this.itemForm.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  preventNegativeSign(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === 'e' || event.key === 'E' || event.key === '+') {
      event.preventDefault();
    }
  }

  onCantidadInput(event: any): void {
    const val = Number(event.target.value);
    if (val < 0) {
      this.itemForm.get('cantidad')?.setValue(0);
    }
  }

  loadSubcategoryDynamicFields(subcategoryId: string, callback?: () => void): void {
    const dynamicGroup = this.itemForm.get('dynamicValues') as FormGroup;

    Object.keys(dynamicGroup.controls).forEach((key) => {
      dynamicGroup.removeControl(key);
    });
    this.dynamicFields.set([]);

    if (!subcategoryId) return;

    this.inventoryService.getSubcategoryFields(subcategoryId).subscribe((assocFields) => {
      this.dynamicFields.set(assocFields);

      assocFields.forEach((assoc) => {
        const validators = assoc.isMandatory ? [Validators.required] : [];
        dynamicGroup.addControl(assoc.customFieldId, new FormControl('', validators));
      });

      if (callback) callback();
    });
  }

  isDynamicFieldInvalid(fieldId: string): boolean {
    const dynamicGroup = this.itemForm.get('dynamicValues') as FormGroup;
    const ctrl = dynamicGroup.get(fieldId);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  openCreateModal(): void {
    const sub = this.selectedSubcategory();
    if (!sub) return;

    const cat = this.categories().find(c => c.id === sub.categoriaId);
    if (!cat) return;

    this.editingItemId.set(null);
    this.modalErrorMessage.set(null);
    this.dynamicFields.set([]);

    this.itemForm.reset({
      name: '',
      codigoYavirac: '',
      subcategoriaId: sub.id,
      estadoFisico: 'BUENO',
      cantidad: this.selectedView() === 'INSUMOS' ? 0 : 1,
      status: 'ACTIVO',
    });

    if (this.selectedView() === 'INSUMOS') {
      this.itemForm.get('cantidad')?.enable();
    } else {
      this.itemForm.get('cantidad')?.disable();
    }

    const dynamicGroup = this.itemForm.get('dynamicValues') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach((key) => {
      dynamicGroup.removeControl(key);
    });

    // Cargar campos dinámicos directamente de la subcategoría
    this.loadSubcategoryDynamicFields(sub.id);

    this.showFormModal.set(true);
  }

  openEditModal(item: InventoryItem): void {
    this.editingItemId.set(item.id || null);
    this.modalErrorMessage.set(null);

    this.itemForm.patchValue({
      name: item.name || '',
      codigoYavirac: item.codigoYavirac,
      subcategoriaId: item.subcategoriaId,
      estadoFisico: item.estadoFisico,
      cantidad: item.cantidad ?? 1,
      status: item.status || 'ACTIVO',
    });

    if (this.selectedView() === 'INSUMOS') {
      this.itemForm.get('cantidad')?.enable();
    } else {
      this.itemForm.get('cantidad')?.disable();
      this.itemForm.get('cantidad')?.setValue(1);
    }

    // Obtener la categoría del ítem a editar
    const sub = this.subcategories().find(s => s.id === item.subcategoriaId);
    const cat = sub ? this.categories().find(c => c.id === sub.categoriaId) : null;

    if (sub) {
      this.loadSubcategoryDynamicFields(sub.id, () => {
        const dynamicGroup = this.itemForm.get('dynamicValues') as FormGroup;
        dynamicGroup.patchValue(item.dynamicValues || {});
        this.showFormModal.set(true);
      });
    } else {
      this.showFormModal.set(true);
    }
  }

  closeFormModal(): void {
    this.showFormModal.set(false);
  }

  onItemSubmit(): void {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }

    const subId = this.itemForm.get('subcategoriaId')?.value;
    if (!subId) {
      this.modalErrorMessage.set('No se ha seleccionado ninguna subcategoría.');
      return;
    }
    const sub = this.subcategories().find(s => s.id === subId);
    if (!sub) {
      this.modalErrorMessage.set('La subcategoría asociada al artículo no es válida.');
      return;
    }
    const cat = this.categories().find(c => c.id === sub.categoriaId);

    if (!cat) {
      this.modalErrorMessage.set('No se pudo encontrar la categoría asociada al artículo.');
      return;
    }

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    {
      const val = this.itemForm.getRawValue();
      const payload: InventoryItem = {
        name: val.name.trim(),
        codigoYavirac: val.codigoYavirac.trim(),
        subcategoriaId: sub.id,
        estadoFisico: val.estadoFisico,
        dynamicValues: val.dynamicValues,
        cantidad: this.selectedView() === 'INSUMOS' ? (val.cantidad ?? 0) : 1,
        status: val.status,
      };

      const itemId = this.editingItemId();

      if (itemId) {
        this.inventoryService.updateItem(itemId, payload).subscribe({
          next: () => {
            this.modalLoading.set(false);
            this.closeFormModal();
            this.loadItems();
            Swal.fire('¡Éxito!', 'Artículo actualizado correctamente.', 'success');
          },
          error: (err) => {
            this.modalLoading.set(false);
            this.modalErrorMessage.set(err.error?.message || 'Error al guardar el artículo.');
          },
        });
      } else {
        this.inventoryService.createItem(payload).subscribe({
          next: () => {
            this.modalLoading.set(false);
            this.closeFormModal();
            this.loadItems();
            Swal.fire('¡Éxito!', 'Artículo registrado correctamente.', 'success');
          },
          error: (err) => {
            this.modalLoading.set(false);
            this.modalErrorMessage.set(err.error?.message || 'Error al crear el artículo.');
          },
        });
      }
    }
  }

  deleteItem(item: InventoryItem): void {
    if (!item.id) return;

    Swal.fire({
      title: `¿Eliminar artículo "${item.name}"?`,
      text: `El artículo se desvinculará de su categoría, subcategoría y espacio físico asignado. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading.set(true);
        this.inventoryService.deleteItem(item.id!).subscribe({
          next: () => {
            this.loading.set(false);
            Swal.fire('¡Eliminado!', 'El artículo ha sido eliminado y desvinculado.', 'success');
            this.loadItems();
          },
          error: (err) => {
            this.loading.set(false);
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar el artículo.', 'error');
          },
        });
      }
    });
  }

  viewDetail(item: InventoryItem): void {
    if (!item.id) return;
    this.selectedItem.set(null);
    this.showDetailModal.set(true);

    this.inventoryService.getItem(item.id).subscribe((detailed) => {
      this.selectedItem.set(detailed);
    });
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedItem.set(null);
  }

  // Importación
  openImportModal(): void {
    this.selectedFile = null;
    this.importErrorMessage.set(null);
    this.importSuccessMessage.set(null);
    this.importErrorsList.set([]);
    this.showImportModal.set(true);
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.importErrorMessage.set(null);
    }
  }

  downloadTemplate(): void {
    const viewCode = this.selectedView();
    const currentView = this.viewsList().find(v => v.code === viewCode);
    const viewId = currentView ? currentView.id : undefined;

    this.inventoryService.downloadTemplate(viewId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = viewCode ? `plantilla_importacion_${viewCode.toLowerCase()}.xlsx` : 'plantilla_importacion_inventario.xlsx';
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error al descargar la plantilla', err);
      }
    });
  }

  exportCurrentInventory(): void {
    const viewCode = this.selectedView();
    const currentView = this.viewsList().find(v => v.code === viewCode);
    if (!currentView) return;

    this.loading.set(true);
    this.inventoryService.exportItemsToExcel(currentView.id).subscribe({
      next: (blob) => {
        this.loading.set(false);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = `inventario_exportado_${viewCode?.toLowerCase()}.xlsx`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        Swal.fire('¡Éxito!', 'Inventario exportado a Excel correctamente.', 'success');
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Error al exportar inventario', err);
        Swal.fire('Error', 'No se pudo exportar el inventario.', 'error');
      }
    });
  }

  onImportSubmit(): void {
    if (!this.selectedFile) {
      this.importErrorMessage.set('Por favor, selecciona un archivo.');
      return;
    }

    this.modalLoading.set(true);
    this.importErrorMessage.set(null);
    this.importSuccessMessage.set(null);
    this.importErrorsList.set([]);

    const viewCode = this.selectedView();
    if (!viewCode) return;
    const viewId = this.viewIds[viewCode];

    this.inventoryService.importItemsFromExcel(this.selectedFile, viewId).subscribe({
      next: (res: any) => {
        this.modalLoading.set(false);
        this.importSuccessMessage.set(res.message || 'Importación completada con éxito.');
        setTimeout(() => {
          this.closeImportModal();
          this.loadMetadata();
          if (this.selectedSubcategory()) {
            this.loadItems();
          }
        }, 2000);
      },
      error: (err) => {
        this.modalLoading.set(false);
        const errorData = err.error;
        if (errorData && errorData.errors && Array.isArray(errorData.errors)) {
          this.importErrorMessage.set(errorData.message || 'Se encontraron errores en el archivo.');
          this.importErrorsList.set(errorData.errors);
        } else {
          this.importErrorMessage.set(errorData?.message || 'Error al procesar el archivo Excel.');
        }
      }
    });
  }

  // ==========================================================
  // CONFIGURACIÓN DE ATRIBUTOS DINÁMICOS POR SUBCATEGORÍA
  // ==========================================================
  openSubcategoryConfig(sub: Subcategory): void {
    this.modalErrorMessage.set(null);
    this.selectedSubcategoryForConfig.set(sub);
    this.subcategoryConfigFields.set([]);
    this.tempOptions.set([]);
    this.newOption = '';

    this.customFieldForm.reset({ nombre: '', tipo: 'TEXT', isMandatory: false });

    this.modalLoading.set(true);
    this.reloadSubcategoryConfigFields(sub.id);
    this.showCategoryConfigModal.set(true);
  }

  closeCategoryConfig(): void {
    this.showCategoryConfigModal.set(false);
    this.selectedSubcategoryForConfig.set(null);
    this.cancelEditCustomField();
  }

  reloadSubcategoryConfigFields(subcategoryId: string): void {
    this.inventoryService.getSubcategoryFields(subcategoryId).subscribe({
      next: (fields) => {
        this.subcategoryConfigFields.set(fields);
        this.modalLoading.set(false);
      },
      error: () => {
        this.modalLoading.set(false);
        this.modalErrorMessage.set('Error al cargar atributos de la subcategoría.');
      }
    });
  }

  addTempOption(): void {
    const opt = this.newOption.trim();
    if (opt && !this.tempOptions().includes(opt)) {
      this.tempOptions.set([...this.tempOptions(), opt]);
      this.newOption = '';
    }
  }

  removeTempOption(opt: string): void {
    this.tempOptions.set(this.tempOptions().filter((o) => o !== opt));
  }

  startEditCustomField(assoc: SubcategoryFieldAssociation): void {
    this.editingCustomFieldAssoc.set(assoc);
    this.customFieldForm.patchValue({
      nombre: assoc.customField?.nombre || '',
      tipo: assoc.customField?.tipo || 'TEXT',
      isMandatory: assoc.isMandatory || false
    });
    if (assoc.customField?.tipo === 'OPTIONS_LIST') {
      this.tempOptions.set([...(assoc.customField?.opciones || [])]);
    } else {
      this.tempOptions.set([]);
    }
  }

  cancelEditCustomField(): void {
    this.editingCustomFieldAssoc.set(null);
    this.customFieldForm.reset({ nombre: '', tipo: 'TEXT', isMandatory: false });
    this.tempOptions.set([]);
    this.newOption = '';
  }

  submitCustomFieldForSubcategory(): void {
    if (this.customFieldForm.invalid) return;
    const sub = this.selectedSubcategoryForConfig();
    if (!sub) return;

    const val = this.customFieldForm.value;
    const isOptionsList = val.tipo === 'OPTIONS_LIST';
    const opciones = isOptionsList ? this.tempOptions() : null;

    if (isOptionsList && (!opciones || opciones.length === 0)) {
      this.modalErrorMessage.set('Debes agregar al menos una opción para el tipo lista de opciones.');
      return;
    }

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    const editAssoc = this.editingCustomFieldAssoc();

    if (editAssoc) {
      // MODO EDICIÓN
      this.inventoryService.updateCustomField(editAssoc.customFieldId, {
        nombre: val.nombre.trim(),
        tipo: val.tipo,
        opciones
      }).subscribe({
        next: (updatedField) => {
          this.inventoryService.associateFieldToSubcategory(sub.id, {
            customFieldId: updatedField.id,
            sortOrder: editAssoc.orden,
            isMandatory: !!val.isMandatory
          }).subscribe({
            next: () => {
              this.cancelEditCustomField();
              this.reloadSubcategoryConfigFields(sub.id);
              this.loadMetadata();
              Swal.fire('¡Éxito!', 'Atributo actualizado correctamente.', 'success');
            },
            error: (err) => {
              this.modalLoading.set(false);
              this.modalErrorMessage.set('Error al actualizar la obligatoriedad del atributo.');
            }
          });
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al actualizar el atributo.');
        }
      });
    } else {
      // MODO REGISTRO
      this.inventoryService.createCustomField({ nombre: val.nombre.trim(), tipo: val.tipo, opciones }).subscribe({
        next: (newField) => {
          const sortOrder = this.subcategoryConfigFields().length + 1;
          const isMandatory = !!val.isMandatory;

          this.inventoryService.associateFieldToSubcategory(sub.id, {
            customFieldId: newField.id,
            sortOrder,
            isMandatory
          }).subscribe({
            next: () => {
              this.customFieldForm.reset({ nombre: '', tipo: 'TEXT', isMandatory: false });
              this.tempOptions.set([]);
              this.reloadSubcategoryConfigFields(sub.id);
              this.loadMetadata();
              Swal.fire('¡Éxito!', 'Atributo configurado correctamente en esta subcategoría.', 'success');
            },
            error: () => {
              this.modalLoading.set(false);
              this.modalErrorMessage.set('Error al vincular el atributo a la subcategoría.');
            }
          });
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al crear el atributo.');
        }
      });
    }
  }

  removeFieldFromSubcategory(assoc: SubcategoryFieldAssociation): void {
    const sub = this.selectedSubcategoryForConfig();
    if (!sub) return;

    Swal.fire({
      title: `¿Eliminar atributo "${assoc.customField?.nombre}" de la subcategoría?`,
      text: 'Los artículos de esta subcategoría perderán el valor de esta especificación técnica.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e05638',
      cancelButtonColor: '#4f5e71'
    }).then((result) => {
      if (result.isConfirmed) {
        this.modalLoading.set(true);
        this.inventoryService.removeFieldFromSubcategory(sub.id, assoc.customFieldId).subscribe({
          next: () => {
            this.reloadSubcategoryConfigFields(sub.id);
            this.loadMetadata();
            Swal.fire('¡Removido!', 'Atributo desvinculado de la subcategoría con éxito.', 'success');
          },
          error: (err) => {
            this.modalLoading.set(false);
            Swal.fire('Error', err.error?.message || 'No se pudo desvincular el atributo.', 'error');
          }
        });
      }
    });
  }

  // ==========================================================
  // RECLASIFICACIÓN DE ARTÍCULOS HUÉRFANOS
  // ==========================================================
  openReclassifyModal(item: InventoryItem): void {
    this.selectedItemForReclassify.set(item);
    this.reclassifyCategory.set(null);
    this.showReclassifyModal.set(true);
  }

  closeReclassifyModal(): void {
    this.showReclassifyModal.set(false);
    this.selectedItemForReclassify.set(null);
    this.reclassifyCategory.set(null);
  }

  confirmReclassify(subId: string): void {
    const item = this.selectedItemForReclassify();
    if (!item || !item.id) return;

    this.modalLoading.set(true);
    this.inventoryService.updateItem(item.id, {
      ...item,
      subcategoriaId: subId
    }).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.closeReclassifyModal();
        this.loadItems();
        Swal.fire('¡Clasificado!', 'El artículo ha sido asignado a la subcategoría correctamente.', 'success');
      },
      error: (err) => {
        this.modalLoading.set(false);
        Swal.fire('Error', err.error?.message || 'No se pudo clasificar el artículo.', 'error');
      }
    });
  }

  toggleShowDeleted(): void {
    this.showDeleted.update((val) => !val);
    this.filterForm.patchValue({
      codigoYavirac: '',
      estadoFisico: '',
      categoryId: '',
      subcategoryId: '',
    }, { emitEvent: false });
    this.currentPage.set(1);
    this.loadItems();
  }

  reactivateItem(item: InventoryItem): void {
    if (!item.id) return;
    this.openReactivateModal(item);
  }

  openReactivateModal(item: InventoryItem): void {
    this.modalErrorMessage.set(null);
    this.modalLoading.set(false);
    this.selectedItemForReactivate.set(item);
    this.reactivateCategory.set(null);
    this.selectedReactivateSubId.set('');
    this.reactivateFields.set([]);
    
    const dynamicGroup = this.reactivateForm.get('dynamicValues') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
    this.reactivateForm.reset();

    this.showReactivateModal.set(true);
  }

  closeReactivateModal(): void {
    this.showReactivateModal.set(false);
    this.selectedItemForReactivate.set(null);
    this.reactivateCategory.set(null);
    this.selectedReactivateSubId.set('');
    this.reactivateFields.set([]);
  }

  onReactivateCategoryChange(catId: string): void {
    this.selectedReactivateSubId.set('');
    this.reactivateFields.set([]);
    if (catId) {
      const cat = this.categories().find(c => c.id === catId);
      this.reactivateCategory.set(cat || null);
    } else {
      this.reactivateCategory.set(null);
    }
  }

  onReactivateSubcategoryChange(subId: string): void {
    this.selectedReactivateSubId.set(subId);
    this.reactivateFields.set([]);
    this.modalLoading.set(true);

    if (!subId) {
      this.modalLoading.set(false);
      return;
    }

    this.inventoryService.getSubcategoryFields(subId).subscribe({
      next: (fields) => {
        this.reactivateFields.set(fields);
        
        const dynamicGroup = this.reactivateForm.get('dynamicValues') as FormGroup;
        Object.keys(dynamicGroup.controls).forEach(key => dynamicGroup.removeControl(key));
        
        fields.forEach((assoc) => {
          const validators = assoc.isMandatory ? [Validators.required] : [];
          dynamicGroup.addControl(assoc.customFieldId, new FormControl('', validators));
        });
        
        this.modalLoading.set(false);
      },
      error: () => {
        this.modalLoading.set(false);
        this.modalErrorMessage.set('Error al cargar especificaciones de la subcategoría.');
      }
    });
  }

  isReactivateFieldInvalid(fieldId: string): boolean {
    const group = this.reactivateForm.get('dynamicValues') as FormGroup;
    const ctrl = group.get(fieldId);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  submitReactivate(): void {
    if (this.reactivateForm.invalid || !this.selectedReactivateSubId()) {
      this.reactivateForm.markAllAsTouched();
      return;
    }

    const item = this.selectedItemForReactivate();
    if (!item || !item.id) return;

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    const payload = {
      status: 'ACTIVO',
      subcategoryId: this.selectedReactivateSubId(),
      dynamicValues: this.reactivateForm.get('dynamicValues')?.value || {}
    };

    this.inventoryService.updateItem(item.id, payload).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.closeReactivateModal();
        this.loadItems();
        Swal.fire('¡Reactivado!', 'El artículo ha sido reactivado y clasificado exitosamente.', 'success');
      },
      error: (err) => {
        this.modalLoading.set(false);
        const errorMsg = Array.isArray(err.error?.message)
          ? err.error.message.join(', ')
          : (err.error?.message || 'Error al reactivar el artículo.');
        this.modalErrorMessage.set(errorMsg);
      }
    });
  }
}
