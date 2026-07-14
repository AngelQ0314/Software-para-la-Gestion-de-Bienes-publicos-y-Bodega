import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { InventoryService, InventoryItem, Subcategory, CodeType, CodeTypeFieldAssociation } from '../services/inventory.service';
import { InventoryConfigComponent } from '../inventory-config/inventory-config.component';

@Component({
  selector: 'app-items-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InventoryConfigComponent],
  templateUrl: './items-list.component.html',
  styleUrl: './items-list.component.css'
})
export class ItemsListComponent implements OnInit {
  items = signal<InventoryItem[]>([]);
  loading = signal(false);
  currentPage = signal(1);
  totalPages = signal(1);

  subcategories = signal<Subcategory[]>([]);
  codeTypes = signal<CodeType[]>([]);
  dynamicFields = signal<CodeTypeFieldAssociation[]>([]);

  filterForm: FormGroup;
  itemForm: FormGroup;

  showFormModal = signal(false);
  showDetailModal = signal(false);
  modalLoading = signal(false);
  modalErrorMessage = signal<string | null>(null);

  editingItemId = signal<string | null>(null);
  selectedItem = signal<InventoryItem | null>(null);

  // Importación de Excel
  showImportModal = signal(false);
  importErrorMessage = signal<string | null>(null);
  importSuccessMessage = signal<string | null>(null);
  importErrorsList = signal<string[]>([]);
  selectedFile: File | null = null;


  // Control de Pestañas del Inventario
  activeTab = signal<'BIENES_PUBLICOS' | 'INSUMOS' | 'BIBLIOTECA' | 'CONFIG'>('BIENES_PUBLICOS');

  // Mapeo de IDs de vistas del backend
  private readonly viewIds: Record<string, string> = {
    'BIENES_PUBLICOS': '675a0ee3-2025-4d84-9f9f-c2b847b13def',
    'INSUMOS': '44ecdff9-79b0-4e87-86d5-9e0bb909c3ef',
    'BIBLIOTECA': 'f5007634-bec7-4af7-9181-c92aecab70f5'
  };

  constructor(private readonly fb: FormBuilder, private readonly inventoryService: InventoryService) {
    this.filterForm = this.fb.group({
      codigoYavirac: [''],
      subcategoriaId: [''],
      codigoTipoId: [''],
      estadoFisico: [''],
    });

    this.itemForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      codigoYavirac: ['', [Validators.required]],
      codigoAuxiliar: [''],
      subcategoriaId: ['', [Validators.required]],
      codigoTipoId: ['', [Validators.required]],
      estadoFisico: ['BUENO', [Validators.required]],
      dynamicValues: this.fb.group({}),
    });
  }


  ngOnInit(): void {
    this.loadMetadata();
    this.loadItems();
  }

  loadMetadata(): void {
    this.inventoryService.getSubcategories().subscribe((data) => this.subcategories.set(data));
    this.inventoryService.getCodeTypes().subscribe((data) => this.codeTypes.set(data));
  }

  loadItems(): void {
    if (this.activeTab() === 'CONFIG') return;

    this.loading.set(true);
    const filters = { ...this.filterForm.value };
    filters.inventoryViewId = this.viewIds[this.activeTab()];

    this.inventoryService.getItems(this.currentPage(), 10, filters).subscribe({
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

  selectTab(tab: 'BIENES_PUBLICOS' | 'INSUMOS' | 'BIBLIOTECA' | 'CONFIG'): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.items.set([]);
    if (tab !== 'CONFIG') {
      this.loadItems();
    }
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadItems();
  }

  resetFilters(): void {
    this.filterForm.reset({
      codigoYavirac: '',

      subcategoriaId: '',
      codigoTipoId: '',
      estadoFisico: '',
    });
    this.currentPage.set(1);
    this.loadItems();
  }

  setPage(page: number): void {
    this.currentPage.set(page);
    this.loadItems();
  }

  isFieldInvalid(field: string): boolean {
    const ctrl = this.itemForm.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  onCodeTypeChange(callback?: () => void): void {
    const codeTypeId = this.itemForm.get('codigoTipoId')?.value;
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

  getFilteredSubcategories(): Subcategory[] {
    const tab = this.activeTab();
    if (tab === 'CONFIG') return [];
    return this.subcategories().filter((sub) => sub.categoria?.baseView === tab);
  }

  openCreateModal(): void {
    this.editingItemId.set(null);
    this.modalErrorMessage.set(null);
    this.dynamicFields.set([]);

    this.itemForm.reset({
      name: '',
      codigoYavirac: '',
      codigoAuxiliar: '',
      subcategoriaId: '',
      codigoTipoId: '',
      estadoFisico: 'BUENO',
    });

    const dynamicGroup = this.itemForm.get('dynamicValues') as FormGroup;
    Object.keys(dynamicGroup.controls).forEach((key) => {
      dynamicGroup.removeControl(key);
    });

    // Refrescar catálogos de subcategorías y tipos de código al abrir el modal
    this.inventoryService.getSubcategories().subscribe((data) => this.subcategories.set(data));
    this.inventoryService.getCodeTypes().subscribe((data) => this.codeTypes.set(data));

    this.showFormModal.set(true);
  }


  openEditModal(item: InventoryItem): void {
    this.editingItemId.set(item.id || null);
    this.modalErrorMessage.set(null);

    // Refrescar catálogos de subcategorías y tipos de código al abrir el modal de edición
    this.inventoryService.getSubcategories().subscribe((subData) => {
      this.subcategories.set(subData);
      
      this.inventoryService.getCodeTypes().subscribe((codeTypesData) => {
        this.codeTypes.set(codeTypesData);

        this.itemForm.patchValue({
          name: item.name || '',
          codigoYavirac: item.codigoYavirac,
          codigoAuxiliar: item.codigoAuxiliar || '',
          subcategoriaId: item.subcategoriaId,
          codigoTipoId: item.codigoTipoId,
          estadoFisico: item.estadoFisico,
        });

        this.onCodeTypeChange(() => {
          const dynamicGroup = this.itemForm.get('dynamicValues') as FormGroup;
          dynamicGroup.patchValue(item.dynamicValues || {});
          this.showFormModal.set(true);
        });
      });
    });
  }


  closeFormModal(): void {
    this.showFormModal.set(false);
  }

  onItemSubmit(): void {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    const val = this.itemForm.value;
    const payload: InventoryItem = {
      name: val.name.trim(),
      codigoYavirac: val.codigoYavirac.trim(),
      codigoAuxiliar: val.codigoAuxiliar?.trim() || null,
      subcategoriaId: val.subcategoriaId,
      codigoTipoId: val.codigoTipoId,
      estadoFisico: val.estadoFisico,
      dynamicValues: val.dynamicValues,
      cantidad: 1, // Cantidad por defecto
    };


    const itemId = this.editingItemId();

    if (itemId) {
      this.inventoryService.updateItem(itemId, payload).subscribe({
        next: () => {
          this.modalLoading.set(false);
          this.closeFormModal();
          this.loadItems();
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al guardar el ítem.');
        },
      });
    } else {
      this.inventoryService.createItem(payload).subscribe({
        next: () => {
          this.modalLoading.set(false);
          this.closeFormModal();
          this.loadItems();
        },
        error: (err) => {
          this.modalLoading.set(false);
          this.modalErrorMessage.set(err.error?.message || 'Error al crear el ítem.');
        },
      });
    }
  }

  deleteItem(item: InventoryItem): void {
    if (!item.id || !confirm(`¿Estás seguro de eliminar el elemento con código ${item.codigoYavirac}?`)) return;
    this.inventoryService.deleteItem(item.id).subscribe(() => this.loadItems());
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

    const viewId = this.viewIds[this.activeTab()];

    this.inventoryService.importItemsFromExcel(this.selectedFile, viewId).subscribe({
      next: (res: any) => {
        this.modalLoading.set(false);
        this.importSuccessMessage.set(res.message || 'Importación completada con éxito.');
        setTimeout(() => {
          this.closeImportModal();
          this.loadItems();
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
}

