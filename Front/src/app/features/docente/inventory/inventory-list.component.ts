import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';

@Component({
  selector: 'app-docente-inventory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.css'
})
export class DocenteInventoryComponent implements OnInit {
  assignedItems = signal<any[]>([]);
  mySpaces = signal<PhysicalSpace[]>([]);
  selectedSpaceId = signal<string>('');
  
  isLoading = signal(false);
  filterForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly spacesService: SpacesService
  ) {
    this.filterForm = this.fb.group({
      spaceId: [''],
      jornada: [''],
      search: ['']
    });
  }

  ngOnInit(): void {
    this.loadInventory();
    this.loadMySpaces();
    
    // Escuchar cambios de spaceId reactivamente
    this.filterForm.get('spaceId')?.valueChanges.subscribe((val) => {
      this.selectedSpaceId.set(val || '');
      this.filterForm.get('jornada')?.setValue('');
    });
  }

  loadInventory(): void {
    this.isLoading.set(true);
    const filters = this.filterForm.value;
    this.spacesService.getAssignedInventory(filters).subscribe({
      next: (res: any[]) => {
        this.assignedItems.set(res);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.isLoading.set(false);
      }
    });
  }

  loadMySpaces(): void {
    this.spacesService.getAllSpaces().subscribe({
      next: (res: PhysicalSpace[]) => {
        this.mySpaces.set(res);
      }
    });
  }

  applyFilters(): void {
    this.loadInventory();
  }

  resetFilters(): void {
    this.filterForm.reset({
      spaceId: '',
      jornada: '',
      search: ''
    });
    this.loadInventory();
  }

  // Filtrar jornadas basadas en el espacio seleccionado para las opciones de búsqueda
  availableJornadas = computed(() => {
    const spaceId = this.selectedSpaceId();
    if (!spaceId) return ['MATUTINA', 'VESPERTINA', 'NOCTURNA'];
    const space = this.mySpaces().find((s) => s.id === spaceId);
    return space?.jornadas || [];
  });

  formatJornada(jornada: string): string {
    if (jornada === 'MATUTINA') return 'Matutina';
    if (jornada === 'VESPERTINA') return 'Vespertina';
    if (jornada === 'NOCTURNA') return 'Nocturna';
    return jornada;
  }
}
