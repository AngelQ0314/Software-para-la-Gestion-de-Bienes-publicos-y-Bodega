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
  spaceInventory = signal<any[]>([]);
  inventoryLoading = signal(false);

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

  closeDetails(): void {
    this.selectedSpace.set(null);
    this.spaceInventory.set([]);
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
