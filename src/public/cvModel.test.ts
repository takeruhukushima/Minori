import { describe, expect, it } from "vitest";
import { buildProjects, sortPublications, type PublicationEntry, type RawRecord } from "./cvModel";

const ref = (uri: string, year?: number): RawRecord => ({ uri, cid: "c", value: { issued: year ? { year } : undefined } });

describe("buildProjects", () => {
  it("groups references by collection and honors sortKey", () => {
    const colA: RawRecord = { uri: "at://did/pub.paper.collection/a", cid: "c", value: { name: [] } };
    const r1 = ref("at://did/pub.paper.reference/1");
    const r2 = ref("at://did/pub.paper.reference/2");
    const items: RawRecord[] = [
      { uri: "i2", cid: "c", value: { collection: { uri: colA.uri }, reference: { uri: r2.uri }, sortKey: "b" } },
      { uri: "i1", cid: "c", value: { collection: { uri: colA.uri }, reference: { uri: r1.uri }, sortKey: "a" } },
    ];
    const [project] = buildProjects([colA], items, [r1, r2]);
    expect(project.items.map((m) => m.reference?.uri)).toEqual([r1.uri, r2.uri]); // a before b
  });

  it("excludes items belonging to other collections and tolerates missing references", () => {
    const colA: RawRecord = { uri: "at://did/pub.paper.collection/a", cid: "c", value: {} };
    const items: RawRecord[] = [
      { uri: "i1", cid: "c", value: { collection: { uri: "at://did/pub.paper.collection/other" }, reference: { uri: "x" } } },
      { uri: "i2", cid: "c", value: { collection: { uri: colA.uri }, reference: { uri: "missing" } } },
    ];
    const [project] = buildProjects([colA], items, []);
    expect(project.items).toHaveLength(1);
    expect(project.items[0].reference).toBeNull();
  });
});

describe("sortPublications", () => {
  it("puts featured first, then newest year", () => {
    const entries: PublicationEntry[] = [
      { authorship: { uri: "a1", cid: "c", value: { isFeatured: false } }, reference: ref("r1", 2020) },
      { authorship: { uri: "a2", cid: "c", value: { isFeatured: true } }, reference: ref("r2", 2010) },
      { authorship: { uri: "a3", cid: "c", value: { isFeatured: false } }, reference: ref("r3", 2024) },
    ];
    const sorted = sortPublications(entries);
    expect(sorted.map((e) => e.authorship.uri)).toEqual(["a2", "a3", "a1"]);
  });
});
