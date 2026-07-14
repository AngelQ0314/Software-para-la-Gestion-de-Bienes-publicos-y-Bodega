import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  searchQuery = signal<string>('');

  setQuery(query: string): void {
    this.searchQuery.set(query);
  }

  clear(): void {
    this.searchQuery.set('');
  }
}
