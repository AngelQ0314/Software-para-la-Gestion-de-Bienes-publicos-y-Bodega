import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { InventoryService, InventoryItem, Subcategory, CodeType, CodeTypeFieldAssociation } from '../services/inventory.service';

@Component({
  selector: 'app-items-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  constructor(private readonly fb: FormBuilder, private readonly inventoryService: InventoryService) {
    this.filterForm = this.fb.group({
      codigoYavirac: [''],
      subcategoriaId: [''],
      codigoTipoId: [''],
      estadoFisico: [''],
    });

    this.itemForm = this.fb.group({
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
    this.loading.set(true);
    const filters = this.filterForm.value;

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

  openCreateModal(): void {
    this.editingItemId.set(null);
    this.modalErrorMessage.set(null);
    this.dynamicFields.set([]);

    this.itemForm.reset({
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

    this.showFormModal.set(true);
  }

  openEditModal(item: InventoryItem): void {
    this.editingItemId.set(item.id || null);
    this.modalErrorMessage.set(null);

    this.itemForm.patchValue({
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
      codigoYavirac: val.codigoYavirac.trim(),
      codigoAuxiliar: val.codigoAuxiliar?.trim() || null,
      subcategoriaId: val.subcategoriaId,
      codigoTipoId: val.codigoTipoId,
      estadoFisico: val.estadoFisico,
      dynamicValues: val.dynamicValues,
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
}
