import { z } from "zod";
export const audienceSchema = z.enum(["women", "50plus"]);
export type Audience = z.infer<typeof audienceSchema>;
export const roleSchema = z.enum(["viewer", "researcher", "editor", "admin"]);
export const actorSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  display_name: z.string(),
  role: roleSchema,
  is_human: z.boolean(),
});
export type Actor = z.infer<typeof actorSchema>;
export const evidenceType = z.enum([
  "in_vitro",
  "animal",
  "case_report",
  "observational",
  "pilot_human",
  "clinical_trial",
  "randomized_controlled_trial",
  "systematic_review",
  "meta_analysis",
  "regulatory",
  "unknown",
]);
export const gradeSchema = z.enum([
  "Strong",
  "Moderate",
  "Limited",
  "Very Limited",
  "None Identified",
  "Conflicting",
]);
export const knowledgeSchema = z.enum([
  "known",
  "unknown",
  "insufficient_evidence",
  "conflicting_evidence",
  "not_established",
]);
export const sectionSchema = z.enum([
  "overview",
  "mechanism",
  "research_areas",
  "human",
  "animal",
  "cell",
  "trials",
  "safety",
  "unknowns",
  "regulatory",
  "timeline",
  "related",
]);
export const citationSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  url: z.url(),
  authors: z.array(z.string()),
  publication: z.string().nullable(),
  date: z.string().nullable(),
  retrievedAt: z.string(),
  scope: z.string(),
  locator: z.string(),
  relation: z.enum(["supports", "contradicts", "context"]),
});
export const claimSchema = z.object({
  id: z.uuid(),
  section: sectionSchema,
  claim_text: z.string(),
  plain_text: z.string().nullable(),
  assertion_scope: z.string(),
  evidence_type: evidenceType,
  approved: z.boolean(),
  confidence: z.string(),
  limitations: z.string(),
  reviewed_at: z.string().nullable(),
  reviewed_by: z.string().nullable(),
  citations: z.array(citationSchema),
});
export const assessmentSchema = z.object({
  dimension: z.enum([
    "preclinical",
    "human",
    "clinical",
    "safety",
    "regulatory",
  ]),
  state: knowledgeSchema,
  grade: gradeSchema.nullable(),
  rationale: z.string(),
  search_scope: z.string(),
  rubric_version: z.string(),
  reviewed_by: z.string().nullable(),
});
export const trialSchema = z.object({
  id: z.uuid(),
  observation_id: z.uuid(),
  registry_id: z.string(),
  title: z.string(),
  phase: z.string().nullable(),
  status: z.string(),
  enrollment: z.number().nullable(),
  enrollment_type: z.string().nullable(),
  population: z.string().nullable(),
  intervention: z.string().nullable(),
  primary_outcomes: z.string().nullable(),
  results_available: z.boolean(),
  source_url: z.url(),
});
export const regulationSchema = z.object({
  id: z.uuid(),
  jurisdiction: z.string(),
  agency: z.string(),
  status: z.string(),
  record_type: z.string(),
  product: z.string().nullable(),
  indication: z.string().nullable(),
  verified_at: z.string(),
});
export const flagSchema = z.object({
  id: z.uuid(),
  claim_id: z.uuid(),
  code: z.string(),
  detail: z.string(),
  resolved_by: z.string().nullable(),
  resolution: z.string().nullable(),
});
export const evidenceRecordSchema = z.object({
  id: z.uuid(),
  claim_id: z.uuid(),
  study_id: z.uuid(),
  evidence_type: evidenceType,
  title: z.string(),
  study_design: z.string().nullable(),
  species: z.string().nullable(),
  population: z.string().nullable(),
  sample_size: z.number().nullable(),
  limitations: z.string(),
  year: z.number().nullable(),
  confidence: z.string(),
});
export const articleSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  revisionId: z.uuid(),
  status: z.string(),
  reviewedAt: z.string().nullable(),
  updatedAt: z.string(),
  nextReviewDue: z.string().nullable(),
  aliases: z.array(z.string()),
  claims: z.array(claimSchema),
  assessments: z.array(assessmentSchema),
  trials: z.array(trialSchema),
  regulations: z.array(regulationSchema),
  safety: z.array(
    z.object({
      category: z.string(),
      severity: z.string(),
      known_or_theoretical: z.string(),
    }),
  ),
  flags: z.array(flagSchema),
  humanStudyCount: z.number(),
  trialCount: z.number(),
  evidenceRecords: z.array(evidenceRecordSchema),
  related: z.array(
    z.object({ slug: z.string(), name: z.string(), type: z.string() }),
  ),
});
export type Article = z.infer<typeof articleSchema>;
export const cardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  revisionId: z.uuid(),
  summary: z.string(),
  reviewedAt: z.string().nullable(),
  areas: z.array(z.string()),
  humanGrade: z.string(),
  regulatory: z.string(),
});
export type PeptideCard = z.infer<typeof cardSchema>;
export const taxonomySchema = z.object({
  slug: z.string(),
  label: z.string(),
  kind: z.enum(["area", "family"]),
});
export const uuidSchema = z.uuid().brand<"EntityId">();
export const claimInputSchema = z.object({
  revisionId: z.uuid(),
  section: sectionSchema,
  text: z.string().trim().min(10).max(6000),
  plainText: z.string().trim().max(6000).default(""),
  scope: z.enum([
    "cell",
    "animal",
    "human",
    "clinical",
    "regulatory",
    "mixed",
    "unknown",
  ]),
  evidenceType,
  observationId: z.uuid(),
  locator: z.string().trim().min(3).max(500),
  limitations: z.string().trim().min(5).max(3000),
  expectedUpdatedAt: z.string(),
});
export function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function normalizeDoi(doi: string) {
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}
export function detectLanguage(text: string) {
  return [
    "treats",
    "cures",
    "prevents",
    "reverses",
    "guarantees",
    "heals",
    "boosts",
    "burns fat",
    "builds muscle",
    "anti-aging",
    "extends lifespan",
  ].filter((term) => new RegExp(`\\b${term}\\b`, "i").test(text));
}
export function canSupportScope(
  scope: string,
  type: z.infer<typeof evidenceType>,
) {
  return !(
    ["human", "clinical"].includes(scope) &&
    ["in_vitro", "animal", "unknown"].includes(type)
  );
}
