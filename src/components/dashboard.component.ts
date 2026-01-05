import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import { DataService, AggregatedResult } from '../services/data.service';
import { AiService } from '../services/ai.service';
import { CommuneSelectorComponent } from './commune-selector.component';
import { BarChartComponent } from './charts/bar-chart.component';
import { TrendChartComponent } from './charts/trend-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CommuneSelectorComponent, BarChartComponent, TrendChartComponent],
  template: `
    <div class="min-h-screen bg-[#F5F5F5] font-sans text-[#333333] relative">
      
      <!-- Loading Overlay -->
      @if (dataService.isLoading() || isGeneratingPdf() || isGeneratingWord()) {
         <div class="fixed inset-0 bg-[#005B82]/90 z-50 flex items-center justify-center backdrop-blur-sm">
            <div class="bg-white p-10 rounded-none shadow-2xl max-w-md w-full text-center border-t-4 border-[#009AA6]">
               <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#009AA6] border-t-transparent mb-6"></div>
               <h3 class="text-2xl font-bold text-[#005B82] mb-2 uppercase tracking-wide">
                  {{ isGeneratingPdf() ? 'Génération du Rapport PDF' : (isGeneratingWord() ? 'Génération du Rapport Word' : 'Traitement en cours') }}
               </h3>
               <p class="text-gray-500 font-light">
                  {{ (isGeneratingPdf() || isGeneratingWord()) ? 'Mise en page intelligente des chapitres...' : dataService.loadingMessage() }}
               </p>
               @if(isGeneratingPdf() || isGeneratingWord()) {
                  <div class="mt-4 w-full bg-gray-200 rounded-full h-2.5">
                    <div class="bg-[#009AA6] h-2.5 rounded-full transition-all duration-300" [style.width.%]="pdfProgress()"></div>
                  </div>
               }
            </div>
         </div>
      }

      <!-- Header Institutionnel -->
      <header id="pdf-header" class="bg-white shadow-md sticky top-0 z-30 border-b-4 border-[#009AA6]">
        <div class="max-w-7xl mx-auto px-4 lg:px-8">
          <div class="flex flex-col md:flex-row justify-between items-center h-auto md:h-24 py-4 md:py-0">
             
             <!-- Identity -->
             <div class="flex flex-col w-full md:w-auto text-center md:text-left mb-4 md:mb-0">
                <h1 class="text-2xl font-extrabold text-[#005B82] uppercase tracking-tight leading-none">Observatoire Électoral</h1>
                <p class="text-sm font-bold text-[#009AA6] uppercase tracking-widest mt-1">Caux Seine agglo</p>
             </div>

             <!-- Tools -->
             <div class="flex flex-wrap items-center justify-center md:justify-end gap-4 w-full md:w-auto mt-4 md:mt-0" data-html2canvas-ignore="true">
                <!-- PDF Export Button -->
                @if (currentData()) {
                  <button 
                    (click)="printElectionsPDF()" 
                    class="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white transition-all duration-200 bg-[#009AA6] border border-[#009AA6] hover:bg-[#008195] disabled:opacity-50 mr-2"
                    [disabled]="isGeneratingPdf() || isGeneratingWord()"
                    title="Générer un PDF avec une élection par page"
                  >
                     <span class="flex items-center gap-2 uppercase tracking-wide">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        Fiches Élections
                     </span>
                  </button>

                  <button 
                    (click)="downloadReport()" 
                    class="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-[#005B82] transition-all duration-200 bg-white border border-[#005B82] hover:bg-[#E6F5F6] disabled:opacity-50"
                    [disabled]="isGeneratingPdf() || isGeneratingWord()"
                  >
                     <span class="flex items-center gap-2 uppercase tracking-wide">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Rapport Complet
                     </span>
                  </button>

                  <button 
                    (click)="downloadWord()" 
                    class="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white transition-all duration-200 bg-[#005B82] border border-[#005B82] hover:bg-[#004a6b] disabled:opacity-50 ml-2"
                    [disabled]="isGeneratingPdf() || isGeneratingWord()"
                  >
                     <span class="flex items-center gap-2 uppercase tracking-wide">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Word
                     </span>
                  </button>
                }

                <!-- Import Button (Toujours disponible en cas de besoin manuel) -->
                <label class="cursor-pointer group relative inline-flex items-center justify-center px-6 py-2 text-sm font-bold text-white transition-all duration-200 bg-[#005B82] font-pj rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#005B82] hover:bg-[#004a6b] ml-4">
                   <span class="absolute inset-y-0 left-0 w-[2px] bg-[#009AA6] transition-all group-hover:w-full group-active:bg-[#005B82]"></span>
                   <span class="relative flex items-center gap-2 text-sm uppercase tracking-wide">
                     <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                     Importer CSV
                   </span>
                   <input type="file" multiple accept=".csv" (change)="onFileSelected($event)" class="hidden" />
                </label>
             </div>
          </div>
        </div>
      </header>

      <!-- Main Content Area -->
      <main id="dashboard-content" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 bg-[#F5F5F5]">
        
        @if (!dataService.dataLoaded()) {
          <div class="flex flex-col items-center justify-center py-24 bg-white shadow-sm border-t-4 border-gray-200 mx-auto max-w-3xl text-center px-8">
            <div class="bg-[#E6F5F6] p-6 rounded-full mb-8">
               <svg class="w-16 h-16 text-[#009AA6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h2 class="text-3xl font-bold text-[#005B82] mb-4 uppercase">Bienvenue sur l'Observatoire</h2>
            <p class="text-gray-600 mb-10 max-w-lg leading-relaxed text-lg">
               Aucune donnée trouvée. Veuillez charger manuellement les jeux de données CSV officiels ou vérifier le dossier <code>assets/data/</code>.
            </p>
            <label class="cursor-pointer inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white transition-all duration-200 bg-[#009AA6] border border-transparent rounded-sm hover:bg-[#008195] shadow-lg hover:shadow-xl transform hover:-translate-y-1">
               Sélectionner les fichiers sources
               <input type="file" multiple accept=".csv" (change)="onFileSelected($event)" class="hidden" />
            </label>
          </div>
        } @else {

          <!-- Section 1: Pilotage -->
          <section id="pdf-section-pilotage" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <!-- Left Panel: Selector -->
            <div class="lg:col-span-4 bg-white p-8 shadow-sm border-l-4 border-[#005B82]">
              <h2 class="text-xl font-bold text-[#005B82] mb-6 uppercase tracking-wide border-b pb-2">Sélection Territoriale</h2>
              
              <!-- Hide selector in PDF to make it cleaner -->
              <div [class.hidden]="isGeneratingPdf() || isGeneratingWord()" data-html2canvas-ignore="true">
                 <app-commune-selector />
              </div>
              
              @if (currentData()) {
                <div class="mt-8 bg-[#E6F5F6] p-6 border border-[#B3E0E5]">
                  <div class="flex justify-between items-start">
                     <div>
                        <p class="text-xs text-[#009AA6] uppercase font-bold tracking-widest mb-2">Commune</p>
                        <p class="text-3xl font-extrabold text-[#005B82] leading-none mb-1">{{ currentData()![0].label }}</p>
                        @if (currentData()![0].code_commune) {
                           <p class="text-sm text-gray-500 font-mono">INSEE: {{ currentData()![0].code_commune }}</p>
                        }
                     </div>
                     <button (click)="resetCommune()" [class.hidden]="isGeneratingPdf() || isGeneratingWord()" data-html2canvas-ignore="true" class="text-[#005B82] hover:text-[#009AA6] transition-colors p-2 bg-white rounded-full shadow-sm" title="Réinitialiser">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                     </button>
                  </div>
                </div>
              }
            </div>

            <!-- Right Panel: AI & Charts -->
            <div class="lg:col-span-8 space-y-8">
              @if (currentData()) {
                
                <!-- AI Module -->
                <div id="pdf-section-ai" class="bg-white shadow-md border-t-4 border-[#009AA6]">
                    <div class="bg-gradient-to-r from-[#005B82] to-[#007f9c] text-white px-6 py-4 flex justify-between items-center">
                        <div>
                           <h2 class="text-lg font-bold flex items-center gap-3 uppercase tracking-wide">
                             <svg class="w-6 h-6 text-[#009AA6] bg-white rounded-full p-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                             Analyse & Synthèse
                           </h2>
                        </div>
                        
                        @if (!aiAnalysis() && !isGeneratingPdf() && !isGeneratingWord()) {
                          <button 
                            data-html2canvas-ignore="true"
                            (click)="generateAnalysis()" 
                            class="bg-white text-[#005B82] px-5 py-2 text-sm font-bold uppercase tracking-wide hover:bg-gray-100 transition-colors shadow-sm disabled:opacity-75"
                            [disabled]="isLoadingAi()"
                          >
                            {{ isLoadingAi() ? 'Traitement...' : 'Lancer l\\'analyse' }}
                          </button>
                        }
                    </div>

                    <div class="p-8">
                      @if (isLoadingAi()) {
                        <div class="flex flex-col items-center justify-center py-8 space-y-4">
                           <div class="animate-spin rounded-full h-12 w-12 border-4 border-[#009AA6] border-t-transparent"></div>
                           <p class="text-[#005B82] text-sm font-medium animate-pulse">Génération du rapport d'expertise en cours...</p>
                        </div>
                      } @else if (safeAiAnalysis()) {
                        <div class="prose prose-sm prose-slate max-w-none text-[#333333]" [innerHTML]="safeAiAnalysis()"></div>
                      } @else {
                        <div class="text-center py-6 text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded">
                           @if(isGeneratingPdf() || isGeneratingWord()) {
                              <p>Aucune analyse IA générée pour ce rapport.</p>
                           } @else {
                              <p>Module d'intelligence artificielle prêt à analyser les données électorales et la sociologie des bureaux.</p>
                           }
                        </div>
                      }
                    </div>
                </div>

                <!-- Trend Chart - Abstention -->
                <div id="pdf-section-trends-1" class="bg-white p-6 shadow-sm border-l-4 border-[#005B82]">
                  <app-trend-chart 
                    [data]="abstentionTrend()" 
                    title="Évolution du taux d'abstention"
                    color="#D32F2F" 
                  />
                </div>
                
                <!-- Trend Chart - Blancs et Nuls -->
                <div id="pdf-section-trends-2" class="bg-white p-6 shadow-sm border-l-4 border-[#64748b]">
                   <app-trend-chart
                     [data]="blancsNulsTrend()"
                     title="Évolution des votes Blancs & Nuls (% des Votants)"
                     color="#64748b"
                   />
                </div>
              }
            </div>
          </section>

          @if (currentData()) {
            
            <div class="border-t border-gray-200 my-8"></div>

            <!-- Section 2: Data Tables (Consolidated) -->
            <section id="pdf-section-consolidated" class="bg-white shadow-sm border-t-4 border-[#333333]">
               <div class="px-8 py-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h3 class="text-xl font-bold text-[#005B82] uppercase">Résultats Consolidés</h3>
                    <p class="text-sm text-gray-500">Données agrégées à l'échelle communale</p>
                 </div>
                 
                 <!-- Bouton Export CSV -->
                 <button 
                    (click)="exportConsolidatedCsv()"
                    data-html2canvas-ignore="true"
                    [class.hidden]="isGeneratingPdf() || isGeneratingWord()"
                    class="group inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#009AA6] bg-white border border-[#009AA6] rounded hover:bg-[#E6F5F6] transition-colors"
                 >
                     <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                     Export CSV
                 </button>
               </div>
               <div class="overflow-x-auto">
                 <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-[#005B82] text-white">
                       <tr>
                          <th scope="col" class="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Élection</th>
                          <th scope="col" class="px-2 py-4 text-right text-xs font-bold uppercase tracking-wider">Inscrits</th>
                          <th scope="col" class="px-2 py-4 text-right text-xs font-bold uppercase tracking-wider">Votants</th>
                          <th scope="col" class="px-2 py-4 text-right text-xs font-bold uppercase tracking-wider">Abst.</th>
                          <th scope="col" class="px-2 py-4 text-right text-xs font-bold uppercase tracking-wider">Expr.</th>
                          <th scope="col" class="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider pl-4">Vainqueur</th>
                          <th scope="col" class="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider">Score</th>
                       </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-100">
                       @for (row of currentData(); track row.id_election) {
                          <tr class="hover:bg-[#E6F5F6] transition-colors group">
                             <td class="px-4 py-4 whitespace-nowrap text-sm font-bold text-[#005B82]">{{ row.id_election }}</td>
                             <td class="px-2 py-4 whitespace-nowrap text-sm text-right text-gray-600">{{ row.inscrits }}</td>
                             <td class="px-2 py-4 whitespace-nowrap text-sm text-right font-bold text-[#333333]">
                                {{ row.votants }}
                             </td>
                             <td class="px-2 py-4 whitespace-nowrap text-sm text-right text-gray-600">{{ row.abstentions }}</td>
                             <td class="px-2 py-4 whitespace-nowrap text-sm text-right font-bold text-[#333333]">{{ row.exprimes }}</td>
                             
                             <td class="px-4 py-4 whitespace-nowrap text-sm pl-4">
                                @if(row.candidates.length > 0) {
                                   <div class="flex flex-col">
                                      <span class="font-bold text-[#333333]">{{ row.candidates[0].nom }}</span>
                                      <span class="text-xs text-gray-500 font-mono">{{ row.candidates[0].nuance }}</span>
                                   </div>
                                }
                             </td>
                             <td class="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-[#009AA6]">
                                @if(row.candidates.length > 0) {
                                   {{ row.candidates[0].pourcentage.toFixed(1) }}%
                                }
                             </td>
                          </tr>
                       }
                    </tbody>
                 </table>
               </div>
            </section>

            <!-- Section 3: Detailed Bureaux -->
            @if (pollingData() && pollingData()!.length > 0) {
               <section id="pdf-section-detailed" class="bg-white shadow-sm border-t-4 border-[#009AA6] mt-8 break-before-page">
                 <!-- Header -->
                 <div class="px-8 py-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-100 transition-colors" (click)="!isGeneratingPdf() && !isGeneratingWord() && toggleBvTable()">
                   <div>
                     <h3 class="text-xl font-bold text-[#005B82] uppercase">Détail par Bureau de Vote</h3>
                     <p class="text-sm text-gray-500">Analyse fine de la géographie électorale</p>
                   </div>
                   
                   <div class="flex items-center gap-4">
                     <!-- Filter Controls -->
                     @if (!isGeneratingPdf() && !isGeneratingWord() && showBvTable()) {
                        <div class="flex items-center gap-3" (click)="$event.stopPropagation()">
                            <select 
                                [ngModel]="selectedElectionFilter()" 
                                (ngModelChange)="selectedElectionFilter.set($event)"
                                class="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-[#009AA6] focus:border-[#009AA6] block p-2"
                            >
                                <option value="">Toutes les élections</option>
                                @for(election of electionOptions(); track election) {
                                   <option [value]="election">{{ election }}</option>
                                }
                            </select>

                            <select 
                                [ngModel]="selectedBureauFilter()" 
                                (ngModelChange)="selectedBureauFilter.set($event)"
                                class="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-[#009AA6] focus:border-[#009AA6] block p-2"
                            >
                                <option value="">Tous les bureaux</option>
                                @for(bureau of bureauOptions(); track bureau.id) {
                                   <option [value]="bureau.id">{{ bureau.label }}</option>
                                }
                            </select>

                            @if(selectedElectionFilter() || selectedBureauFilter()) {
                                <button (click)="resetFilters()" class="text-xs text-red-600 hover:text-red-800 underline">
                                    Réinitialiser
                                </button>
                            }
                        </div>
                     }

                     <div class="bg-white p-2 rounded-full shadow-sm border border-gray-200" [class.hidden]="isGeneratingPdf() || isGeneratingWord()" data-html2canvas-ignore="true">
                        <svg class="w-6 h-6 text-[#009AA6] transform transition-transform duration-300" [class.rotate-180]="showBvTable()" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                     </div>
                   </div>
                 </div>
                 
                 <!-- Table Container -->
                 @if (showBvTable() || isGeneratingPdf() || isGeneratingWord()) {
                   <div class="overflow-x-auto scrollbar-thin scrollbar-thumb-[#009AA6] scrollbar-track-gray-100 transition-all"
                        [class.max-h-[800px]]="!isGeneratingPdf() && !isGeneratingWord()"
                        [class.max-h-none]="isGeneratingPdf() || isGeneratingWord()"
                        [class.overflow-visible]="isGeneratingPdf() || isGeneratingWord()">
                        
                     <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-[#F9FAFB] shadow-sm" [class.sticky]="!isGeneratingPdf() && !isGeneratingWord()" [class.top-0]="!isGeneratingPdf() && !isGeneratingWord()" [class.z-10]="!isGeneratingPdf() && !isGeneratingWord()">
                           <tr>
                              <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Bureau</th>
                              <th scope="col" class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Inscrits</th>
                              <th scope="col" class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Abstention</th>
                              <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider pl-8">Résultat (Top 2)</th>
                           </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-100">
                           @for (row of filteredPollingData(); track row.id_election + row.id_brut_miom) {
                              <tr class="hover:bg-[#f0f9fa] transition-colors border-l-4 border-transparent hover:border-[#009AA6]">
                                 <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-xs font-bold text-[#009AA6] uppercase mb-1">{{ row.id_election }}</div>
                                    <div class="text-sm font-bold text-[#333333]">{{ row.label }}</div>
                                    <div class="text-xs text-gray-400 font-mono">{{ row.id_brut_miom }}</div>
                                 </td>
                                 <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">{{ row.inscrits }}</td>
                                 <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                                    <span class="px-2 py-1 rounded text-xs font-bold" [class.bg-red-100]="row.abstention_taux > 30" [class.text-red-700]="row.abstention_taux > 30" [class.bg-green-100]="row.abstention_taux <= 30" [class.text-green-700]="row.abstention_taux <= 30">
                                       {{ row.abstention_taux.toFixed(1) }}%
                                    </span>
                                 </td>
                                 
                                 <td class="px-6 py-4 whitespace-nowrap text-sm pl-8">
                                    <div class="flex items-center gap-4">
                                       <!-- Top 1 -->
                                       @if(row.candidates[0]) {
                                          <div class="flex flex-col w-32">
                                             <span class="font-bold text-[#333333] truncate" [title]="row.candidates[0].nom">{{ row.candidates[0].nom }}</span>
                                             <div class="flex justify-between items-center text-xs">
                                                <span class="bg-gray-100 px-1 rounded text-gray-600">{{ row.candidates[0].nuance }}</span>
                                                <span class="font-bold text-[#009AA6]">{{ row.candidates[0].pourcentage.toFixed(1) }}%</span>
                                             </div>
                                             <div class="w-full bg-gray-200 h-1 mt-1 rounded-full overflow-hidden">
                                                <div class="bg-[#009AA6] h-1" [style.width.%]="row.candidates[0].pourcentage"></div>
                                             </div>
                                          </div>
                                       }
                                       
                                       <!-- VS Separator -->
                                       <span class="text-gray-300 text-xs">vs</span>

                                       <!-- Top 2 -->
                                       @if(row.candidates[1]) {
                                          <div class="flex flex-col w-32 opacity-75">
                                             <span class="font-medium text-gray-600 truncate" [title]="row.candidates[1].nom">{{ row.candidates[1].nom }}</span>
                                             <div class="flex justify-between items-center text-xs">
                                                <span class="bg-gray-100 px-1 rounded text-gray-500">{{ row.candidates[1].nuance }}</span>
                                                <span class="font-bold text-gray-600">{{ row.candidates[1].pourcentage.toFixed(1) }}%</span>
                                             </div>
                                             <div class="w-full bg-gray-200 h-1 mt-1 rounded-full overflow-hidden">
                                                <div class="bg-gray-500 h-1" [style.width.%]="row.candidates[1].pourcentage"></div>
                                             </div>
                                          </div>
                                       }
                                    </div>
                                 </td>
                              </tr>
                           }
                        </tbody>
                     </table>
                   </div>
                 }
               </section>
            }

            <!-- Charts Grid -->
            <section id="pdf-section-elections" class="mt-12">
              <h3 class="text-xl font-bold text-[#005B82] uppercase mb-6 pl-4 border-l-4 border-[#009AA6]">Visualisations par Élection</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (election of currentData(); track election.id_election) {
                  <!-- Each Chart Card is a PDF Block -->
                  <div class="bg-white p-6 shadow-sm border-t-4 border-gray-300 hover:border-[#009AA6] transition-colors group pdf-election-card flex flex-col">
                     <!-- 1. Header with Full Title -->
                     <h4 class="text-lg font-bold text-[#005B82] border-b border-gray-200 pb-2 mb-4">
                        {{ formatElectionLabel(election.id_election) }}
                     </h4>

                     <!-- 2. KPIs Blocks -->
                     <div class="grid grid-cols-2 gap-3 mb-6">
                         <!-- Row 1 -->
                         <div class="bg-blue-50 p-2 rounded border-l-2 border-blue-500 flex flex-col justify-center">
                            <span class="text-[10px] uppercase font-bold text-blue-800 tracking-wider">Inscrits</span>
                            <span class="text-sm font-bold text-[#333333]">{{ election.inscrits }}</span>
                         </div>
                         <div class="bg-teal-50 p-2 rounded border-l-2 border-teal-500 flex flex-col justify-center">
                            <span class="text-[10px] uppercase font-bold text-teal-800 tracking-wider">Exprimés</span>
                            <span class="text-sm font-bold text-[#333333]">{{ election.exprimes }}</span>
                         </div>

                         <!-- Row 2 -->
                         <div class="bg-gray-100 p-2 rounded border-l-2 border-gray-400 flex flex-col justify-center">
                            <span class="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Blancs</span>
                            <span class="text-sm font-bold text-[#333333]">{{ election.blancs }}</span>
                         </div>
                         <div class="bg-orange-50 p-2 rounded border-l-2 border-orange-400 flex flex-col justify-center">
                            <span class="text-[10px] uppercase font-bold text-orange-700 tracking-wider">Nuls</span>
                            <span class="text-sm font-bold text-[#333333]">{{ election.nuls }}</span>
                         </div>
                         
                         <!-- Row 3 (Full width for Abstention) -->
                         <div class="col-span-2 bg-red-50 p-2 rounded border-l-2 border-red-500 flex items-center justify-between">
                            <span class="text-[10px] uppercase font-bold text-red-800 tracking-wider">Abstention</span>
                            <span class="text-sm font-bold text-red-700">{{ election.abstention_taux.toFixed(1) }}%</span>
                         </div>
                     </div>

                     <!-- 3. Chart -->
                     <div class="flex-grow">
                       <app-bar-chart 
                           [data]="formatCandidates(election.candidates)" 
                         />
                     </div>
                  </div>
                }
              </div>
            </section>
          }
        }
      </main>

      <!-- Footer -->
      <footer id="pdf-footer" class="bg-[#333333] text-white py-12 mt-12 border-t-4 border-[#009AA6]">
         <div class="max-w-7xl mx-auto px-4 text-center">
            <h4 class="text-[#009AA6] font-bold text-lg mb-4">ElectoralVision 76</h4>
            <div class="text-gray-400 text-sm max-w-2xl mx-auto space-y-4">
               <p>
                  Plateforme d'analyse territoriale des données électorales.
               </p>
               <div class="border-t border-gray-700 w-24 mx-auto my-6"></div>
               <p class="text-xs text-gray-500 leading-relaxed">
                  Cette application a été développée pour <strong>Caux Seine agglo</strong><br>
                  par la <strong>Direction du Numérique et des Systèmes d'Information</strong><br>
                  <span class="text-[#009AA6]">Cédric GRENET</span> - Décembre 2025
               </p>
            </div>
         </div>
      </footer>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  dataService = inject(DataService);
  aiService = inject(AiService);
  sanitizer = inject(DomSanitizer);

  // Signals
  currentData = this.dataService.currentCommuneData;
  pollingData = this.dataService.currentPollingStationsData;
  
  aiAnalysis = signal<string | null>(null);
  isLoadingAi = signal(false);
  showBvTable = signal(true);
  isGeneratingPdf = signal(false);
  isGeneratingWord = signal(false);
  pdfProgress = signal(0); // Progress bar for UX

  // Filters for Detail Table
  selectedElectionFilter = signal<string>('');
  selectedBureauFilter = signal<string>('');

  ngOnInit() {
     // Attempt to load default data from assets on startup
     this.dataService.loadDefaultData();
  }

  safeAiAnalysis = computed(() => {
    const html = this.aiAnalysis();
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : null;
  });

  abstentionTrend = computed(() => {
    const data = this.currentData();
    if (!data) return [];
    
    return data.map(e => {
        const parts = e.id_election.split('_');
        const year = parts[0];
        const type = parts[1] ? parts[1].toUpperCase() : '';
        const tour = parts[2] ? parts[2].toUpperCase() : '';
        const label = `${year} ${type} ${tour}`.trim();
        
        return {
          label: label,
          value: e.abstention_taux
        };
    }).reverse();
  });

  blancsNulsTrend = computed(() => {
    const data = this.currentData();
    if (!data) return [];
    
    return data.map(e => {
        const parts = e.id_election.split('_');
        const year = parts[0];
        const type = parts[1] ? parts[1].toUpperCase() : '';
        const tour = parts[2] ? parts[2].toUpperCase() : '';
        const label = `${year} ${type} ${tour}`.trim();
        
        // Calculate combined rate relative to voters (votants)
        const rate = e.votants > 0 ? ((e.blancs + e.nuls) / e.votants) * 100 : 0;

        return {
          label: label,
          value: rate
        };
    }).reverse();
  });

  // Derived Options for Selectors
  electionOptions = computed(() => {
     const data = this.pollingData();
     if (!data) return [];
     // Unique list of elections
     return [...new Set(data.map(d => d.id_election))].sort().reverse();
  });

  bureauOptions = computed(() => {
     const data = this.pollingData();
     if (!data) return [];
     // Unique map of bureaus
     const map = new Map<string, string>();
     data.forEach(d => {
        if (d.id_brut_miom) map.set(d.id_brut_miom, d.label);
     });
     
     return Array.from(map.entries())
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
  });

  // Filtered Polling Data
  filteredPollingData = computed(() => {
     let data = this.pollingData();
     if (!data) return [];

     const election = this.selectedElectionFilter();
     const bureau = this.selectedBureauFilter();

     if (election) {
        data = data.filter(d => d.id_election === election);
     }
     if (bureau) {
        data = data.filter(d => d.id_brut_miom === bureau);
     }
     
     return data;
  });

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.dataService.processFiles(input.files);
    }
    input.value = ''; 
  }

  toggleBvTable() {
     this.showBvTable.update(v => !v);
  }

  resetFilters() {
     this.selectedElectionFilter.set('');
     this.selectedBureauFilter.set('');
  }

  resetCommune() {
    this.dataService.clearSelection();
    this.aiAnalysis.set(null);
    this.resetFilters();
  }

  formatCandidates(candidates: any[]) {
    return candidates.slice(0, 5).map(c => ({
      label: c.nom,
      value: c.pourcentage,
      nuance: c.nuance
    }));
  }

  formatElectionLabel(id: string): string {
    const parts = id.split('_');
    const year = parts[0];
    const typeCode = parts[1] ? parts[1].toUpperCase() : '';
    const tour = parts[2] ? parts[2].toUpperCase() : '';

    const typeMap: Record<string, string> = {
      'PRES': 'Présidentielle',
      'LEGI': 'Législatives',
      'EURO': 'Européennes',
      'REGI': 'Régionales',
      'DPMT': 'Départementales',
      'MUNI': 'Municipales',
      'REF': 'Référendum'
    };

    const type = typeMap[typeCode] || typeCode;
    // Format Tour: T1 -> 1er Tour, T2 -> 2nd Tour
    let tourLabel = tour;
    if (tour === 'T1') tourLabel = '1er Tour';
    if (tour === 'T2') tourLabel = '2nd Tour';

    return `${type} ${year}${tourLabel ? ' - ' + tourLabel : ''}`;
  }

  // --- CSV Export Logic ---

  private downloadCsv(content: string, filename: string) {
     // BOM for Excel UTF-8 compatibility
     const bom = '\uFEFF';
     const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement('a');
     const url = URL.createObjectURL(blob);
     
     link.setAttribute('href', url);
     link.setAttribute('download', filename);
     link.style.visibility = 'hidden';
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  }

  exportConsolidatedCsv() {
     const data = this.currentData();
     if (!data || data.length === 0) return;

     // Headers
     const headers = [
        'Election', 'Inscrits', 'Votants', 'Votants (%)', 'Abstentions', 'Abstentions (%)', 'Blancs', 'Nuls', 'Exprimes',
        'Vainqueur', 'Nuance Vainqueur', 'Score Vainqueur (%)',
        'Second', 'Nuance Second', 'Score Second (%)'
     ];

     const rows = data.map(row => {
        const c1 = row.candidates[0];
        const c2 = row.candidates[1];

        return [
           row.id_election,
           row.inscrits,
           row.votants,
           row.participation_taux.toFixed(2),
           row.abstentions,
           row.abstention_taux.toFixed(2),
           row.blancs,
           row.nuls,
           row.exprimes,
           c1 ? c1.nom : '', c1 ? c1.nuance : '', c1 ? c1.pourcentage.toFixed(2) : '',
           c2 ? c2.nom : '', c2 ? c2.nuance : '', c2 ? c2.pourcentage.toFixed(2) : ''
        ].join(';');
     });

     const csvContent = [headers.join(';'), ...rows].join('\n');
     const communeName = data[0].label;
     this.downloadCsv(csvContent, `Consolide_${communeName}.csv`);
  }

  exportPollingCsv() {
     const data = this.filteredPollingData();
     if (!data || data.length === 0) return;

     const headers = [
        'Election', 'ID Bureau', 'Libellé Bureau', 'Inscrits', 'Votants', 'Votants (%)', 'Abstentions', 'Abstentions (%)',
        'Vainqueur', 'Nuance', 'Score (%)',
        'Second', 'Nuance', 'Score (%)'
     ];

     const rows = data.map(row => {
        const c1 = row.candidates[0];
        const c2 = row.candidates[1];

        return [
           row.id_election,
           row.id_brut_miom || '',
           `"${row.label}"`, 
           row.inscrits,
           row.votants,
           row.participation_taux.toFixed(2),
           row.abstentions,
           row.abstention_taux.toFixed(2),
           c1 ? c1.nom : '', c1 ? c1.nuance : '', c1 ? c1.pourcentage.toFixed(2) : '',
           c2 ? c2.nom : '', c2 ? c2.nuance : '', c2 ? c2.pourcentage.toFixed(2) : ''
        ].join(';');
     });

     const csvContent = [headers.join(';'), ...rows].join('\n');
     const communeName = this.currentData()![0].label;
     this.downloadCsv(csvContent, `Detail_Bureaux_${communeName}.csv`);
  }

  // --- EXISTING GENERATE / DOWNLOAD METHODS ---

  async generateAnalysis() {
    const data = this.currentData();
    const polling = this.pollingData();

    if (!data) return;

    this.isLoadingAi.set(true);
    const communeName = data[0].label;
    const result = await this.aiService.analyzeCommune(communeName, data, polling || undefined);
    this.aiAnalysis.set(result);
    this.isLoadingAi.set(false);
  }

  async printElectionsPDF() {
    if (!this.currentData()) return;

    this.isGeneratingPdf.set(true);
    this.pdfProgress.set(5);

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
       const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4'
       });

       const communeName = this.currentData()![0].label;
       const dateStr = new Date().toLocaleDateString('fr-FR');
       const width = pdf.internal.pageSize.getWidth();
       const height = pdf.internal.pageSize.getHeight();

       // --- PAGE DE GARDE ---
       pdf.setFillColor(245, 245, 245); // Light Gray Background
       pdf.rect(0, 0, width, height, 'F');

       // Logo / Titre Principal
       pdf.setTextColor(0, 91, 130); // #005B82
       pdf.setFontSize(26);
       pdf.text("Observatoire Électoral", width / 2, 80, { align: 'center' });
       
       pdf.setTextColor(0, 154, 166); // #009AA6
       pdf.setFontSize(36);
       pdf.setFont('helvetica', 'bold');
       pdf.text("Caux Seine agglo", width / 2, 95, { align: 'center' });

       // Nom de la Commune
       pdf.setTextColor(51, 51, 51);
       pdf.setFontSize(48);
       pdf.text(communeName, width / 2, 140, { align: 'center' });

       // Sous-titre
       pdf.setFontSize(18);
       pdf.setFont('helvetica', 'normal');
       pdf.text("Fiches Résultats par Élection", width / 2, 155, { align: 'center' });

       // Date
       pdf.setFontSize(12);
       pdf.setTextColor(100, 100, 100);
       pdf.text(`Rapport généré le ${dateStr}`, width / 2, 250, { align: 'center' });

       // --- PAGES ELECTIONS ---
       const cards = document.querySelectorAll('.pdf-election-card');
       const cardCount = cards.length;

       for (let i = 0; i < cardCount; i++) {
          this.pdfProgress.set(10 + Math.round((i / cardCount) * 85));
          const card = cards[i] as HTMLElement;

          // Capture
          const canvas = await html2canvas(card, {
             scale: 2,
             useCORS: true,
             logging: false,
             backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          
          // Add Page
          pdf.addPage();
          
          // Header on each page
          pdf.setFontSize(10);
          pdf.setTextColor(0, 91, 130);
          pdf.text(`${communeName} - Fiche Élection`, 10, 10);
          pdf.setDrawColor(0, 154, 166);
          pdf.line(10, 12, width - 10, 12);

          // Fit Image
          const margin = 15;
          const maxImgWidth = width - (margin * 2);
          const maxImgHeight = height - (margin * 2) - 20; // -20 for header

          const ratio = Math.min(maxImgWidth / imgProps.width, maxImgHeight / imgProps.height);
          const finalW = imgProps.width * ratio;
          const finalH = imgProps.height * ratio;

          // Center image
          const x = (width - finalW) / 2;
          const y = 30; // Start below header

          pdf.addImage(imgData, 'PNG', x, y, finalW, finalH);
       }

       // --- PAGINATION ---
       const totalPages = pdf.internal.getNumberOfPages();
       for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(9);
          pdf.setTextColor(150, 150, 150);
          pdf.text(`Page ${i} / ${totalPages}`, width / 2, height - 10, { align: 'center' });
       }

       this.pdfProgress.set(100);
       pdf.save(`Fiches_Elections_${communeName}.pdf`);

    } catch (err) {
       console.error("Erreur PDF Élections:", err);
       alert("Erreur lors de la génération des fiches élections.");
    } finally {
       this.isGeneratingPdf.set(false);
       this.pdfProgress.set(0);
    }
  }

  async downloadReport() {
    if (!this.currentData()) return;

    this.isGeneratingPdf.set(true);
    this.pdfProgress.set(5);

    // Wait longer for DOM reflow
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
       const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
       const pageWidth = 210;
       const pageHeight = 297;
       const margin = 10;
       
       const communeName = this.currentData()![0].label;
       const dateStr = new Date().toLocaleDateString('fr-FR');
       
       // --- 1. PAGE DE GARDE ---
       doc.setFillColor(245, 245, 245);
       doc.rect(0, 0, pageWidth, pageHeight, 'F');
       
       doc.setTextColor(0, 91, 130); // #005B82
       doc.setFontSize(26);
       doc.text("Observatoire Électoral", pageWidth / 2, 80, { align: 'center' });
       
       doc.setTextColor(0, 154, 166); // #009AA6
       doc.setFontSize(36);
       doc.setFont('helvetica', 'bold');
       doc.text("Caux Seine agglo", pageWidth / 2, 95, { align: 'center' });
       
       doc.setTextColor(51, 51, 51);
       doc.setFontSize(48);
       doc.text(communeName, pageWidth / 2, 140, { align: 'center' });
       
       doc.setFontSize(18);
       doc.setFont('helvetica', 'normal');
       doc.text("Rapport Complet d'Analyse", pageWidth / 2, 155, { align: 'center' });
       
       doc.setFontSize(12);
       doc.setTextColor(100, 100, 100);
       doc.text(`Édition du ${dateStr}`, pageWidth / 2, 250, { align: 'center' });

       // --- 2. SOMMAIRE ---
       doc.addPage();
       const tocPageNum = doc.internal.getNumberOfPages();
       const tocEntries: { title: string, page: number }[] = [];

       // --- 3. CONTENU ---

       // 3.1 Analyse IA
       const elAi = document.getElementById('pdf-section-ai');
       if (elAi) {
          doc.addPage();
          tocEntries.push({ title: 'Analyse et Expertise IA', page: doc.internal.getNumberOfPages() });
          
          doc.setFontSize(16); doc.setTextColor(0, 91, 130); doc.setFont('helvetica', 'bold');
          doc.text('Analyse et Expertise IA', margin, margin + 5);
          
          await this.addContentToPdf(doc, elAi, margin, margin + 15, pageWidth, pageHeight);
       }

       // 3.2 Tendances Électorales (Regroupées sur une page)
       const elT1 = document.getElementById('pdf-section-trends-1');
       const elT2 = document.getElementById('pdf-section-trends-2');
       
       if (elT1 && elT2) {
          doc.addPage();
          tocEntries.push({ title: 'Tendances Électorales', page: doc.internal.getNumberOfPages() });
          
          doc.setFontSize(16); doc.setTextColor(0, 91, 130); doc.setFont('helvetica', 'bold');
          doc.text('Tendances Électorales', margin, margin + 5);

          let currentY = margin + 15;
          // Chart 1
          currentY = await this.addContentToPdf(doc, elT1, margin, currentY, pageWidth, pageHeight);
          
          // Chart 2 (Add padding)
          await this.addContentToPdf(doc, elT2, margin, currentY + 10, pageWidth, pageHeight);
       }

       // 3.3 Résultats Consolidés
       const elConso = document.getElementById('pdf-section-consolidated');
       if (elConso) {
          doc.addPage();
          tocEntries.push({ title: 'Résultats Consolidés', page: doc.internal.getNumberOfPages() });
          
          doc.setFontSize(16); doc.setTextColor(0, 91, 130); doc.setFont('helvetica', 'bold');
          doc.text('Résultats Consolidés', margin, margin + 5);
          
          await this.addContentToPdf(doc, elConso, margin, margin + 15, pageWidth, pageHeight);
       }

       // --- 4. FICHES ÉLECTIONS (2 par page) ---
       const cards = document.querySelectorAll('.pdf-election-card');
       if (cards.length > 0) {
          doc.addPage();
          tocEntries.push({ title: 'Fiches Résultats par Élection', page: doc.internal.getNumberOfPages() });
          
          doc.setFontSize(16);
          doc.setTextColor(0, 91, 130);
          doc.text("Fiches Résultats par Élection", margin, margin + 5);

          let currentY = margin + 15;
          
          for (let i = 0; i < cards.length; i++) {
             const card = cards[i] as HTMLElement;
             this.pdfProgress.set(50 + Math.round((i / cards.length) * 40));

             const canvas = await html2canvas(card, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
             const imgData = canvas.toDataURL('image/jpeg', 0.95);
             const imgProps = doc.getImageProperties(imgData);
             
             const availableWidth = pageWidth - (margin * 2);
             const imgHeight = (imgProps.height * availableWidth) / imgProps.width;

             // Check if fits on current page
             if (currentY + imgHeight > pageHeight - margin) {
                doc.addPage();
                currentY = margin + 10;
             }

             doc.addImage(imgData, 'JPEG', margin, currentY, availableWidth, imgHeight);
             currentY += imgHeight + 10; // Space between cards
          }
       }

       // --- 5. REMPLIR LE SOMMAIRE ---
       doc.setPage(tocPageNum);
       doc.setFontSize(22);
       doc.setTextColor(0, 91, 130);
       doc.text("Sommaire", pageWidth / 2, 40, { align: 'center' });
       
       doc.setFontSize(12);
       doc.setTextColor(51, 51, 51);
       let tocY = 60;
       
       tocEntries.forEach(entry => {
          doc.text(entry.title, 20, tocY);
          doc.text(entry.page.toString(), pageWidth - 20, tocY, { align: 'right' });
          
          // Dotted line
          const textWidth = doc.getTextWidth(entry.title);
          const dotsStart = 20 + textWidth + 2;
          const dotsEnd = pageWidth - 25;
          doc.setDrawColor(200, 200, 200);
          doc.line(dotsStart, tocY, dotsEnd, tocY); // Simple line instead of dots for cleanliness
          
          tocY += 12;
       });

       // --- 6. PAGINATION GLOBALE ---
       const totalPages = doc.internal.getNumberOfPages();
       for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
       }

       this.pdfProgress.set(100);
       doc.save(`Rapport_Complet_${communeName}.pdf`);

    } catch (err) {
       console.error("Erreur génération PDF:", err);
       alert("Une erreur est survenue lors de la création du PDF. Vérifiez la console.");
    } finally {
       this.isGeneratingPdf.set(false);
       this.pdfProgress.set(0);
    }
  }

  // Helper for normal content (fit to page or shrink) - Returns new Y position
  private async addContentToPdf(doc: jsPDF, element: HTMLElement, x: number, y: number, pageWidth: number, pageHeight: number): Promise<number> {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgProps = doc.getImageProperties(imgData);
      
      const maxWidth = pageWidth - (x * 2);
      const maxHeight = pageHeight - y - 20;

      let finalW = maxWidth;
      let finalH = (imgProps.height * maxWidth) / imgProps.width;

      // If too tall, shrink to fit one page (simple behavior)
      if (finalH > maxHeight) {
         const ratio = maxHeight / finalH;
         finalW = finalW * ratio;
         finalH = maxHeight;
      }

      doc.addImage(imgData, 'JPEG', x, y, finalW, finalH);
      return y + finalH;
  }

  // Helper for LONG content (Table slicing)
  private async addLongContentToPdf(doc: jsPDF, element: HTMLElement, x: number, startY: number, pageWidth: number, pageHeight: number) {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const contentWidth = pageWidth - (x * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      
      let heightLeft = contentHeight;
      let position = 0; // offset in PDF units
      
      // First page chunk
      let pageCanvasY = startY;
      let availableHeight = pageHeight - startY - 20;

      // Add first chunk
      // addImage(data, fmt, x, y, w, h) -> writes the WHOLE image scaled.
      // To crop, we rely on PDF page break logic manually by shifting the image up.
      
      // Actually, jsPDF handles 'clipping' by just not showing what's outside the page.
      // Strategy: Add the full image, but shifted up for subsequent pages.
      
      doc.addImage(imgData, 'JPEG', x, pageCanvasY, contentWidth, contentHeight);
      heightLeft -= availableHeight;
      position -= availableHeight; // Move the "virtual" top of the image up

      while (heightLeft > 0) {
         doc.addPage();
         
         // New page starts at margin
         pageCanvasY = x; // margin
         availableHeight = pageHeight - (x * 2);
         
         // We add the image again, but positioned HIGHER up (negative Y) so only the next chunk is visible
         // Warning: This implies the top part is drawn "off canvas" above.
         // Calculation: We need the image to be placed such that the previous 'bottom' is now at 'top'.
         
         // Correct Y position for the image object:
         // The image always has height `contentHeight`.
         // We want to shift it up by `contentHeight - heightLeft` ? No.
         // We want to shift it by the amount already printed.
         
         // `position` tracks negative offset from previous iterations.
         // Actually, simpler logic:
         // 1. Page 1: y = startY. Image Top is at startY.
         // 2. Page 2: Image Top should be at (margin - amount_already_shown).
         
         const amountAlreadyShown = contentHeight - heightLeft;
         const newY = x - amountAlreadyShown + (startY - x); // Adjust for initial startY offset difference

         // However, standard `addImage` doesn't crop. It prints the whole thing.
         // To properly "slice", we should really use context clipping, but that's complex in jsPDF top-level.
         // The standard workaround is indeed printing the image with negative Y.
         // Let's try the negative Y approach.
         
         // Recalculate precisely:
         // Total H = 1000. Page 1 shows 0-250.
         // Page 2 needs to show 250-500.
         // So we place image at Y = -250 + margin.
         
         const shift = contentHeight - heightLeft;
         doc.addImage(imgData, 'JPEG', x, startY - shift, contentWidth, contentHeight);
         
         // Masking top (header area) to be white if needed? 
         // Usually jsPDF clips to page bounds. But if we have a header on every page (we don't here), it would overlap.
         // Here we just add blank pages.
         
         heightLeft -= availableHeight;
      }
  }

  async downloadWord() {
    if (!this.currentData()) return;

    this.isGeneratingWord.set(true);
    this.pdfProgress.set(5);

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
       const docx = await import('docx');
       const { Document, Packer, Paragraph, ImageRun } = docx;
       const fileSaver = await import('file-saver');
       const saveAs = fileSaver.saveAs || fileSaver.default || fileSaver;

       const blocks = document.querySelectorAll('.pdf-block');
       const blockCount = blocks.length;
       const docSections: any[] = [];

       for (let i = 0; i < blockCount; i++) {
          const element = blocks[i] as HTMLElement;
          this.pdfProgress.set(10 + Math.round((i / blockCount) * 80));

          const canvas = await html2canvas(element, {
             scale: 2,
             useCORS: true,
             logging: false,
             backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/png');
          const blob = await (await fetch(imgData)).blob();
          const buffer = await blob.arrayBuffer();

          const maxWidth = 600;
          const scale = maxWidth / canvas.width;
          const finalWidth = maxWidth;
          const finalHeight = canvas.height * scale;

          const imageRun = new ImageRun({
             data: buffer,
             transformation: {
                width: finalWidth,
                height: finalHeight,
             },
          });

          docSections.push(
             new Paragraph({
                children: [imageRun],
                spacing: { after: 200 },
             })
          );
       }

       const doc = new Document({
          sections: [{
             properties: {},
             children: docSections,
          }],
       });

       const blob = await Packer.toBlob(doc);
       const communeName = this.currentData()![0].label;
       const date = new Date().toISOString().slice(0,10);
       saveAs(blob, `Rapport_${communeName}_${date}.docx`);

    } catch (err) {
       console.error("Erreur génération Word:", err);
       alert("Une erreur est survenue lors de la création du fichier Word.");
    } finally {
       this.isGeneratingWord.set(false);
       this.pdfProgress.set(0);
    }
  }
}
