import { Component, input, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full w-full">
      @if(title()) {
        <h4 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
          {{ title() }}
        </h4>
      }

      <div class="space-y-5 flex-grow relative"> <!-- space-y-4 passé à space-y-5 pour aérer les blocs -->
        @for (item of data(); track item.label; let i = $index) {
          <div class="relative group">
            <!-- Label Row -->
            <!-- mb-1.5 passé à mb-2 pour éviter que le texte touche la barre (jambages des lettres g, j, p, q, y) -->
            <div class="flex justify-between items-end mb-2 px-1">
              <div class="flex items-center gap-2 overflow-hidden mr-2"> <!-- Ajout mr-2 pour séparer du % -->
                <!-- Color Indicator -->
                <div class="w-2 h-2 rounded-full flex-shrink-0" [style.background-color]="getColor(item.nuance)"></div>
                <span class="font-bold text-slate-700 text-xs truncate" [title]="item.label">{{ item.label }}</span>
                <span class="text-[10px] text-slate-400 font-mono bg-slate-100 px-1 rounded flex-shrink-0">{{ item.nuance }}</span>
              </div>
              <span class="font-bold text-slate-800 text-sm tabular-nums whitespace-nowrap">{{ item.value.toFixed(1) }}%</span>
            </div>

            <!-- Bar Track -->
            <div class="w-full bg-slate-100 rounded-md h-3 overflow-hidden shadow-inner">
              <!-- Animated Bar with Gradient -->
              <div 
                class="h-full rounded-md shadow-sm relative transition-all duration-1000 ease-out flex items-center justify-end"
                [style.width.%]="loaded() ? item.value : 0"
                [style.background-color]="getColor(item.nuance)"
                [style.transition-delay]="(i * 100) + 'ms'"
              >
                 <!-- Subtle shine effect -->
                 <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Compact Legend (Auto-generated from visible data) -->
      <div class="mt-6 pt-3 border-t border-slate-100 flex flex-wrap justify-center gap-x-4 gap-y-2">
         @for(legend of legendItems(); track legend.nuance) {
            <div class="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
               <span class="w-2.5 h-2.5 rounded-sm shadow-sm" [style.background-color]="legend.color"></span>
               <span class="text-[10px] font-bold text-slate-500">{{ legend.nuance }}</span>
            </div>
         }
      </div>
    </div>
  `
})
export class BarChartComponent implements OnInit {
  data = input.required<{ label: string; value: number; nuance: string }[]>();
  title = input<string>('');
  
  // Signal to trigger animation after view init
  loaded = signal(false);

  ngOnInit() {
    // Delay slightly to allow the browser to render the "0 width" state first
    setTimeout(() => {
      this.loaded.set(true);
    }, 100);
  }

  // Comprehensive French Political Color Palette
  private colors: Record<string, string> = {
      // Extrême Gauche
      'EXG': '#780000', 'LO': '#8B0000', 'NPA': '#B22222', 'DXG': '#8B0000',

      // Gauche / NUPES
      'LFI': '#CC2443', 'FI': '#CC2443',
      'PCF': '#DD0000', 'COM': '#DD0000',
      'SOC': '#FF8080', 'PS': '#FF8080', 'RDG': '#FFB6C1', 'DVG': '#FFC0CB',
      'NUP': '#E60000', 'UG': '#FF69B4', 

      // Écologie
      'ECO': '#458B74', 'EELV': '#00C000', 'VEC': '#2E8B57', 'GEN': '#00C000',

      // Centre / Majorité Présidentielle
      'ENS': '#E1A916', 'LREM': '#FFD700', 'REM': '#FFD700', 'REN': '#FFD700',
      'MDM': '#FF9900', 'MODEM': '#FF9900',
      'DVC': '#F0E68C', 'UDI': '#76C6D6', 'HOR': '#000080', // Horizons dark blue usually

      // Droite
      'LR': '#0066CC', 'UD': '#0047AB', 'DVD': '#ADD8E6', 'DLF': '#000080',
      
      // Extrême Droite
      'RN': '#0D378A', 'FN': '#0D378A', 
      'REC': '#191970', 'EXD': '#000033', 'UXD': '#35435E',

      // Divers / Régionalistes
      'DIV': '#808080', 'REG': '#8FBC8F', 'DSV': '#708090', 'GJ': '#FFFF00'
  };

  getColor(nuance: string): string {
    // Normalize nuance to handle potential spacing or case issues
    const code = (nuance || '').toUpperCase().trim();
    return this.colors[code] || '#94a3b8'; // Default slate gray if unknown
  }

  legendItems = computed(() => {
     // Create unique list of nuances present in the data
     const uniqueNuances = new Set<string>(this.data().map(d => d.nuance));
     return Array.from(uniqueNuances).map((n: string) => ({
        nuance: n,
        color: this.getColor(n)
     })).sort((a, b) => a.nuance.localeCompare(b.nuance));
  });
}
