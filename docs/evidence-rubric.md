# Evidence rubric, version 1

This is an editorial decision protocol. Grades describe a specified outcome, population, route, and formulation. They do not rank products or recommend use. Five profile dimensions remain separate: preclinical, human, clinical, safety, and regulatory maturity.

## Required assessment inputs

Record the search date, queries, sources searched, eligibility criteria, included study IDs, excluded studies with reasons, endpoint, population, formulation, route, follow-up duration, and reviewer. Count distinct studies, not papers. Link multiple publications and registry records to the same study. Unknown sample size is null, never zero.

Separate cells from animals. Human observational findings do not count as controlled clinical efficacy. A registered trial without results counts as a trial record, never positive evidence. Abstract-only review cannot establish details absent from the abstract. Do not use absence in one search as evidence of universal absence.

## Grade definitions

Apply the first matching rule, after the eligibility and risk-of-bias review. These thresholds are product policy, not a validated clinical scoring instrument. A second editor adjudicates uncertainty. Each assessment records its rubric version and rationale.

| Grade           | Preclinical                                                                                                                          | Human descriptive evidence                                                                                                 | Controlled clinical evidence                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| None Identified | Completed documented search found no eligible cell or animal study                                                                   | No eligible human study found in documented search                                                                         | No completed controlled human study with accessible results identified                                                                                   |
| Very Limited    | One eligible experiment or serious methodological limitations                                                                        | Case report, uncontrolled pilot, or major limitations                                                                      | One exploratory controlled experiment with serious limitations, surrogate-only finding, or inadequate precision                                          |
| Limited         | More than one eligible experiment, but no independent replication                                                                    | One adequately described observational or early human study                                                                | One eligible controlled clinical study with interpretable results, but no independent confirmation                                                       |
| Moderate        | At least two independent laboratories replicate the same scoped finding with controls                                                | At least two independent eligible studies with consistent scoped findings and no critical bias                             | At least two independent controlled trials with consistent findings, relevant outcomes, and no critical bias, but important residual uncertainty         |
| Strong          | Independent replication across models with low bias, relevant controls, and reproducible endpoints                                   | At least three independent studies with consistent findings, adequate precision, and low bias for the descriptive question | At least two independent adequately powered randomized trials with relevant outcomes and low risk of bias, supported by an eligible systematic synthesis |
| Conflicting     | At least two adequately described eligible studies disagree on the same scoped finding without a resolved methodological explanation | Same rule applied to comparable human findings                                                                             | Same rule applied to comparable clinical outcomes                                                                                                        |

An unsearched or incomplete scope has assessment state `unknown` or `insufficient_evidence`, with no grade. `None Identified` requires a documented completed search. `Conflicting` is a review state of the evidence, not an average of positive and negative findings. A null result is not a negative-quality study.

Sample size alone never determines adequacy. Reviewers record a power or precision justification; significance alone does not establish clinical relevance. Independence means a different research team and participant cohort, not another paper from the same trial. A systematic review inherits limitations of its included evidence.

For controlled studies, record randomization, allocation concealment, missing outcomes, outcome measurement, and selective reporting as adequate, inadequate, or unclear. A missing report is unclear. Low bias requires every applicable domain to be adequate. Critical bias includes an uncontrolled design used for a causal clinical conclusion, unaddressed major confounding, or outcome denominators that cannot be reconciled. Such evidence cannot qualify for Moderate or Strong. Abstract-only material cannot establish low bias unless all required details are explicitly available. Record the clinically relevant effect threshold or precision target before assessing the finding; do not select it after seeing statistical significance.

## Safety

Safety grades describe how well risks are characterized, never how safe a compound is. Known serious harm can coexist with strong safety evidence. Use the same study independence rules, but specify exposure, duration, population, adverse-event ascertainment, and precision. Strong requires replicated controlled safety observations and sufficiently sized longitudinal or postmarketing data for the stated exposure. Moderate requires replicated controlled safety observations but incomplete long-term data. Limited requires one structured human safety study. Very Limited covers pilots, case reports, or passive reports without denominators. None Identified requires a completed search. Unknown long-term risk remains a separate visible field regardless of grade.

The records distinguish observed, theoretical, and unknown findings. Spontaneous adverse-event reports cannot establish incidence or causation.

## Regulatory maturity

Store a jurisdiction-specific status rather than a scientific grade: `approved`, `investigational`, `not_approved`, or `unclear`. Include agency, exact product or substance, indication, formulation, route, population, effective date, verification date, and source observation. An approval for one product does not approve every formulation or off-label claim. Compounding list status and advisory committee recommendations are separate regulatory record types.

## Maturity labels

Optional maturity is categorical: theoretical, cell, animal, early human, controlled human, established clinical. It describes the highest eligible evidence context for a scoped claim. It does not replace the five dimensions. An acute hormone response in a randomized human experiment does not establish long-term treatment efficacy.

## Workflow and reproducibility

1. Researcher records the search and eligible studies.
2. Researcher proposes grades with study IDs and rationale.
3. Editor checks bias, applicability, independence, and source text.
4. A second editor adjudicates disagreements and records the reason.
5. New evidence creates a new revision and review task. Existing publication remains stable until replacement is approved.

Never generate a grade automatically from article count. Software can check completeness, enforce allowed values, and flag inconsistent evidence-to-claim contexts. Human reviewers own final judgments.
