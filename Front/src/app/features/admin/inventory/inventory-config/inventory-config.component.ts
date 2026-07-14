import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { InventoryService, Category, Subcategory, CustomField, CodeType } from '../services/inventory.service';
import Swal from 'sweetalert2';
import { forkJoin, of, Observable } from 'rxjs';


@Component({
  selector: 'app-inventory-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './inventory-config.component.html',
  styleUrl: './inventory-config.component.css'
})
export class InventoryConfigComponent implements OnInit {
  activeTab = signal<'categories' | 'fields' | 'codetypes'>('categories');

  categories = signal<Category[]>([]);
  subcategories = signal<Subcategory[]>([]);
  customFields = signal<CustomField[]>([]);
  codeTypes = signal<CodeType[]>([]);

  categoryForm: FormGroup;
  subcategoryForm: FormGroup;
  fieldForm: FormGroup;
  codeTypeForm: FormGroup;

  editingCategoryId = signal<string | null>(null);
  editingSubcategoryId = signal<string | null>(null);
  editingFieldId = signal<string | null>(null);
  editingCodeTypeId = signal<string | null>(null);

  newOption = '';
  tempOptions = signal<string[]>([]);

  selectedCodeType = signal<CodeType | null>(null);
  tempAssociations = signal<Array<{
    field: CustomField;
    selected: boolean;
    orden: number;
    isMandatory: boolean;
  }>>([]);

  constructor(private readonly fb: FormBuilder, private readonly inventoryService: InventoryService) {
    this.categoryForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      baseView: ['BIENES_PUBLICOS', [Validators.required]],
    });

    this.subcategoryForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      categoriaId: ['', [Validators.required]],
    });

    this.fieldForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      tipo: ['TEXT', [Validators.required]],
    });

    this.codeTypeForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
    });
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  setTab(tab: 'categories' | 'fields' | 'codetypes'): void {
    this.activeTab.set(tab);
    if (tab === 'codetypes' && this.codeTypes().length > 0 && !this.selectedCodeType()) {
      this.selectCodeType(this.codeTypes()[0]);
    }
  }

  loadAllData(): void {
    this.inventoryService.getCategories().subscribe((data) => this.categories.set(data));
    this.inventoryService.getSubcategories().subscribe((data) => this.subcategories.set(data));
    this.inventoryService.getCustomFields().subscribe((data) => this.customFields.set(data));
    this.inventoryService.getCodeTypes().subscribe((data) => {
      this.codeTypes.set(data);
      if (data.length > 0 && !this.selectedCodeType() && this.activeTab() === 'codetypes') {
        this.selectCodeType(data[0]);
      }
    });
  }

  formatView(view: string): string {
    const views: any = {
      BIENES_PUBLICOS: 'Bienes Públicos',
      INSUMOS: 'Insumos',
      BIBLIOTECA: 'Biblioteca',
    };
    return views[view] || view;
  }

  onCategorySubmit(): void {
    if (this.categoryForm.invalid) return;

    const val = this.categoryForm.value;
    const catId = this.editingCategoryId();

    if (catId) {
      this.inventoryService.updateCategory(catId, val).subscribe(() => {
        this.editingCategoryId.set(null);
        this.categoryForm.reset({ baseView: 'BIENES_PUBLICOS' });
        this.loadAllData();
      });
    } else {
      this.inventoryService.createCategory(val).subscribe(() => {
        this.categoryForm.reset({ baseView: 'BIENES_PUBLICOS' });
        this.loadAllData();
      });
    }
  }

  editCategory(cat: Category): void {
    this.editingCategoryId.set(cat.id);
    this.categoryForm.patchValue(cat);
  }

  deleteCategory(id: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Se eliminará esta categoría y todas las subcategorías asociadas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'swal2-glass-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventoryService.deleteCategory(id).subscribe(() => this.loadAllData());
      }
    });
  }

  onSubcategorySubmit(): void {
    if (this.subcategoryForm.invalid) return;

    const val = this.subcategoryForm.value;
    const subId = this.editingSubcategoryId();

    if (subId) {
      this.inventoryService.updateSubcategory(subId, val).subscribe(() => {
        this.editingSubcategoryId.set(null);
        this.subcategoryForm.reset({ categoriaId: '' });
        this.loadAllData();
      });
    } else {
      this.inventoryService.createSubcategory(val).subscribe(() => {
        this.subcategoryForm.reset({ categoriaId: '' });
        this.loadAllData();
      });
    }
  }

  editSubcategory(sub: Subcategory): void {
    this.editingSubcategoryId.set(sub.id);
    this.subcategoryForm.patchValue(sub);
  }

  deleteSubcategory(id: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Se eliminará esta subcategoría de forma permanente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'swal2-glass-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventoryService.deleteSubcategory(id).subscribe(() => this.loadAllData());
      }
    });
  }


  onFieldTypeChange(): void {
    this.tempOptions.set([]);
  }

  addOption(): void {
    if (!this.newOption.trim()) return;
    const opt = this.newOption.trim().toUpperCase();
    if (!this.tempOptions().includes(opt)) {
      this.tempOptions.update((prev) => [...prev, opt]);
    }
    this.newOption = '';
  }

  removeOption(index: number): void {
    this.tempOptions.update((prev) => prev.filter((_, i) => i !== index));
  }

  onFieldSubmit(): void {
    if (this.fieldForm.invalid) return;

    const formVal = this.fieldForm.value;
    const payload: any = {
      nombre: formVal.nombre.trim(),
      tipo: formVal.tipo,
      opciones: formVal.tipo === 'OPTIONS_LIST' ? this.tempOptions() : null,
    };

    const fieldId = this.editingFieldId();

    if (fieldId) {
      this.inventoryService.updateCustomField(fieldId, payload).subscribe(() => {
        this.cancelFieldEdit();
        this.loadAllData();
      });
    } else {
      this.inventoryService.createCustomField(payload).subscribe(() => {
        this.cancelFieldEdit();
        this.loadAllData();
      });
    }
  }

  editField(f: CustomField): void {
    this.editingFieldId.set(f.id);
    this.fieldForm.patchValue({
      nombre: f.nombre,
      tipo: f.tipo,
    });
    this.tempOptions.set(f.opciones || []);
  }

  cancelFieldEdit(): void {
    this.editingFieldId.set(null);
    this.fieldForm.reset({ tipo: 'TEXT' });
    this.tempOptions.set([]);
    this.newOption = '';
  }

  deleteField(id: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Se eliminará este campo personalizado de forma permanente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'swal2-glass-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventoryService.deleteCustomField(id).subscribe(() => this.loadAllData());
      }
    });
  }

  onCodeTypeSubmit(): void {
    if (this.codeTypeForm.invalid) return;

    const val = this.codeTypeForm.value;
    const ctId = this.editingCodeTypeId();

    if (ctId) {
      this.inventoryService.updateCodeType(ctId, val).subscribe(() => {
        this.editingCodeTypeId.set(null);
        this.codeTypeForm.reset();
        this.loadAllData();
      });
    } else {
      this.inventoryService.createCodeType(val).subscribe(() => {
        this.codeTypeForm.reset();
        this.loadAllData();
      });
    }
  }

  editCodeType(ct: CodeType): void {
    this.editingCodeTypeId.set(ct.id);
    this.codeTypeForm.patchValue(ct);
  }

  deleteCodeType(id: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Se eliminará este tipo de código y todas las asociaciones asociadas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'swal2-glass-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventoryService.deleteCodeType(id).subscribe(() => {
          this.selectedCodeType.set(null);
          this.loadAllData();
        });
      }
    });
  }


  selectCodeType(ct: CodeType): void {
    this.selectedCodeType.set(ct);

    this.inventoryService.getCodeTypeFields(ct.id).subscribe((assocList) => {
      const allFields = this.customFields();
      
      const mapped = allFields.map((field) => {
        const found = assocList.find((a) => a.customFieldId === field.id);
        return {
          field,
          selected: !!found,
          orden: found ? found.orden : 0,
          isMandatory: found ? found.isMandatory : false,
        };
      });

      mapped.sort((a, b) => {
        if (a.selected && b.selected) return a.orden - b.orden;
        if (a.selected) return -1;
        if (b.selected) return 1;
        return 0;
      });

      this.tempAssociations.set(mapped);
    });
  }

  onAssocToggle(index: number, event: any): void {
    this.tempAssociations.update((prev) => {
      const copy = [...prev];
      copy[index].selected = event.target.checked;
      if (event.target.checked && copy[index].orden === 0) {
        const maxOrder = Math.max(...copy.map((a) => a.selected ? a.orden : 0), 0);
        copy[index].orden = maxOrder + 1;
      }
      return copy;
    });
  }

  saveAssociations(): void {
    const ct = this.selectedCodeType();
    if (!ct) return;

    // Obtener asociaciones vigentes en base de datos
    this.inventoryService.getCodeTypeFields(ct.id).subscribe({
      next: (currentAssocs) => {
        const temp = this.tempAssociations();
        const obsList: Observable<any>[] = [];

        // 1. Procesar elementos seleccionados (Crear o Actualizar)
        temp.forEach((t) => {
          if (t.selected) {
            const existing = currentAssocs.find((c) => c.customFieldId === t.field.id);
            const needsUpdate = !existing || existing.orden !== t.orden || existing.isMandatory !== t.isMandatory;

            if (needsUpdate) {
              obsList.push(
                this.inventoryService.associateFieldToCodeTypeSingle(ct.id, {
                  customFieldId: t.field.id,
                  sortOrder: t.orden,
                  isMandatory: t.isMandatory,
                })
              );
            }
          }
        });

        // 2. Procesar elementos deseleccionados (Eliminar si existían)
        currentAssocs.forEach((c) => {
          const selectedInTemp = temp.find((t) => t.field.id === c.customFieldId && t.selected);
          if (!selectedInTemp) {
            obsList.push(this.inventoryService.removeFieldFromCodeType(ct.id, c.customFieldId));
          }
        });

        if (obsList.length === 0) {
          Swal.fire({
            title: 'Sin cambios',
            text: 'No hay modificaciones pendientes en la configuración de campos.',
            icon: 'info',
            confirmButtonText: 'Aceptar',
            customClass: { popup: 'swal2-glass-popup', confirmButton: 'btn btn-primary' },
          });
          return;
        }

        // Ejecutar todas las llamadas asíncronas en lote
        forkJoin(obsList).subscribe({
          next: () => {
            Swal.fire({
              title: '¡Configuración Guardada!',
              text: 'Los campos y su orden se actualizaron correctamente para este tipo de código.',
              icon: 'success',
              confirmButtonText: 'Genial',
              customClass: { popup: 'swal2-glass-popup', confirmButton: 'btn btn-primary' },
            });
            this.selectCodeType(ct);
          },
          error: (err) => {
            Swal.fire({
              title: 'Error al asociar',
              text: err.error?.message || 'Ocurrió un error al guardar la asociación de campos.',
              icon: 'error',
              confirmButtonText: 'Entendido',
              customClass: { popup: 'swal2-glass-popup', confirmButton: 'btn btn-primary' },
            });
          },
        });
      },
      error: (err) => {
        Swal.fire({
          title: 'Error de carga',
          text: 'No se pudieron consultar las asociaciones actuales.',
          icon: 'error',
          confirmButtonText: 'Aceptar',
          customClass: { popup: 'swal2-glass-popup', confirmButton: 'btn btn-primary' },
        });
      },
    });
  }
}

