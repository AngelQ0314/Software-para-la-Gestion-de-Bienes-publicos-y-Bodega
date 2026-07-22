import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpacesService, PhysicalSpace } from '../../../core/services/spaces.service';

@Component({
  selector: 'app-docente-spaces-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spaces-list.component.html',
  styleUrl: './spaces-list.component.css'
})
export class DocenteSpacesListComponent implements OnInit {
  spaces = signal<PhysicalSpace[]>([]);
  isLoading = signal(false);
  
  // Detalle del Espacio Seleccionado
  selectedSpace = signal<PhysicalSpace | null>(null);
  selectedJornada = signal<string>('');
  selectedViewCode = signal<string>('');
  spaceInventory = signal<any[]>([]);
  inventoryLoading = signal(false);

  // Modal para Ver Detalle de Novedades del Artículo
  showReportsModal = signal(false);
  selectedItemForReports = signal<any | null>(null);

  constructor(private readonly spacesService: SpacesService) {}

  ngOnInit(): void {
    this.loadMySpaces();
  }

  loadMySpaces(): void {
    this.isLoading.set(true);
    this.spacesService.getAllSpaces().subscribe({
      next: (res: PhysicalSpace[]) => {
        this.spaces.set(res);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.isLoading.set(false);
      }
    });
  }

  selectSpace(space: PhysicalSpace): void {
    this.selectedSpace.set(space);
    this.selectedViewCode.set('');
    // Seleccionar la primera jornada disponible del espacio por defecto
    if (space.jornadas && space.jornadas.length > 0) {
      this.selectedJornada.set(space.jornadas[0]);
      this.loadSpaceInventory(space.id, space.jornadas[0]);
    } else {
      this.selectedJornada.set('');
      this.spaceInventory.set([]);
    }
  }

  changeJornada(jornada: string): void {
    const space = this.selectedSpace();
    if (!space) return;
    this.selectedJornada.set(jornada);
    this.loadSpaceInventory(space.id, jornada);
  }

  updateSelectedView(code: string): void {
    this.selectedViewCode.set(code);
  }

  loadSpaceInventory(spaceId: string, jornada: string): void {
    this.inventoryLoading.set(true);
    this.spacesService.getInventoryByShift(spaceId, jornada).subscribe({
      next: (res: any[]) => {
        this.spaceInventory.set(res || []);
        this.inventoryLoading.set(false);
      },
      error: (err: any) => {
        this.spaceInventory.set([]);
        this.inventoryLoading.set(false);
      }
    });
  }

  // Filtrado de inventario en aula por las 3 Vistas
  filteredSpaceInventory = computed(() => {
    const list = this.spaceInventory();
    const viewCode = this.selectedViewCode();
    if (!viewCode) return list;

    return list.filter((row) => {
      const code = row.inventoryView?.code || row.viewCode || row.subcategoria?.categoria?.baseView;
      const viewName = row.view || row.inventoryView?.name || '';

      if (viewCode === 'BIENES_PUBLICOS' && (code === 'BIENES_PUBLICOS' || viewName === 'Bienes Públicos')) return true;
      if (viewCode === 'INSUMOS' && (code === 'INSUMOS' || viewName === 'Insumos y Suministros')) return true;
      if (viewCode === 'BIBLIOTECA' && (code === 'BIBLIOTECA' || viewName === 'Biblioteca')) return true;
      return code === viewCode;
    });
  });

  isItemInsumo(row: any): boolean {
    if (!row) return false;
    const code = row.inventoryView?.code || row.viewCode || row.subcategoria?.categoria?.baseView;
    const viewName = row.view || row.inventoryView?.name || '';
    return code === 'INSUMOS' || viewName === 'Insumos y Suministros';
  }

  getItemViewName(row: any): string {
    if (!row) return 'General';
    return row.inventoryView?.name || row.view || 'General';
  }

  openReportsModal(row: any): void {
    this.selectedItemForReports.set(row);
    this.showReportsModal.set(true);
  }

  closeReportsModal(): void {
    this.showReportsModal.set(false);
    this.selectedItemForReports.set(null);
  }

  closeDetails(): void {
    this.selectedSpace.set(null);
    this.spaceInventory.set([]);
    this.selectedViewCode.set('');
  }

  formatType(type: string): string {
    if (type === 'AULA') return 'Aula';
    if (type === 'LABORATORIO') return 'Laboratorio';
    if (type === 'TALLER') return 'Taller';
    if (type === 'OFICINA') return 'Oficina';
    if (type === 'BODEGA') return 'Bodega';
    return type;
  }
}
