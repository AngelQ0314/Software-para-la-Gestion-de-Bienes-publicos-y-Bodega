import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { InventoryService, Category, Subcategory, CustomField, CodeType } from '../services/inventory.service';

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
    if (!confirm('¿Seguro de que deseas eliminar esta categoría? Se borrarán subcategorías asociadas.')) return;
    this.inventoryService.deleteCategory(id).subscribe(() => this.loadAllData());
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
    if (!confirm('¿Deseas eliminar esta subcategoría?')) return;
    this.inventoryService.deleteSubcategory(id).subscribe(() => this.loadAllData());
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
    if (!confirm('¿Deseas eliminar este campo personalizado?')) return;
    this.inventoryService.deleteCustomField(id).subscribe(() => this.loadAllData());
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
    if (!confirm('¿Deseas eliminar este tipo de código?')) return;
    this.inventoryService.deleteCodeType(id).subscribe(() => {
      this.selectedCodeType.set(null);
      this.loadAllData();
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

    const payload = this.tempAssociations()
      .filter((a) => a.selected)
      .map((a) => ({
        customFieldId: a.field.id,
        orden: a.orden,
        isMandatory: a.isMandatory,
      }));

    this.inventoryService.associateCodeTypeFields(ct.id, payload).subscribe({
      next: () => {
        alert('Configuración de campos guardada con éxito.');
        this.selectCodeType(ct);
      },
      error: (err) => {
        alert(err.error?.message || 'Error al guardar configuración.');
      },
    });
  }
}
