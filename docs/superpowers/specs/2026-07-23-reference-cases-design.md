# Reference Cases — Design Spec

**Date:** 2026-07-23
**Auteur:** Maxime Gérard (Agilos)
**Statut:** Validé (brainstorming)

## 1. Objectif

Application permettant aux consultants Agilos de documenter les **reference cases**
(projets clients réalisés) via un formulaire structuré, puis de faire rédiger
automatiquement une fiche propre et présentable par l'IA (API Claude), exportable
en PDF et Word pour présentation à de futurs clients.

## 2. Architecture

- **Front statique** (HTML/CSS/JS, sans build) déployé sur **GitHub Pages** (compte `checkmydev`).
- **Supabase** (base partagée, nouveau schéma `refcases`) pour stocker les fiches.
- **Edge Function `generate-case`** (Deno) qui appelle l'API Claude — la clé API reste
  un secret côté serveur, jamais exposée dans le front.
- **Génération PDF/Word côté navigateur** (aucun secret requis, pas de charge serveur).

```
[Front statique GitHub Pages]
   |-- Supabase JS client (clé anon + RLS) --> [Supabase refcases.reference_cases]
   |-- fetch() --> [Edge Function generate-case] --(clé secrète)--> [API Claude Sonnet 5]
   |-- docx.js / html2pdf (navigateur) --> Export .docx / .pdf
```

## 3. Modèle IA

- **Claude Sonnet 5** (`claude-sonnet-5`) pour la rédaction. Bon rapport qualité/coût.
- Langue de rédaction : **anglais uniquement**.

## 4. Champs du formulaire

| Champ | Type | Source / notes |
|-------|------|----------------|
| Consultant(s) | Sélection multiple | Liste issue de la Competence Matrix |
| Nom du client | Texte | |
| Client confidentiel | Case à cocher | Si coché → l'IA anonymise (ex. « a major banking player ») |
| Secteur du client | Liste déroulante | Secteurs de la matrice (Automotive, Banking, Insurance, Healthcare, Supply Chain, Public, Telecom, HR, Finance, CRM) |
| Durée | Mois début / mois fin + case « en cours » | Durée dérivée pour affichage |
| Technologies utilisées | Sélection multiple groupée | Par catégorie (Qlik, Talend, TimeXtender, Snowflake, SQL Server, MS Fabric, Azure, langages…) |
| Rôle du/des consultant(s) | Texte | Ex. « Lead Qlik Developer » |
| Taille d'équipe | Nombre | |
| Contexte / défi business | Textarea | Le problème/besoin initial du client |
| Solution livrée | Textarea | Ce qui a été fait (la description) |
| Résultats / valeur livrée | Textarea | Bénéfices, KPIs, gains |
| Témoignage client | Textarea | Optionnel |

## 5. Données de référence

Fichier `data/reference-data.json` généré depuis `Competence martix.xlsx` :
- `consultants` : liste des noms
- `sectors` : liste des secteurs
- `technologies` : objet { catégorie: [technos] }

Committé dans le repo, régénérable via un petit script quand la matrice évolue.
Le fichier xlsx source reste privé (gitignore) et n'est pas déployé.

## 6. Base de données Supabase

Schéma `refcases`, table `reference_cases` :

| Colonne | Type | Notes |
|---------|------|-------|
| id | uuid PK | |
| created_at / updated_at | timestamptz | |
| consultants | jsonb (array de noms) | |
| client_name | text | |
| client_confidential | boolean | défaut false |
| client_sector | text | |
| duration_start | text (YYYY-MM) | |
| duration_end | text (YYYY-MM) | null si en cours |
| is_ongoing | boolean | |
| technologies | jsonb (array) | |
| role | text | |
| team_size | int | |
| context_challenge | text | |
| solution | text | |
| results | text | |
| testimonial | text | nullable |
| language | text | défaut 'en' |
| status | text | 'draft' \| 'generated' |
| generated_markdown | text | sortie IA, nullable |

**RLS** : politiques permettant lecture/écriture via la clé anon (usage interne
Agilos). Clé service_role et clé Claude jamais dans le repo.

## 7. Edge Function `generate-case`

- Entrée : id de la fiche (ou payload complet).
- Construit un prompt à partir des champs, appelle Claude Sonnet 5.
- Sortie : reference case rédigé en **anglais**, en Markdown structuré, sections :
  1. Title
  2. Client & Context
  3. Challenge
  4. Solution
  5. Technologies & Approach
  6. Results / Value Delivered
  7. Consultant Role
- Gère l'anonymisation si `client_confidential = true`.
- Écrit `generated_markdown` et passe `status` à `generated`.

## 8. Interface (3 écrans)

1. **Liste** — toutes les fiches (client, consultants, statut) + boutons
   Nouveau / Éditer / Générer / Exporter.
2. **Formulaire** — création / édition d'une fiche.
3. **Aperçu** — rendu du texte généré + boutons Exporter PDF / Exporter Word / Régénérer.

**Flux** : remplir le formulaire → sauvegarde Supabase → « Générer » appelle
l'Edge Function → texte stocké → aperçu → export PDF/Word.

## 9. Export documents (navigateur)

- **Word (.docx)** : librairie `docx` (chargée via CDN — GitHub Pages n'a pas de CSP stricte).
- **PDF** : `html2pdf.js` (ou impression navigateur) à partir d'un template HTML mis en forme.
- Mise en page : en-tête Agilos, sections du reference case, pied de page.

## 10. Sécurité

- Aucun secret dans le repo (`.gitignore` couvre `.env`).
- Clé Claude : secret d'Edge Function Supabase uniquement.
- Clé anon Supabase dans le front (normal), protégée par RLS.
- Fichier source `Competence martix.xlsx` non déployé (gitignore).

## 11. Hors périmètre (YAGNI, v1)

- Authentification par utilisateur (usage interne, clé anon + RLS suffit en v1).
- Gestion des versions/historique des fiches.
- Upload de logos clients / captures d'écran.
- Multilingue (anglais uniquement en v1).
