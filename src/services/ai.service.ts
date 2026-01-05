import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { AggregatedResult } from './data.service';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  
  constructor() {}

  async analyzeCommune(communeName: string, data: AggregatedResult[], pollingData?: AggregatedResult[]): Promise<string> {
    // Accessing the key strictly from the environment variable at runtime
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.warn("API Key is missing in process.env.API_KEY");
      return `
        <div class="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded text-sm">
          <strong>Module IA non activé :</strong> La clé d'API n'est pas configurée dans l'environnement.
        </div>
      `;
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    // --- PRÉPARATION DU CONTEXTE DE DONNÉES ---

    // 1. Tri chronologique pour une meilleure lecture des tendances
    const sortedData = [...data].sort((a, b) => a.id_election.localeCompare(b.id_election));
    
    // 2. Contexte Global (Commune)
    const globalContext = sortedData.map(e => {
      const topNuances = e.nuances.slice(0, 5).map(n => `${n.nuance}: ${n.pourcentage.toFixed(1)}%`).join(', ');
      return `- [${e.id_election}] Participation: ${e.participation_taux.toFixed(1)}% (Abstention: ${e.abstention_taux.toFixed(1)}%). Forces en présence: ${topNuances}`;
    }).join('\n');

    // 3. Contexte Spécifique Municipales
    const muniData = sortedData.filter(e => e.id_election.toLowerCase().includes('muni'));
    const muniContext = muniData.length > 0 
      ? muniData.map(e => {
          const winner = e.candidates[0];
          return `- [${e.id_election}] Part.: ${e.participation_taux.toFixed(1)}%. Tête: ${winner?.nom} (${winner?.nuance}) à ${winner?.pourcentage.toFixed(1)}%.`;
        }).join('\n')
      : "Aucune donnée spécifique identifiée comme 'muni' (municipales).";

    // 4. Contexte Détaillé par Bureau
    let bureauxContext = "Données détaillées par bureau non disponibles ou commune à bureau unique (voir analyse globale).";
    if (pollingData && pollingData.length > 0) {
       // Groupement par élection
       const byElection = new Map<string, AggregatedResult[]>();
       pollingData.forEach(p => {
          if(!byElection.has(p.id_election)) byElection.set(p.id_election, []);
          byElection.get(p.id_election)!.push(p);
       });
       
       // Trie des clés (élections)
       const sortedElectionIds = Array.from(byElection.keys()).sort();

       bureauxContext = sortedElectionIds.map(electionId => {
            const bvs = byElection.get(electionId)!;
            // Trie des bureaux par ID
            bvs.sort((a, b) => (a.id_brut_miom || '').localeCompare(b.id_brut_miom || ''));

            const bvDetails = bvs.map(b => {
               const topN = b.nuances.slice(0, 2).map(n => `${n.nuance} ${n.pourcentage.toFixed(0)}%`).join(', ');
               return `  * ${b.label} (ID: ${b.id_brut_miom}): Abs. ${b.abstention_taux.toFixed(0)}% | Top: ${topN}`;
            }).join('\n');
            return `[DÉTAIL ${electionId}]\n${bvDetails}`;
         }).join('\n\n');
    }

    // --- CONSTRUCTION DU PROMPT ---

    const prompt = `
      Tu es un analyste expert en données électorales françaises, spécialisé dans l’analyse communale et infra-communale (bureaux de vote).

      Contexte
      Tu disposes des fichiers de résultats électoraux pour la commune de "${communeName}".
      
      DONNÉES GLOBALES (Résultats consolidés sur la commune):
      ${globalContext}

      FOCUS MUNICIPALES (Données spécifiques):
      ${muniContext}

      ANALYSE DÉTAILLÉE PAR BUREAU DE VOTE:
      ${bureauxContext}

      Objectif général
      Produire une analyse claire, rigoureuse et exploitable des dynamiques électorales à l’échelle communale et des bureaux de vote, en identifiant les évolutions politiques, les rapports de force et les tendances structurantes.

      Contraintes d’analyse
      - Toujours distinguer clairement les communes à bureau unique (considérées comme un tout) et celles à bureaux multiples (analyse de l'hétérogénéité).
      - Utiliser un vocabulaire neutre, analytique et factuel.
      - Ne pas inventer de données.

      Structure attendue de l’analyse (Le format de sortie DOIT être du HTML propre, sans markdown, avec les classes CSS Tailwind indiquées) :

      <div class="space-y-6">
        <section>
          <h3 class="text-lg font-bold text-[#005B82] uppercase border-b border-[#009AA6] pb-1 mb-3">1. Analyse générale et Dynamiques</h3>
          <div class="text-sm text-slate-700 space-y-2 text-justify">
             [Panorama global. Évolution des nuances politiques. Forces dominantes vs en recul. Comparaison 1er/2nd tour (reports, mobilisation).]
          </div>
        </section>

        <section>
          <h3 class="text-lg font-bold text-[#005B82] uppercase border-b border-[#009AA6] pb-1 mb-3">2. Focus Élections Municipales</h3>
          <div class="text-sm text-slate-700 space-y-2 text-justify">
             [Analyse chronologique spécifique. Ancrage local vs national. Continuités ou ruptures des majorités locales.]
          </div>
        </section>

        <section>
          <h3 class="text-lg font-bold text-[#005B82] uppercase border-b border-[#009AA6] pb-1 mb-3">3. Analyse par Bureau de Vote</h3>
          <div class="text-sm text-slate-700 space-y-2 text-justify">
             [Si plusieurs bureaux : Contrastes politiques (quartiers de gauche/droite/RN). Hétérogénéité de la participation. Identification des bureaux "bascules".]
             [Si bureau unique : Indiquer "Commune à bureau unique : l'analyse territoriale se confond avec l'analyse globale."]
          </div>
        </section>

        <section class="bg-[#E6F5F6] p-4 rounded-lg border-l-4 border-[#005B82]">
          <h3 class="text-lg font-bold text-[#005B82] uppercase mb-2">4. Synthèse Générale</h3>
          <div class="text-sm font-medium text-slate-800 text-justify">
             [Résumé des tendances lourdes. Qualification politique de la commune (bastion, terre de mission, zone pivot). Points de vigilance.]
          </div>
        </section>
      </div>
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
           temperature: 0.4, // Plus factuel
        }
      });
      return response.text;
    } catch (e) {
      console.error(e);
      return `
        <div class="p-4 bg-red-50 text-red-700 border border-red-200 rounded">
          <strong>Erreur d'analyse :</strong> Impossible de joindre le service d'intelligence artificielle. 
          Veuillez vérifier votre connexion ou la configuration de la clé API.
        </div>
      `;
    }
  }
}
