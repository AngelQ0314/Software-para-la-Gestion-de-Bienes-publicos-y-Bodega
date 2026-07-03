import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent {
  userFullName = computed(() => {
    const u = this.authService.currentUser();
    return u ? `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.cedula : '';
  });

  userRole = computed(() => this.authService.currentUser()?.rol || '');

  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
