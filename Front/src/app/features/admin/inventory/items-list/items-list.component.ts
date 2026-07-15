import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl, FormsModule } from '@angular/forms';
import { InventoryService, InventoryItem, Subcategory, CodeType, CodeTypeFieldAssociation, Category, CustomField } from '../services/inventory.service';
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
  codeTypes = signal<CodeType[]>([]);
  customFields = signal<CustomField[]>([]);
  dynamicFields = signal<CodeTypeFieldAssociation[]>([]);

  // Navegación contextual jerárquica
  selectedView = signal<'BIENES_PUBLICOS' | 'INSUMOS' | 'BIBLIOTECA' | null>(null);
  selectedCategory = signal<Category | null>(null);
  selectedSubcategory = signal<Subcategory | null>(null);

  // Formularios base
  filterForm: FormGroup;
  itemForm: FormGroup;
  categoryForm: FormGroup;
  subcategoryForm: FormGroup;

  // Formulario de Atributos simplificado por Categoría
  customFieldForm: FormGroup;

  // Estados de Modales
  showFormModal = signal(false);
  showDetailModal = signal(false);
  showCategoryModal = signal(false);
  showSubcategoryModal = signal(false);

  // Modal de Configuración por Categoría
  showCategoryConfigModal = signal(false);
  selectedCategoryForConfig = signal<Category | null>(null);
  categoryConfigFields = signal<CodeTypeFieldAssociation[]>([]);

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

  // Filtros dinámicos locales
  dynamicFilters = signal<Record<string, string>>({});

  // Estados para artículos huérfanos / sin clasificar
  viewingOrphans = signal(false);
  showReclassifyModal = signal(false);
  selectedItemForReclassify = signal<InventoryItem | null>(null);
  reclassifyCategory = signal<Category | null>(null);

  // Mapeo de IDs de vistas del backend
  private readonly viewIds: Record<string, string> = {
    'BIENES_PUBLICOS': 'e21d61e0-32e5-4161-8a63-23111e6fb31d',
    'INSUMOS': '1b7ed472-b376-438f-94cb-9cac62346eaa',
    'BIBLIOTECA': 'ad14341f-ba88-420a-90c7-39de01cbbaa0'
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
  }

  ngOnInit(): void {
    this.loadMetadata();
  }

  loadMetadata(): void {
    this.inventoryService.getCategories().subscribe((data) => this.categories.set(data));
    this.inventoryService.getSubcategories().subscribe((data) => this.subcategories.set(data));
    this.inventoryService.getCodeTypes().subscribe((data) => this.codeTypes.set(data));
    this.inventoryService.getCustomFields().subscribe((data) => this.customFields.set(data));
  }

  // Navegación
  selectView(viewCode: 'BIENES_PUBLICOS' | 'INSUMOS' | 'BIBLIOTECA'): void {
    this.selectedView.set(viewCode);
    this.selectedCategory.set(null);
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
    this.loadMetadata();
  }

  selectCategory(cat: Category): void {
    this.selectedCategory.set(cat);
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
  }

  selectSubcategory(sub: Subcategory): void {
    this.selectedSubcategory.set(sub);
    this.viewingOrphans.set(false);
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
    this.currentPage.set(1);
    this.dynamicFilters.set({});
    this.loadItems();
  }

  goBackToViews(): void {
    this.selectedView.set(null);
    this.selectedCategory.set(null);
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
  }

  goBackToCategories(): void {
    this.selectedCategory.set(null);
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
  }

  goBackToSubcategories(): void {
    this.selectedSubcategory.set(null);
    this.viewingOrphans.set(false);
    this.items.set([]);
    this.dynamicFilters.set({});
  }

  // Carga de Ítems
  loadItems(): void {
    const viewCode = this.selectedView();
    if (!viewCode) return;

    this.loading.set(true);
    const filters = { ...this.filterForm.value };

    if (this.viewingOrphans()) {
      filters.inventoryViewId = this.viewIds[viewCode];
      filters.onlyOrphans = true;
    } else {
      const sub = this.selectedSubcategory();
      if (!sub) {
        this.loading.set(false);
        return;
      }
      filters.subcategoryId = sub.id;
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
      text: 'Esta acción eliminará todas las subcategorías asociadas de forma automática (en cascada) y desvinculará sus artículos.',
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
      text: 'Esta acción desvinculará todos los artículos asociados, los cuales quedarán libres en bodega.',
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

  onCodeTypeChange(codeTypeId: string, callback?: () => void): void {
    const dynamicGroup = this.itemForm.get('dynamicValues') as FormGroup;

    Object.keys(dynamicGroup.controls).forEach((key) => {
      dynamicGroup.removeControl(key);
    });
    this.dynamicFields.set([]);

    if (!codeTypeId) return;

    this.inventoryService.getCodeTypeFields(codeTypeId).subscribe((assocFields) => {
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

    // Cargar campos dinámicos de forma automática
    this.getOrCreateCodeTypeForCategory(cat, (codeTypeId) => {
      if (codeTypeId) {
        this.onCodeTypeChange(codeTypeId);
      }
    });

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

    if (cat) {
      this.getOrCreateCodeTypeForCategory(cat, (codeTypeId) => {
        if (codeTypeId) {
          this.onCodeTypeChange(codeTypeId, () => {
            const dynamicGroup = this.itemForm.get('dynamicValues') as FormGroup;
            dynamicGroup.patchValue(item.dynamicValues || {});
            this.showFormModal.set(true);
          });
        } else {
          this.showFormModal.set(true);
        }
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

    const sub = this.selectedSubcategory();
    if (!sub) {
      this.modalErrorMessage.set('No se ha seleccionado ninguna subcategoría.');
      return;
    }
    const cat = this.categories().find(c => c.id === sub.categoriaId);

    if (!cat) {
      this.modalErrorMessage.set('No se pudo encontrar la categoría asociada al artículo.');
      return;
    }

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    this.getOrCreateCodeTypeForCategory(cat, (codeTypeId) => {
      if (!codeTypeId) {
        this.modalLoading.set(false);
        this.modalErrorMessage.set('No se pudo resolver el tipo de código de la categoría.');
        return;
      }

      const val = this.itemForm.getRawValue();
      const payload: InventoryItem = {
        name: val.name.trim(),
        codigoYavirac: val.codigoYavirac.trim(),
        subcategoriaId: sub.id,
        codigoTipoId: codeTypeId,
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
    });
  }

  deleteItem(item: InventoryItem): void {
    if (!item.id) return;

    Swal.fire({
      title: `¿Eliminar artículo "${item.name}"?`,
      text: `Código Yavirac: ${item.codigoYavirac}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e05638',
      cancelButtonColor: '#4f5e71'
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventoryService.deleteItem(item.id!).subscribe({
          next: () => {
            this.loadItems();
            Swal.fire('¡Eliminado!', 'Artículo eliminado con éxito.', 'success');
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar el artículo.', 'error');
          }
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
    this.inventoryService.downloadTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla_importacion_inventario.xlsx';
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
  // CONFIGURACIÓN DE ATRIBUTOS DINÁMICOS POR CATEGORÍA
  // ==========================================================
  getOrCreateCodeTypeForCategory(cat: Category, callback: (codeTypeId: string) => void): void {
    const match = this.codeTypes().find(ct => ct.nombre.trim().toLowerCase() === cat.nombre.trim().toLowerCase());
    if (match) {
      callback(match.id);
    } else {
      this.inventoryService.createCodeType({ nombre: cat.nombre }).subscribe({
        next: (newCt) => {
          this.loadMetadata();
          this.codeTypes.set([...this.codeTypes(), newCt]);
          callback(newCt.id);
        },
        error: () => {
          callback('');
        }
      });
    }
  }

  openCategoryConfig(cat: Category): void {
    this.modalErrorMessage.set(null);
    this.selectedCategoryForConfig.set(cat);
    this.categoryConfigFields.set([]);
    this.tempOptions.set([]);
    this.newOption = '';

    this.customFieldForm.reset({ nombre: '', tipo: 'TEXT', isMandatory: false });

    this.modalLoading.set(true);
    this.getOrCreateCodeTypeForCategory(cat, (codeTypeId) => {
      if (codeTypeId) {
        this.reloadCategoryConfigFields(codeTypeId);
      } else {
        this.modalLoading.set(false);
        this.modalErrorMessage.set('No se pudo inicializar la configuración de la categoría.');
      }
    });

    this.showCategoryConfigModal.set(true);
  }

  closeCategoryConfig(): void {
    this.showCategoryConfigModal.set(false);
    this.selectedCategoryForConfig.set(null);
  }

  reloadCategoryConfigFields(codeTypeId: string): void {
    this.inventoryService.getCodeTypeFields(codeTypeId).subscribe({
      next: (fields) => {
        this.categoryConfigFields.set(fields);
        this.modalLoading.set(false);
      },
      error: () => {
        this.modalLoading.set(false);
        this.modalErrorMessage.set('Error al cargar atributos de la categoría.');
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

  submitCustomFieldForCategory(): void {
    if (this.customFieldForm.invalid) return;
    const cat = this.selectedCategoryForConfig();
    if (!cat) return;

    const val = this.customFieldForm.value;
    const isOptionsList = val.tipo === 'OPTIONS_LIST';
    const opciones = isOptionsList ? this.tempOptions() : null;

    if (isOptionsList && (!opciones || opciones.length === 0)) {
      this.modalErrorMessage.set('Debes agregar al menos una opción para el tipo lista de opciones.');
      return;
    }

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    this.getOrCreateCodeTypeForCategory(cat, (codeTypeId) => {
      if (!codeTypeId) {
        this.modalLoading.set(false);
        this.modalErrorMessage.set('No se pudo resolver la estructura de la categoría.');
        return;
      }

      this.inventoryService.createCustomField({ nombre: val.nombre.trim(), tipo: val.tipo, opciones }).subscribe({
        next: (newField) => {
          const sortOrder = this.categoryConfigFields().length + 1;
          const isMandatory = !!val.isMandatory;

          this.inventoryService.associateFieldToCodeTypeSingle(codeTypeId, {
            customFieldId: newField.id,
            sortOrder,
            isMandatory
          }).subscribe({
            next: () => {
              this.customFieldForm.reset({ nombre: '', tipo: 'TEXT', isMandatory: false });
              this.tempOptions.set([]);
              this.reloadCategoryConfigFields(codeTypeId);
              this.loadMetadata();
              Swal.fire('¡Éxito!', 'Atributo configurado correctamente en esta categoría.', 'success');
            },
            error: () => {
              this.modalLoading.set(false);
              this.modalErrorMessage.set('Error al vincular el atributo a la categoría.');
            }
          });
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al crear el atributo.');
        }
      });
    });
  }

  removeFieldFromCategory(assoc: CodeTypeFieldAssociation): void {
    const cat = this.selectedCategoryForConfig();
    if (!cat) return;

    Swal.fire({
      title: `¿Eliminar atributo "${assoc.customField?.nombre}" de la categoría?`,
      text: 'Los artículos asociados a esta categoría perderán esta especificación técnica.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e05638',
      cancelButtonColor: '#4f5e71'
    }).then((result) => {
      if (result.isConfirmed) {
        this.modalLoading.set(true);
        this.getOrCreateCodeTypeForCategory(cat, (codeTypeId) => {
          if (!codeTypeId) {
            this.modalLoading.set(false);
            return;
          }

          this.inventoryService.removeFieldFromCodeType(codeTypeId, assoc.customFieldId).subscribe({
            next: () => {
              this.reloadCategoryConfigFields(codeTypeId);
              this.loadMetadata();
              Swal.fire('¡Removido!', 'Atributo desvinculado de esta categoría con éxito.', 'success');
            },
            error: (err) => {
              this.modalLoading.set(false);
              Swal.fire('Error', err.error?.message || 'No se pudo desvincular el atributo.', 'error');
            }
          });
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
}
