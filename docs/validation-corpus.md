# Five-compound validation corpus

**Editorial status: draft; AI research; unreviewed; not approved for publication.** Research retrieval date: 2026-10-18. `reviewed_at` and `published_at` must remain null. This is a bounded source sample, not a systematic review or a count of all studies. Proposed evidence descriptions below are provisional and require the project's rubric and editor review.

| PRD profile                          | Selected exact identity                            | Validation purpose                                                                                         |
| ------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A: approved therapeutic              | Semaglutide; product scope illustrated with Wegovy | Product, formulation, indication, and population must qualify approval                                     |
| B: investigational with human trials | CJC-1295, the albumin-binding long-acting molecule | Hormonal surrogate outcomes must remain distinct from clinical benefit                                     |
| C: mostly preclinical                | BPC-157                                            | Positive rat and cell findings must not become human healing claims                                        |
| D: endogenous biological peptide     | Human kisspeptin-54                                | Endogenous biology, administered peptide, and shorter isoforms need separate identities                    |
| E: speculative therapeutic claims    | Native MOTS-c                                      | Human endogenous measurements, registered interventions, and animal treatment effects must remain separate |

Profile E describes the maturity of therapeutic claims, not a claim that the molecule lacks biological evidence. Categories overlap: an endogenous molecule can have human intervention studies. Elamipretide is deliberately not the unapproved investigational example: FDA granted Forzinity accelerated approval on September 19, 2025 for a defined Barth syndrome population. [FDA approval announcement](https://www.fda.gov/news-events/press-announcements/fda-grants-accelerated-approval-first-treatment-barth-syndrome)

## A. Semaglutide

**Identity and mechanism.** Semaglutide is a modified GLP-1 analogue that activates the GLP-1 receptor. Native GLP-1 and semaglutide require distinct records; Wegovy is a product, not a universal synonym for every preparation. Receptor activation is established pharmacology; the precise mechanism for cardiovascular risk reduction is not established in the reviewed label. [FDA Wegovy label, sections 11–12](https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/218316s005lbl.pdf)

**Human evidence.** STEP 1 randomized 1,961 adults with overweight or obesity without diabetes to semaglutide or placebo alongside lifestyle intervention. The trial reported greater weight reduction with semaglutide at 68 weeks. Its population and study treatment do not establish benefit for every formulation, population, or proposed longevity use. The selected original article was read at abstract/index level. [Wilding et al., 2021, PMID 33567185](https://pubmed.ncbi.nlm.nih.gov/33567185/)

**Animal evidence.** The label reports thyroid C-cell tumors in rodents; relevance to humans remains uncertain. **Cell evidence:** no separate cell study was extracted in this source sample. [FDA label, boxed warning](https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/218316s005lbl.pdf)

**Safety and US regulatory scope.** The reviewed March 2026 label describes approved Wegovy indications with different scopes for injection and tablets; injection includes qualifying pediatric obesity and an accelerated MASH indication. Contraindications include MTC history/MEN2 and serious hypersensitivity. Warnings include pancreatitis, gallbladder disease, volume-depletion kidney injury, and severe gastrointestinal reactions. Approval must attach to the exact product and labeled use. This is a selected safety summary, not the complete label or a prescription guide. [FDA label, sections 1, 4–5](https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/218316s005lbl.pdf)

**Trial:** [NCT03548935 / STEP 1](https://clinicaltrials.gov/study/NCT03548935), API-verified phase 3, completed, actual enrollment 1,961, posted registry results present. The registry record is separate from the publication and must not count as a second study. [Registry API](https://clinicaltrials.gov/api/v2/studies/NCT03548935)

**Unknowns and followups.** Complete a product-by-indication map using current approval records before public release; this dossier does not cover every semaglutide brand, supplement, or subsequent label revision. Extract absolute effects, attrition, conflicts, and adverse-event denominators from the full paper. Provisional evidence dimensions: controlled human efficacy established for a studied indication; safety characterized in labeled settings with material warnings; off-label healthy-aging benefit not assessed here.

## B. CJC-1295

**Identity and mechanism.** The selected molecule is the long-acting GHRH analogue designed to bind albumin. The discovery paper identifies a modified hGRF(1–29) structure with a reactive terminal addition. Do not merge it with a product called “CJC-1295 without DAC” or modified GRF(1–29) without independently resolving chemistry. [Jetté et al., 2005, PMID 15817669](https://pubmed.ncbi.nlm.nih.gov/15817669/)

**Human evidence.** Two randomized placebo-controlled studies in healthy adults lasted 28 and 49 days and found sustained GH/IGF-I increases. The abstract reported no serious adverse reactions in those studies. Hormone changes are surrogate outcomes; the report does not establish recovery, longevity, body-composition benefit, or long-term safety. Full-text sample size and detailed adverse-event denominators remain unextracted. [Teichman et al., 2006, PMID 16352683](https://pubmed.ncbi.nlm.nih.gov/16352683/)

**Animal evidence.** Rat experiments showed GH release and persistent albumin-associated immunoreactivity. **Cell evidence.** Albumin-conjugated candidates were active in cultured rat anterior-pituitary GH-secretion assays. Both support a preclinical mechanism, not a human health benefit. [Jetté et al., 2005](https://pubmed.ncbi.nlm.nih.gov/15817669/)

**Safety and US regulatory scope.** FDA reports limited clinical data and serious events associated with CJC-1295, including increased heart rate and systemic vasodilatory reaction, plus immunogenicity/impurity concerns. The current page lists it under nominated-but-withdrawn bulk substances. That table is not a marketing approval. [FDA compounding safety page](https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks) An earlier FDA enforcement record specifically concerned unapproved products containing CJC 1295; it is historical product enforcement, not a current exhaustive approval search. [FDA 2020 warning letter](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/tailor-made-compounding-llc-594743-04012020)

**Trial:** [NCT00267527](https://clinicaltrials.gov/study/NCT00267527), API-verified phase 2, terminated, no posted results. The enrollment field says 120 without an actual/estimated qualifier in the retrieved payload; do not present it as 120 treated participants. The record does not state a stopping reason in the retrieved field. [Registry API](https://clinicaltrials.gov/api/v2/studies/NCT00267527)

**Unknowns and followups.** Resolve formulation/salt identity and DAC terminology at ingestion. Retrieve full studies and confirm overlap between cohorts before counting participants or studies. Investigate trial termination through primary records without inferring causality. Provisional dimensions: controlled human pharmacodynamic evidence; clinical benefit unestablished in this dossier; long-term safety insufficiently characterized.

## C. BPC-157

**Identity and mechanism.** The primary rat paper identifies a 15-residue peptide, GEPPPGKPADDAGLV. Store free base and salt preparations as related chemical forms, not automatically interchangeable products. A single established human therapeutic target is not demonstrated by these sources. [Staresinic et al., 2003, PMID 14554208](https://pubmed.ncbi.nlm.nih.gov/14554208/)

**Human evidence.** A 2025 uncontrolled pilot involved two participants with prior BPC-157 exposure. Investigators reported no side effects or measured biomarker changes during brief monitoring. This cannot establish population safety, detect uncommon harms, or demonstrate tissue-healing efficacy. The authors' broad safety conclusion should not be copied as an established finding. This is a pilot, not a randomized efficacy trial. [Lee and Burgess, 2025, PMID 40131143](https://pubmed.ncbi.nlm.nih.gov/40131143/)

**Animal evidence.** A rat Achilles-transection experiment reported improved functional and biomechanical measures. Its surgical injury model does not demonstrate a human recovery benefit. [Staresinic et al., 2003](https://pubmed.ncbi.nlm.nih.gov/14554208/) **Cell/ex-vivo evidence.** Rat tendon explants and fibroblasts showed increased outgrowth/migration and changes in FAK-paxillin activation. This is pathway evidence in a model system; it does not prove a direct receptor or a human mechanism. [Chang et al., 2011, PMID 21030672](https://pubmed.ncbi.nlm.nih.gov/21030672/)

**Safety and US regulatory scope.** FDA identifies insufficient route-specific safety information and potential immunogenicity/impurity issues. It currently appears in the nominated-but-withdrawn table; avoid stale “Category 2” or blanket “banned” labels. [FDA compounding safety page](https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks) FDA's 2020 letter identified BPC 157 among ingredients in products lacking approval exemptions; this is dated enforcement evidence. [FDA warning letter](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/tailor-made-compounding-llc-594743-04012020)

**Trials.** No BPC-157 registry record is asserted here. This is a retrieval gap, not evidence that none exists. Historic trial mentions in animal-paper abstracts do not substitute for a verified registry or human results.

**Unknowns and followups.** Verify chemical form, endogenous-origin claims, product purity, human pharmacokinetics, and reproducibility from primary full texts. Search all relevant trial aliases and reconcile unpublished studies. Provisional dimensions: positive preclinical findings; very limited human safety observations; human efficacy not established by this sample; long-term safety unknown.

## D. Human kisspeptin-54

**Identity and mechanism.** This dossier concerns human kisspeptin-54 (KP-54/metastin), not all “kisspeptin” peptides. IUPHAR lists human kisspeptin-54 as an endogenous agonist of the kisspeptin receptor (KISS1R/GPR54), with kisspeptin-10, -13, and -14 as distinct ligands. Precursor protein, mature fragments, labeled tracers, and synthetic receptor agonists need separate records. [IUPHAR receptor entry](https://www.guidetopharmacology.org/GRAC/ObjectDisplayForward?objectId=266)

**Human evidence.** A 2014 study administered KP-54 during IVF to 53 women and observed oocyte maturation and subsequent pregnancies. The finding belongs to a supervised fertility protocol with other interventions; it does not demonstrate general fertility improvement from self-administration. [Jayasena et al., 2014, PMID 25036713](https://pubmed.ncbi.nlm.nih.gov/25036713/) A later randomized phase 2 study compared an additional KP-54 treatment with placebo in women at high OHSS risk; it is a separate report requiring cohort reconciliation. [Abbara et al., 2017, PMID 28854728](https://pubmed.ncbi.nlm.nih.gov/28854728/)

**Animal evidence:** no primary animal experiment extracted in this source sample. **Cell evidence:** IUPHAR's receptor pharmacology supports receptor activity; no separate original cell experiment was critically appraised. Missing extraction is not absent biology.

**Safety and US regulatory scope.** Short supervised studies cannot establish long-term endocrine, reproductive, or pregnancy safety across populations. FDA's reviewed compounding safety table names kisspeptin-10, not kisspeptin-54; its isoform-specific statement must not be relabeled as KP-54. No KP-54 product approval was established in this bounded review; store the US approval field as `unknown_pending_verification`, with no approved badge. [FDA table](https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks)

**Trial:** [NCT01667406](https://clinicaltrials.gov/study/NCT01667406), API-verified phase 2, completed, actual registry enrollment 175, posted results present. The registry spans more than the 53-person publication; its enrollment must not replace the paper's denominator. [Registry API](https://clinicaltrials.gov/api/v2/studies/NCT01667406)

**Unknowns and followups.** Retrieve full texts, adverse-event tables, long-term followup, and an exact-molecule approval search. Establish publication-to-cohort relationships and precursor processing from a curated sequence record before storing a sequence. Provisional dimensions: established endogenous receptor biology; controlled human research for a specific fertility question; broader benefit and long-term safety uncertain.

## E. Native MOTS-c

**Identity and mechanism.** The discovery paper describes a 16-amino-acid peptide encoded within a mitochondrial 12S-rRNA open reading frame. Cell experiments implicated folate/purine metabolism and AMPK activation. Treat this as a supported model-system pathway, not proof of a single direct human target. [Lee et al., 2015, PMID 25738459](https://pubmed.ncbi.nlm.nih.gov/25738459/)

**Human evidence.** A 2021 study measured increased endogenous MOTS-c in human muscle and circulation after exercise. Humans in that experiment were not given MOTS-c, so it cannot establish administered-peptide benefit or safety. [Reynolds et al., 2021, PMID 33473109](https://pmc.ncbi.nlm.nih.gov/articles/PMC7817689/)

**Animal evidence.** Administered MOTS-c affected insulin-resistance/obesity measures in mice in the discovery paper. [Lee et al., 2015](https://pubmed.ncbi.nlm.nih.gov/25738459/) A separate study reported improved physical capacity in treated mice, including older animals. **Cell evidence.** That study also tested metabolic-stress adaptation in C2C12 myoblasts. Neither finding establishes human anti-aging efficacy. [Reynolds et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7817689/)

**Safety and US regulatory scope.** FDA reports inadequate administered-product human safety information and potential immunogenicity/impurity concerns. Attribute that agency assessment to the specific page; it is not proof that no later trial registration exists. Current table placement is nominated-but-withdrawn. No marketing approval was verified in this review. [FDA safety page](https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks)

**Native intervention trial:** [NCT07505745](https://clinicaltrials.gov/study/NCT07505745), API-verified sponsor-reported phase 2, recruiting, estimated enrollment 120, no posted results; the latest update in the retrieved record is April 1, 2026. Its description concerns insulin sensitivity in adults with prediabetes and overweight/obesity. Registration establishes a submitted protocol, not conduct, efficacy, safety, FDA authorization, or independent verification of product identity. [Registry API](https://clinicaltrials.gov/api/v2/studies/NCT07505745)

**Identity exclusion:** [NCT03998514](https://clinicaltrials.gov/study/NCT03998514) names CB4211 as its intervention, not native MOTS-c. The API reports phase 1, completed, actual enrollment 88, no posted results. Retain it as a related research lead; do not pool its participants or outcomes into native MOTS-c evidence. The exact chemical relationship requires a separate primary-source identity record. [Registry API](https://clinicaltrials.gov/api/v2/studies/NCT03998514)

**Unknowns and followups.** Independently verify the new registry's sponsor, sites, product identity, protocol, and eventual results. Reconcile FDA's assessment with later evidence without silently overwriting its provenance. Extract full animal methods and relevant conflicts before grading reproducibility. Provisional dimensions: preclinical pathway/phenotype evidence; human endogenous physiology observations; registered human treatment research without results in the verified record; therapeutic and long-term safety claims speculative.

## Editorial and ingestion checks

- Preserve study, publication, registry, and product as distinct entities; neither multiple reports nor a registry/publication pair is automatically multiple independent studies.
- Every source in `research/validation-sources.json` is an unreviewed source record with supported facts and extraction scope. Abstract access does not imply full-text appraisal.
- Regulatory snapshots need jurisdiction, molecule/form, product, indication, source date where known, and retrieval date. No conclusion here authorizes sale, prescribing, or compounding.
- `None identified`, `not extracted`, `no posted registry results`, and `unknown` have different meanings. Missing totals stay null; no total human-study or reference-completeness count is supplied.
- Before publication, an editor must check exact identity, full-text methods, endpoint relevance, adverse-event denominators, source freshness, and each proposed claim. These artifacts never grant editorial approval.
