import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { RequestsService } from '../../../core/services/requests.service';
import { PeriodsService } from '../../../core/services/periods.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  userFullName = computed(() => {
    const u = this.authService.currentUser();
    return u ? `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.cedula : 'Administrador';
  });

  // Estadísticas dinámicas
  totalBienes = signal<number>(0);
  totalInsumos = signal<number>(0);
  totalBiblioteca = signal<number>(0);
  pendingRequestsCount = signal<number>(0);

  maxVal = computed(() => Math.max(this.totalBienes(), this.totalInsumos(), this.totalBiblioteca(), 10));

  yAxisLabels = computed(() => {
    const m = this.maxVal();
    return [
      m,
      Math.round(m * 0.75),
      Math.round(m * 0.5),
      Math.round(m * 0.25),
      0
    ];
  });

  // Período Activo
  activePeriodName = signal<string>('Sin período activo');
  activePeriodDates = signal<string>('Configura un período en la sección Períodos');
  activePeriodProgress = signal<number>(0);
  activePeriodDaysLeft = signal<number>(0);

  // Listados dinámicos
  lastRequests = signal<any[]>([]);
  
  // Cargando
  loadingStats = signal<boolean>(true);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly inventoryService: InventoryService,
    private readonly requestsService: RequestsService,
    private readonly periodsService: PeriodsService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loadingStats.set(true);

    // 1. Obtener Vistas e Items
    this.inventoryService.getViews().subscribe({
      next: (views) => {
        const bienesView = views.find((v) => v.code === 'BIENES_PUBLICOS');
        const insumosView = views.find((v) => v.code === 'INSUMOS');
        const bibliotecaView = views.find((v) => v.code === 'BIBLIOTECA');

        const requests: any = {};
        if (bienesView) {
          requests['bienes'] = this.inventoryService.getItems(1, 1, { inventoryViewId: bienesView.id });
        }
        if (insumosView) {
          requests['insumos'] = this.inventoryService.getItems(1, 1, { inventoryViewId: insumosView.id });
        }
        if (bibliotecaView) {
          requests['biblioteca'] = this.inventoryService.getItems(1, 1, { inventoryViewId: bibliotecaView.id });
        }

        if (Object.keys(requests).length > 0) {
          forkJoin(requests).subscribe({
            next: (results: any) => {
              if (results.bienes) this.totalBienes.set(results.bienes.total || 0);
              if (results.insumos) this.totalInsumos.set(results.insumos.total || 0);
              if (results.biblioteca) this.totalBiblioteca.set(results.biblioteca.total || 0);
            }
          });
        }
      }
    });

    // 2. Obtener solicitudes
    this.requestsService.getAllRequests().subscribe({
      next: (reqs: any[]) => {
        const pending = reqs.filter((r) => r.status === 'EN_PROCESO');
        this.pendingRequestsCount.set(pending.length);
        
        // Obtener las últimas 4 solicitudes
        const sorted = [...reqs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.lastRequests.set(sorted.slice(0, 4));
      }
    });

    // 3. Obtener periodos
    this.periodsService.getAllPeriods().subscribe({
      next: (periods) => {
        const active = periods.find((p) => p.status === 'ACTIVO');
        if (active) {
          this.activePeriodName.set(`Período ${active.name}`);
          
          const start = new Date(active.startDate);
          const end = new Date(active.endDate);
          this.activePeriodDates.set(
            `${start.toLocaleDateString('es-EC')} – ${end.toLocaleDateString('es-EC')}`
          );

          // Calcular días restantes e indicar progreso
          const today = new Date();
          const totalDuration = end.getTime() - start.getTime();
          const elapsed = today.getTime() - start.getTime();
          
          let progress = 0;
          if (totalDuration > 0) {
            progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
          }
          this.activePeriodProgress.set(progress);

          const msLeft = end.getTime() - today.getTime();
          const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
          this.activePeriodDaysLeft.set(daysLeft);
        } else {
          this.activePeriodName.set('Sin período activo');
          this.activePeriodDates.set('Configura un período en la sección Períodos');
          this.activePeriodProgress.set(0);
          this.activePeriodDaysLeft.set(0);
        }
        this.loadingStats.set(false);
      },
      error: () => {
        this.loadingStats.set(false);
      }
    });
  }

  formatRequestType(type: string): string {
    if (type === 'TRANSFERENCIA') return 'Traspaso de Bienes';
    if (type === 'PEDIDO') return 'Pedido a Bodega';
    return type;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-EC');
  }

  onLogout(): void {
    this.authService.logout();
    window.location.href = '/auth/login';
  }
}
