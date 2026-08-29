// Framework-agnostic list of the CV collections rendered as generic sections,
// in public display order (requirement 9.2). Kept here (not in the React hook)
// so the Astro static build can import it without pulling in React.

import { NSID } from "../lexicons";

export const GENERIC_CV_NSIDS = [
  NSID.position,
  NSID.education,
  NSID.presentation,
  NSID.award,
  NSID.grant,
  NSID.patent,
  NSID.work,
  NSID.openSourceContribution,
  NSID.membership,
  NSID.service,
  NSID.teaching,
  NSID.supervision,
  NSID.outreach,
] as const;
