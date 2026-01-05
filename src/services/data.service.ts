import { Injectable, signal, computed } from '@angular/core';

export interface GeneralResult {
  id_election: string;
  id_brut_miom: string;
  code_commune: string;
  libelle_commune: string;
  inscrits: number;
  votants: number;
  abstentions: number;
  blancs: number;
  nuls: number;
  exprimes: number;
}

export interface CandidateResult {
  id_election: string;
  id_brut_miom: string;
  nom: string;
  nuance: string;
  voix: number;
  pourcentage: number; // calculated or from csv
}

export interface AggregatedResult {
  id_election: string;
  scope: 'COMMUNE' | 'BUREAU';
  id_brut_miom?: string; // Only for scope BUREAU
  label: string; // Commune name or "Bureau X"
  inscrits: number;
  votants: number;
  abstentions: number;
  blancs: number;
  nuls: number;
  exprimes: number;
  participation_taux: number;
  abstention_taux: number;
  candidates: { nom: string; nuance: string; voix: number; pourcentage: number }[];
  nuances: { nuance: string; voix: number; pourcentage: number }[];
}

export interface Commune {
  code: string;
  libelle: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  // Raw Data Signals
  private generalData = signal<GeneralResult[]>([]);
  private candidateData = signal<CandidateResult[]>([]);
  private reuData = signal<Map<string, string>>(new Map()); // id_brut_miom -> address/label
  
  // State
  isLoading = signal<boolean>(false);
  loadingMessage = signal<string>(''); // Detailed loading status
  
  // Loaded Status Flags
  generalCount = computed(() => this.generalData().length);
  candidateCount = computed(() => this.candidateData().length);
  reuCount = computed(() => this.reuData().size);
  
  isGeneralLoaded = computed(() => this.generalCount() > 0);
  isCandidatesLoaded = computed(() => this.candidateCount() > 0);
  isReuLoaded = computed(() => this.reuCount() > 0);
  
  // App is ready if we have general results
  dataLoaded = computed(() => this.isGeneralLoaded());
  
  selectedCommuneCode = signal<string | null>(null);

  // 1. Available Communes (Derived from loaded data)
  availableCommunes = computed(() => {
    const data = this.generalData();
    const map = new Map<string, string>();
    // Use a loop for performance on large arrays
    for (let i = 0; i < data.length; i++) {
      const code = data[i].code_commune;
      const label = data[i].libelle_commune;
      // Filter out empty keys/labels
      if (code && label && !map.has(code)) {
        map.set(code, label);
      }
    }
    return Array.from(map.entries())
      .map(([code, libelle]) => ({ code, libelle }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle));
  });

  // 2. Aggregated Data for Selected Commune (Commune Scale)
  currentCommuneData = computed(() => {
    const code = this.selectedCommuneCode();
    const general = this.generalData();
    const candidates = this.candidateData();
    
    if (!code || general.length === 0) return null;

    // Filter for current commune
    const communeGeneral = general.filter(r => r.code_commune === code);
    
    // Group by election to sum values (Commune level aggregation)
    const electionsMap = new Map<string, AggregatedResult>();

    communeGeneral.forEach(g => {
      if (!electionsMap.has(g.id_election)) {
        electionsMap.set(g.id_election, {
          id_election: g.id_election,
          scope: 'COMMUNE',
          label: g.libelle_commune,
          inscrits: 0, votants: 0, abstentions: 0, blancs: 0, nuls: 0, exprimes: 0,
          participation_taux: 0, abstention_taux: 0,
          candidates: [], nuances: []
        });
      }
      const agg = electionsMap.get(g.id_election)!;
      agg.inscrits += g.inscrits;
      agg.votants += g.votants;
      agg.abstentions += g.abstentions;
      agg.blancs += g.blancs;
      agg.nuls += g.nuls;
      agg.exprimes += g.exprimes;
    });

    // Process candidates for this commune
    // Pre-filter candidates (perf optimization)
    const validIds = new Set(communeGeneral.map(g => `${g.id_election}_${g.id_brut_miom}`));
    const communeCandidates = candidates.filter(c => validIds.has(`${c.id_election}_${c.id_brut_miom}`));

    // Aggregate candidates per election
    const candAggMap = new Map<string, Map<string, {nom: string, nuance: string, voix: number}>>();

    communeCandidates.forEach(c => {
      if (!candAggMap.has(c.id_election)) candAggMap.set(c.id_election, new Map());
      const electionGroup = candAggMap.get(c.id_election)!;
      
      const key = `${c.nom}_${c.nuance}`;
      if (!electionGroup.has(key)) {
        electionGroup.set(key, { nom: c.nom, nuance: c.nuance, voix: 0 });
      }
      electionGroup.get(key)!.voix += c.voix;
    });

    // Finalize Commune Aggregation
    const result: AggregatedResult[] = [];
    electionsMap.forEach((agg, electionId) => {
      // Rates
      agg.participation_taux = agg.inscrits > 0 ? (agg.votants / agg.inscrits) * 100 : 0;
      agg.abstention_taux = agg.inscrits > 0 ? (agg.abstentions / agg.inscrits) * 100 : 0;

      // Candidates
      const cands = candAggMap.get(electionId);
      if (cands) {
        agg.candidates = Array.from(cands.values())
          .map(c => ({
            ...c,
            pourcentage: agg.exprimes > 0 ? (c.voix / agg.exprimes) * 100 : 0
          }))
          .sort((a, b) => b.voix - a.voix);
        
        // Nuances
        const nMap = new Map<string, number>();
        agg.candidates.forEach(c => nMap.set(c.nuance, (nMap.get(c.nuance) || 0) + c.voix));
        agg.nuances = Array.from(nMap.entries())
          .map(([nuance, voix]) => ({
            nuance,
            voix,
            pourcentage: agg.exprimes > 0 ? (voix / agg.exprimes) * 100 : 0
          }))
          .sort((a, b) => b.voix - a.voix);
      }
      result.push(agg);
    });

    return result.sort((a, b) => b.id_election.localeCompare(a.id_election));
  });

  // 3. Detailed Data by Polling Station (Bureau Scale)
  currentPollingStationsData = computed(() => {
     const code = this.selectedCommuneCode();
     const general = this.generalData();
     const candidates = this.candidateData();
     const reu = this.reuData();
     
     if (!code || general.length === 0) return null;
 
     // Filter for current commune
     const communeGeneral = general.filter(r => r.code_commune === code);
     const validIds = new Set(communeGeneral.map(g => `${g.id_election}_${g.id_brut_miom}`));
     const communeCandidates = candidates.filter(c => validIds.has(`${c.id_election}_${c.id_brut_miom}`));
 
     // Create a result object for every row in general results
     const results: AggregatedResult[] = communeGeneral.map(g => {
        // Resolve label from REU if available
        let label = `Bureau ${g.id_brut_miom.split('_').pop()}`;
        if (reu.has(g.id_brut_miom)) {
           label = reu.get(g.id_brut_miom)!;
        }

        const agg: AggregatedResult = {
           id_election: g.id_election,
           scope: 'BUREAU',
           id_brut_miom: g.id_brut_miom,
           label: label,
           inscrits: g.inscrits,
           votants: g.votants,
           abstentions: g.abstentions,
           blancs: g.blancs,
           nuls: g.nuls,
           exprimes: g.exprimes,
           participation_taux: g.inscrits > 0 ? (g.votants / g.inscrits) * 100 : 0,
           abstention_taux: g.inscrits > 0 ? (g.abstentions / g.inscrits) * 100 : 0,
           candidates: [],
           nuances: []
        };

        // Find candidates for this specific bureau and election
        const stationCandidates = communeCandidates.filter(c => c.id_election === g.id_election && c.id_brut_miom === g.id_brut_miom);
        
        agg.candidates = stationCandidates.map(c => ({
           nom: c.nom,
           nuance: c.nuance,
           voix: c.voix,
           pourcentage: g.exprimes > 0 ? (c.voix / g.exprimes) * 100 : 0
        })).sort((a, b) => b.voix - a.voix);

        // Calculate nuances
        const nMap = new Map<string, number>();
        agg.candidates.forEach(c => nMap.set(c.nuance, (nMap.get(c.nuance) || 0) + c.voix));
        agg.nuances = Array.from(nMap.entries())
          .map(([nuance, voix]) => ({
            nuance,
            voix,
            pourcentage: g.exprimes > 0 ? (voix / g.exprimes) * 100 : 0
          }))
          .sort((a, b) => b.voix - a.voix);

        return agg;
     });

     return results.sort((a, b) => {
        const dateComp = b.id_election.localeCompare(a.id_election);
        if (dateComp !== 0) return dateComp;
        return (a.id_brut_miom || '').localeCompare(b.id_brut_miom || '');
     });
  });

  selectCommune(code: string) {
    this.selectedCommuneCode.set(code);
  }

  clearSelection() {
    this.selectedCommuneCode.set(null);
  }

  // --- DATA LOADING LOGIC (ASYNC & STREAMED) ---

  /**
   * Helper to determine file type and process it asynchronously without blocking UI
   */
  private async processTextContentAsync(
    text: string, 
    filename: string, 
    accGeneral: GeneralResult[], 
    accCandidates: CandidateResult[], 
    accReu: Map<string, string>
  ) {
    // 1. Detect file type from header (first line)
    const firstLineEnd = text.indexOf('\n');
    if (firstLineEnd === -1) return; // Empty or single line file

    const firstLine = text.substring(0, firstLineEnd).replace(/^\uFEFF/, '').trim(); // Remove BOM
    const separator = firstLine.includes(';') ? ';' : ',';
    const headers = firstLine.toLowerCase().split(separator).map(h => h.trim().replace(/"/g, ''));
    
    // Check type
    if (this.isGeneralHeader(headers)) {
      this.loadingMessage.set(`Parsing Général: ${filename}...`);
      await this.parseGeneralCSVAsync(text, headers, separator, accGeneral, filename);
    
    } else if (this.isCandidateHeader(headers)) {
      this.loadingMessage.set(`Parsing Candidats: ${filename}...`);
      await this.parseCandidateCSVAsync(text, headers, separator, accCandidates, filename);

    } else if (this.isReuHeader(headers)) {
      this.loadingMessage.set(`Parsing REU: ${filename}...`);
      await this.parseReuCSVAsync(text, headers, separator, accReu, filename);
      
    } else {
      console.warn(`[DataService] File type not recognized: ${filename}`);
    }
  }

  /**
   * Loads default data from 'assets/data/' folder automatically
   */
  async loadDefaultData() {
    this.isLoading.set(true);
    this.loadingMessage.set('Chargement des données locales...');
    
    const filesToTry = [
      'assets/data/resultats.csv',
      'assets/data/candidats.csv',
      'assets/data/bureaux.csv',
      'assets/data/general.csv',
      'assets/data/resultats_globaux.csv',
      'assets/data/resultats_candidats.csv'
    ];

    let newGeneral = [...this.generalData()];
    let newCandidates = [...this.candidateData()];
    const newReu = new Map<string, string>(this.reuData());

    try {
      let loadedCount = 0;
      for (const url of filesToTry) {
         try {
            this.loadingMessage.set(`Téléchargement ${url}...`);
            const response = await fetch(url);
            if (response.ok) {
               // Get raw text
               const text = await response.text();
               const filename = url.split('/').pop() || 'unknown';
               // Process async
               await this.processTextContentAsync(text, filename, newGeneral, newCandidates, newReu);
               loadedCount++;
            }
         } catch (e) {
            console.debug(`File not found or error: ${url}`);
         }
      }

      if (loadedCount > 0) {
        this.finishLoading(newGeneral, newCandidates, newReu);
      }
    } finally {
      this.isLoading.set(false);
      this.loadingMessage.set('');
    }
  }

  /**
   * Processes files uploaded by the user via file input
   */
  async processFiles(fileList: FileList) {
    this.isLoading.set(true);
    const files = Array.from(fileList);
    
    let newGeneral = [...this.generalData()];
    let newCandidates = [...this.candidateData()];
    const newReu = new Map<string, string>(this.reuData());

    try {
      for (const file of files) {
        this.loadingMessage.set(`Lecture de ${file.name} (peut être long)...`);
        // Read file using FileReader
        const text = await this.readFile(file);
        // Process content iteratively
        await this.processTextContentAsync(text, file.name, newGeneral, newCandidates, newReu);
      }

      this.finishLoading(newGeneral, newCandidates, newReu);

    } catch (err) {
      console.error("Error processing files", err);
      alert("Erreur lors de la lecture des fichiers.");
    } finally {
      this.isLoading.set(false);
      this.loadingMessage.set('');
    }
  }

  private finishLoading(gen: GeneralResult[], cand: CandidateResult[], reu: Map<string, string>) {
    this.loadingMessage.set('Consolidation...');
    this.generalData.set(gen);
    this.candidateData.set(cand);
    this.reuData.set(reu);
    
    // Auto-select if first load
    if (!this.selectedCommuneCode()) {
       const available = this.availableCommunes();
       if (available.length > 0) {
         this.selectCommune(available[0].code);
       }
    }
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  // --- ASYNC PARSING IMPLEMENTATION (YIELDING) ---

  // Yield to main thread every N lines to prevent UI freeze
  private async yieldToMainThread() {
     await new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Generic Async CSV Parser. 
   * Iterates over string by finding \n indices instead of .split() which consumes huge memory.
   */
  private async parseCSVLoop(
    content: string, 
    separator: string, 
    onBatch: (lines: string[][]) => void
  ) {
    let startIndex = 0;
    // Skip header line
    let firstLineBreak = content.indexOf('\n');
    if (firstLineBreak === -1) return;
    startIndex = firstLineBreak + 1;

    const len = content.length;
    let batch: string[][] = [];
    const BATCH_SIZE = 2000; // Process 2000 rows before yielding

    // Loop through content
    while (startIndex < len) {
      // Find end of current line
      let endIndex = content.indexOf('\n', startIndex);
      if (endIndex === -1) endIndex = len;

      // Extract raw line
      const line = content.substring(startIndex, endIndex).trim();
      
      // Advance pointer
      startIndex = endIndex + 1;

      if (!line) continue;

      // Parse columns
      // Note: simple split is fast but doesn't handle escaped quotes inside fields perfectly. 
      // For performance on 60MB files, strict RFC4180 parsing is extremely slow in pure JS without a library like PapaParse.
      // We assume mostly standard CSVs here.
      const row = line.split(separator).map(c => c.trim().replace(/"/g, ''));
      batch.push(row);

      // If batch full, process and yield
      if (batch.length >= BATCH_SIZE) {
        onBatch(batch);
        batch = [];
        // Update progress in UI implicitly by yielding
        await this.yieldToMainThread();
      }
    }
    
    // Flush remaining
    if (batch.length > 0) {
      onBatch(batch);
    }
  }

  // --- SPECIFIC PARSERS ---

  private async parseGeneralCSVAsync(content: string, headers: string[], separator: string, acc: GeneralResult[], filename: string) {
    // Map Indexes
    const idx = {
       id_election: this.findIdx(headers, ['id_election', 'code_election', 'code election']),
       id_brut_miom: this.findIdx(headers, ['id_brut_miom', 'id_bv', 'code_bureau']),
       code_commune: this.findIdx(headers, ['code_commune', 'codcom', 'code commune', 'code de la commune', 'cod_com', 'code_insee', 'codgeo']),
       libelle_commune: -1,
       inscrits: this.findIdx(headers, ['inscrit']),
       votants: this.findIdx(headers, ['votant']),
       abstentions: this.findIdx(headers, ['abstention']),
       blancs: this.findIdx(headers, ['blanc']),
       nuls: this.findIdx(headers, ['nul']),
       exprimes: this.findIdx(headers, ['exprim']),
    };

    const libelleKeywords = ['libelle_commune', 'libcom', 'libellé commune', 'libellé de la commune', 'libelle de la commune', 'nom de la commune'];
    idx.libelle_commune = this.findIdx(headers, libelleKeywords);
    if (idx.libelle_commune === -1) idx.libelle_commune = this.findIdxExcluding(headers, ['commune'], ['code', 'id']);

    if (idx.id_election === -1 || idx.id_brut_miom === -1) {
       console.error(`[DataService] Missing columns in General: ${filename}`);
       return;
    }

    const minCols = Math.max(...Object.values(idx));
    const existingIds = new Set(acc.map(g => `${g.id_election}_${g.id_brut_miom}`));
    let rowCount = 0;

    await this.parseCSVLoop(content, separator, (batch) => {
        const validRows: GeneralResult[] = [];
        for (const row of batch) {
           if (row.length <= minCols) continue;
           
           const idElec = row[idx.id_election];
           const idBv = row[idx.id_brut_miom];
           const key = `${idElec}_${idBv}`;

           if (!existingIds.has(key)) {
             existingIds.add(key); // prevent dupe in same file processing
             validRows.push({
                id_election: idElec,
                id_brut_miom: idBv,
                code_commune: idx.code_commune > -1 ? row[idx.code_commune] : '',
                libelle_commune: idx.libelle_commune > -1 ? row[idx.libelle_commune] : '',
                inscrits: idx.inscrits > -1 ? (parseInt(row[idx.inscrits]) || 0) : 0,
                votants: idx.votants > -1 ? (parseInt(row[idx.votants]) || 0) : 0,
                abstentions: idx.abstentions > -1 ? (parseInt(row[idx.abstentions]) || 0) : 0,
                blancs: idx.blancs > -1 ? (parseInt(row[idx.blancs]) || 0) : 0,
                nuls: idx.nuls > -1 ? (parseInt(row[idx.nuls]) || 0) : 0,
                exprimes: idx.exprimes > -1 ? (parseInt(row[idx.exprimes]) || 0) : 0,
             });
           }
        }
        acc.push(...validRows);
        rowCount += validRows.length;
        this.loadingMessage.set(`Parsing Général: ${rowCount} lignes...`);
    });
    
    console.log(`[DataService] Finished General: ${rowCount} rows.`);
  }

  private async parseCandidateCSVAsync(content: string, headers: string[], separator: string, acc: CandidateResult[], filename: string) {
    const idx = {
      id_election: this.findIdx(headers, ['id_election', 'code_election']),
      id_brut_miom: this.findIdx(headers, ['id_brut_miom', 'id_bv']),
      tete_liste: this.findIdx(headers, ['tete_de_liste', 'tête de liste', 'libelle_liste', 'libellé liste', 'libelle_abrege_liste', 'nom_tete_liste', 'nom de la liste', 'libellé de la liste']),
      nom: this.findIdxExcluding(headers, ['nom', 'candidat', 'libelle_candidat'], ['liste', 'nuance', 'commune', 'bureau', 'voix']),
      prenom: this.findIdx(headers, ['prenom', 'prénom']),
      nuance: this.findIdx(headers, ['nuance', 'codnua']),
      voix: this.findIdx(headers, ['voix', 'nb_voix'])
    };

    if (idx.id_election === -1 || idx.id_brut_miom === -1) {
       console.error(`[DataService] Missing columns in Candidates: ${filename}`);
       return;
    }

    const minCols = Math.max(...Object.values(idx));
    let rowCount = 0;

    await this.parseCSVLoop(content, separator, (batch) => {
        const validRows: CandidateResult[] = [];
        for (const row of batch) {
           if (row.length <= minCols) continue;

           const valTete = idx.tete_liste > -1 ? row[idx.tete_liste] : '';
           const valNom = idx.nom > -1 ? row[idx.nom] : '';
           const valPrenom = idx.prenom > -1 ? row[idx.prenom] : '';
     
           let finalName = 'Inconnu';
           if (valTete && valTete.trim()) {
              finalName = valTete;
           } else if (valNom && valNom.trim()) {
              finalName = valNom + (valPrenom ? ` ${valPrenom}` : '');
           }

           validRows.push({
             id_election: row[idx.id_election],
             id_brut_miom: row[idx.id_brut_miom],
             nom: finalName,
             nuance: idx.nuance > -1 ? row[idx.nuance] : '',
             voix: idx.voix > -1 ? (parseInt(row[idx.voix]) || 0) : 0,
             pourcentage: 0 
           });
        }
        acc.push(...validRows);
        rowCount += validRows.length;
        this.loadingMessage.set(`Parsing Candidats: ${rowCount} lignes...`);
    });
    console.log(`[DataService] Finished Candidates: ${rowCount} rows.`);
  }

  private async parseReuCSVAsync(content: string, headers: string[], separator: string, acc: Map<string, string>, filename: string) {
     const idx = {
        id_brut_miom: this.findIdx(headers, ['id_brut_miom', 'code_bureau']),
        libelle: this.findIdx(headers, ['libelle_lieu', 'libellé lieu', 'lieu de vote', 'libelle']),
        adresse: this.findIdx(headers, ['adresse', 'libelle_voie', 'voie']),
     };

     if (idx.id_brut_miom === -1) return;

     let count = 0;
     await this.parseCSVLoop(content, separator, (batch) => {
        for (const row of batch) {
           if (row[idx.id_brut_miom]) {
              let labelParts = [];
              if (idx.libelle > -1 && row[idx.libelle]) labelParts.push(row[idx.libelle]);
              if (idx.adresse > -1 && row[idx.adresse]) labelParts.push(row[idx.adresse]);
              
              if (labelParts.length > 0) {
                 acc.set(row[idx.id_brut_miom], labelParts.join(' - '));
              }
           }
        }
        count += batch.length;
        this.loadingMessage.set(`Parsing REU: ${count} entrées...`);
     });
     console.log(`[DataService] Finished REU: ${count} entries.`);
  }

  // --- HEADER DETECTION HELPERS ---

  private isGeneralHeader(h: string[]): boolean {
    const hasInscrits = h.some(x => x.includes('inscrit'));
    const hasVotants = h.some(x => x.includes('votant'));
    const hasExprime = h.some(x => x.includes('exprim'));
    return hasInscrits && hasVotants && hasExprime;
  }

  private isCandidateHeader(h: string[]): boolean {
    const hasNuance = h.some(x => x.includes('nuance'));
    const hasNom = h.some(x => x.includes('nom') || x.includes('candidat') || x.includes('libelle_cand'));
    const hasInscrits = h.some(x => x.includes('inscrit'));
    return (hasNuance || hasNom) && !hasInscrits;
  }

  private isReuHeader(h: string[]): boolean {
    const hasId = h.some(x => x.includes('id_brut_miom') || x.includes('code_bureau'));
    const hasLieu = h.some(x => x.includes('lieu') || x.includes('adresse') || x.includes('libelle'));
    const hasVotants = h.some(x => x.includes('votant'));
    return hasId && hasLieu && !hasVotants;
  }

  // Helper to find index strictly or loosely
  private findIdx(headers: string[], keywords: string[]): number {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  }

  // New Helper: Find index containing ANY keyword BUT NOT containing ANY exclude word
  private findIdxExcluding(headers: string[], keywords: string[], exclude: string[]): number {
    return headers.findIndex(h => 
      keywords.some(k => h.includes(k)) && 
      !exclude.some(e => h.includes(e))
    );
  }
}
