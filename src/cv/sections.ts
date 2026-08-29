// Per-record display formatting for every CV category, shared by the editing
// screen (src/tabs/CvTab.tsx) and the public CV view so the two never drift.
// Each render() turns one record's `value` into a { title, meta } line; the
// section titles/order live with each surface separately (the editor wants
// technical NSID-annotated headings, the public CV wants clean ones).

import { NSID } from "../lexicons";
import { pickLanguageText } from "../languageText";

export interface RenderedItem {
  title: string;
  meta: string;
}

export type RecordRender = (value: any, locale: string) => RenderedItem;

const L = (value: unknown, locale: string) => pickLanguageText(value, locale);

// Public-CV section metadata (clean titles + stable anchor ids), keyed by NSID.
// The anchor ids are what appear in /{base}/#/<handle>/<anchor> and as HTML id
// attributes; they are generated dynamically from the categories that have data.
export interface SectionMeta {
  anchor: string;
  ja: string;
  en: string;
}

export const SECTION_META: Record<string, SectionMeta> = {
  [NSID.position]: { anchor: "employment", ja: "職歴", en: "Employment" },
  [NSID.education]: { anchor: "education", ja: "学歴", en: "Education" },
  [NSID.presentation]: { anchor: "presentations", ja: "発表", en: "Presentations" },
  [NSID.award]: { anchor: "awards", ja: "受賞", en: "Awards" },
  [NSID.grant]: { anchor: "grants", ja: "研究費", en: "Grants" },
  [NSID.patent]: { anchor: "patents", ja: "知的財産", en: "Intellectual property" },
  [NSID.work]: { anchor: "works", ja: "Works", en: "Works" },
  [NSID.openSourceContribution]: { anchor: "oss", ja: "OSS・公開データ", en: "OSS & open data" },
  [NSID.membership]: { anchor: "memberships", ja: "所属学協会", en: "Memberships" },
  [NSID.service]: { anchor: "service", ja: "委員・学術貢献", en: "Service" },
  [NSID.teaching]: { anchor: "teaching", ja: "担当授業", en: "Teaching" },
  [NSID.supervision]: { anchor: "supervision", ja: "学生指導", en: "Supervision" },
  [NSID.outreach]: { anchor: "outreach", ja: "社会貢献・メディア", en: "Outreach & media" },
};

// Anchors for the two special composite sections.
export const COLLECTIONS_ANCHOR = "collections";
export const PUBLICATIONS_ANCHOR = "publications";

export const SECTION_RENDER: Record<string, RecordRender> = {
  [NSID.position]: (v) => ({
    title: `${v.title ?? "?"}${v.company ? " — " + v.company : ""}`,
    meta: [v.employmentType?.replace("id.sifa.defs#", ""), [v.startedAt, v.endedAt].filter(Boolean).join("–")].filter(Boolean).join(" · "),
  }),
  [NSID.education]: (v, locale) => ({
    title: `${L(v.institution?.name, locale) || "?"}${L(v.degreeName, locale) ? " — " + L(v.degreeName, locale) : ""}`,
    meta: [v.status, [v.startedAt, v.endedAt].filter(Boolean).join("–")].filter(Boolean).join(" · "),
  }),
  [NSID.award]: (v, locale) => ({
    title: L(v.name, locale) || "?",
    meta: [L(v.conferredBy?.name, locale), v.date].filter(Boolean).join(" · "),
  }),
  [NSID.presentation]: (v, locale) => ({
    title: L(v.title, locale) || "?",
    meta: [v.type, L(v.eventName, locale), v.date].filter(Boolean).join(" · "),
  }),
  [NSID.grant]: (v, locale) => ({
    title: L(v.title, locale) || "?",
    meta: [L(v.funder?.name, locale), L(v.programName, locale), v.awardNumber].filter(Boolean).join(" · "),
  }),
  [NSID.service]: (v, locale) => ({
    title: L(v.venue, locale) || "?",
    meta: [v.type, L(v.roleTitle, locale), v.startedAt].filter(Boolean).join(" · "),
  }),
  [NSID.membership]: (v, locale) => ({
    title: L(v.organization?.name, locale) || "?",
    meta: [v.grade, v.status].filter(Boolean).join(" · "),
  }),
  [NSID.teaching]: (v, locale) => ({
    title: L(v.courseName, locale) || "?",
    meta: [L(v.institution?.name, locale), v.role, v.startedAt].filter(Boolean).join(" · "),
  }),
  [NSID.supervision]: (v, locale) => ({
    title: L(v.thesisTitle, locale) || v.role || "?",
    meta: [v.degree, v.status, L(v.institution?.name, locale)].filter(Boolean).join(" · "),
  }),
  [NSID.patent]: (v, locale) => ({
    title: L(v.title, locale) || "?",
    meta: [v.rightType, v.applicationNumber, v.status].filter(Boolean).join(" · "),
  }),
  [NSID.outreach]: (v, locale) => ({
    title: L(v.title, locale) || "?",
    meta: [v.kind, L(v.organizer?.name, locale) || L(v.mediaOutlet, locale), v.startedAt].filter(Boolean).join(" · "),
  }),
  [NSID.work]: (v, locale) => ({
    title: L(v.title, locale) || "?",
    meta: [v.kind, L(v.organization?.name, locale), v.startedAt].filter(Boolean).join(" · "),
  }),
  [NSID.openSourceContribution]: (v, locale) => ({
    title: L(v.name, locale) || "?",
    meta: [v.projectKind, v.role, v.status].filter(Boolean).join(" · "),
  }),
};
