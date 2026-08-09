// NSID constants. Per DESIGN.md these stay as pub.paper.* / id.career.* for
// phase 1 (personal, writing to your own PDS needs no DNS lexicon resolution).
// If you later confirm a domain prefix, change these in one place.

export const NSID = {
  // pub.paper.* — bibliography
  reference: "pub.paper.reference",
  collection: "pub.paper.collection",
  collectionItem: "pub.paper.collectionItem",
  readingStatus: "pub.paper.readingStatus",
  // id.career.* — CV
  position: "id.sifa.profile.position",
  profile: "id.career.profile",
  education: "id.career.education",
  authorship: "id.career.authorship",
  presentation: "id.career.presentation",
  grant: "id.career.grant",
  award: "id.career.award",
  service: "id.career.service",
  membership: "id.career.membership",
  teaching: "id.career.teaching",
  supervision: "id.career.supervision",
  patent: "id.career.patent",
  outreach: "id.career.outreach",
  work: "id.career.work",
  openSourceContribution: "id.career.openSourceContribution",
} as const;

export type Nsid = (typeof NSID)[keyof typeof NSID];
