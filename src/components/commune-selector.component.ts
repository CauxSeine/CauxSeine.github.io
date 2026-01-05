import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService, Commune } from '../services/data.service';

@Component({
  selector: 'app-commune-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative w-full max-w-md">
      <label for="commune-search" class="block text-sm font-medium text-slate-700 mb-1">
        Rechercher une commune
      </label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
           <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <input
          type="text"
          id="commune-search"
          class="block w-full p-3 pl-10 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          placeholder="Ex: Rouen, Le Havre..."
          [ngModel]="searchTerm()"
          (ngModelChange)="updateSearch($event)"
          (focus)="showDropdown.set(true)"
        />
        
        @if (showDropdown() && filteredCommunes().length > 0) {
          <ul class="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            @for (commune of filteredCommunes(); track commune.code) {
              <li>
                <button
                  type="button"
                  class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex justify-between items-center"
                  (click)="select(commune)"
                >
                  <span>{{ commune.libelle }}</span>
                  <span class="text-xs text-slate-400 font-mono">{{ commune.code }}</span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `
})
export class CommuneSelectorComponent {
  dataService = inject(DataService);
  searchTerm = signal('');
  showDropdown = signal(false);

  constructor() {
     // Reset search term when selection is cleared
     effect(() => {
        if (this.dataService.selectedCommuneCode() === null) {
           this.searchTerm.set('');
        }
     });
  }

  filteredCommunes = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const all = this.dataService.availableCommunes();
    if (term.length < 1) return all;
    return all.filter(c => 
      c.libelle.toLowerCase().includes(term) || c.code.startsWith(term)
    );
  });

  updateSearch(term: string) {
    this.searchTerm.set(term);
    this.showDropdown.set(true);
  }

  select(commune: Commune) {
    this.searchTerm.set(commune.libelle);
    this.dataService.selectCommune(commune.code);
    this.showDropdown.set(false);
  }
}