import { describe, expect, it } from "vitest";
import scoringJson from "../config/scoring.json";
import { ScoringConfig, type ArticleCard, type JDSkillMention, type Skill, type VerifiedShift } from "@/pipeline/schemas";
import {
  classify,
  daysBetween,
  explainScore,
  momentum,
  recencyWeight,
  resolveAsOfDate,
  scoreSkills,
} from "@/scoring/signal-scorer";

const config = ScoringConfig.parse(scoringJson);
// Round numbers so expected values are easy to check by hand.
const testConfig = ScoringConfig.parse({ ...scoringJson, asOfDate: "2026-10-31", news: { ...scoringJson.news, saturation: 2 } });

const skill = (id: string): Skill => ({ id, name: id, description: "d", aliases: [], roles: ["tpm"] });

const article = (id: string, publishedDate: string, sourceType: ArticleCard["sourceType"] = "primary"): ArticleCard => ({
  id,
  title: id,
  source: "s",
  url: `https://example.com/${id}`,
  publishedDate,
  sourceType,
  placeholder: false,
});

let n = 0;
const shift = (articleId: string, skillIds: string[], over: Partial<VerifiedShift> = {}): VerifiedShift => ({
  id: `${articleId}#s${++n}`,
  articleId,
  kind: "technology",
  summary: "x",
  excerpt: "x",
  skillIds,
  candidateSkill: null,
  confidence: 0.9,
  excerptFound: true,
  verification: { shiftId: "", supported: true, evidenceLevel: "Strong", conflictsWith: [], note: "" },
  status: "published",
  ...over,
});

const mention = (jdId: string, skillId: string, requirement: JDSkillMention["requirement"]): JDSkillMention => ({
  jdId,
  skillId,
  requirement,
  excerpt: "x",
});

describe("building blocks", () => {
  it("counts days between ISO dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetween("2026-10-31", "2026-10-01")).toBe(-30);
  });

  it("halves recency weight every half-life", () => {
    expect(recencyWeight(0, 45)).toBe(1);
    expect(recencyWeight(45, 45)).toBeCloseTo(0.5);
    expect(recencyWeight(90, 45)).toBeCloseTo(0.25);
    expect(recencyWeight(-5, 45)).toBe(1); // future dates never weigh more than today
  });

  it("compares per-day rates, not raw counts", () => {
    // 1 article in 30 days vs 6 in 180 days is the same rate: flat.
    expect(momentum(1, 6, 30, 180)).toBe(0);
    expect(momentum(2, 0, 30, 180)).toBe(1);
    expect(momentum(0, 3, 30, 180)).toBe(-1);
    expect(momentum(0, 0, 30, 180)).toBe(0);
    expect(momentum(1, 12, 30, 180)).toBeCloseTo(-0.5);
  });

  it("uses the configured as-of date, else the newest article", () => {
    const arts = [article("a", "2026-09-01"), article("b", "2026-10-14")];
    expect(resolveAsOfDate(arts, config)).toBe("2026-10-14");
    expect(resolveAsOfDate(arts, testConfig)).toBe("2026-10-31");
  });
});

describe("classify", () => {
  const t = config.thresholds; // newsStrong 0.4, jdStrong 0.35, fadingMomentum -0.25
  it.each([
    [0.4, 0.35, 0, 0, "Rising"],
    [0.9, 0.1, 0, 0, "Emerging"],
    [0.1, 0.8, -1, 5, "Established"], // strong JDs beat falling news
    [0.1, 0.1, -0.25, 1, "Fading"],
    [0.1, 0.1, -1, 0, "Quiet"], // no earlier mentions: too little evidence to call it Fading
    [0.1, 0.1, -0.2, 3, "Quiet"],
    [0.39, 0.34, 0.5, 0, "Quiet"],
  ] as const)("news %s, jd %s, momentum %s, earlier %s -> %s", (news, jd, mom, earlier, expected) => {
    expect(classify(news, jd, mom, earlier, t)).toBe(expected);
  });
});

describe("scoreSkills", () => {
  const skills = [skill("evals"), skill("agile"), skill("web3"), skill("untouched")];
  const articles = [
    article("recent-primary", "2026-10-31", "primary"),
    article("recent-blog", "2026-10-31", "blog"),
    article("old", "2026-06-03", "trade"), // 150 days before as-of
  ];
  const shifts = [
    shift("recent-primary", ["evals"]),
    shift("recent-primary", ["evals"], { verification: { shiftId: "", supported: true, evidenceLevel: "Weak", conflictsWith: [], note: "" } }),
    shift("recent-blog", ["evals"], { verification: { shiftId: "", supported: true, evidenceLevel: "Moderate", conflictsWith: [], note: "" } }),
    shift("old", ["web3"]),
    shift("recent-blog", ["web3"], { status: "queued" }), // queued shifts never count
  ];
  const jdMentions = [
    mention("jd1", "agile", "required"),
    mention("jd2", "agile", "required"),
    mention("jd3", "agile", "preferred"),
    mention("jd1", "evals", "preferred"),
  ];
  const out = scoreSkills({ role: "tpm", skills, shifts, articles, jdMentions, analyzedJdCount: 4, config: testConfig });
  const byId = Object.fromEntries(out.scores.map((s) => [s.skillId, s]));

  it("weights news by source and evidence, counting each article once", () => {
    // recent-primary: best of Strong (1.0) and Weak -> 1 x 1.0 x 1.0 = 1.0
    // recent-blog: 1 x 0.5 (blog) x 0.7 (Moderate) = 0.35
    // total 1.35 / saturation 2 = 0.675
    expect(byId.evals.stats.articles).toBe(2);
    expect(byId.evals.newsSignal).toBeCloseTo(0.675);
    expect(byId.evals.newsEvidence).toHaveLength(3);
  });

  it("computes the JD signal with preferred counting half", () => {
    // agile: (2 x 1 + 1 x 0.5) / 4 JDs = 0.625
    expect(byId.agile.jdSignal).toBeCloseTo(0.625);
    expect(byId.agile.stats).toMatchObject({ required: 2, preferred: 1, jdCount: 4 });
    // evals: 0.5 / 4 = 0.125
    expect(byId.evals.jdSignal).toBeCloseTo(0.125);
  });

  it("assigns quadrants end to end", () => {
    expect(byId.evals.quadrant).toBe("Emerging"); // strong news, weak JDs
    expect(byId.agile.quadrant).toBe("Established"); // no news, strong JDs
    expect(byId.web3.quadrant).toBe("Fading"); // only an old article, queued recent one ignored
    expect(byId.web3.momentum).toBe(-1);
    expect(byId.untouched).toMatchObject({ quadrant: "Quiet", newsSignal: 0, jdSignal: 0, momentum: 0 });
  });

  it("ignores articles dated after the as-of date", () => {
    const future = scoreSkills({
      role: "tpm",
      skills: [skill("evals")],
      shifts: [shift("future", ["evals"])],
      articles: [article("future", "2026-12-01")],
      jdMentions: [],
      analyzedJdCount: 0,
      config: testConfig,
    });
    expect(future.scores[0].newsSignal).toBe(0);
  });

  it("returns a JD signal of 0 when no JDs were analyzed", () => {
    const none = scoreSkills({ role: "tpm", skills, shifts: [], articles, jdMentions, analyzedJdCount: 0, config: testConfig });
    expect(none.scores.every((s) => s.jdSignal === 0)).toBe(true);
  });

  it("explains a score in plain language", () => {
    const lines = explainScore(byId.agile, testConfig);
    expect(lines.join(" ")).toContain("2 of 4 job descriptions require it and 1 prefer it");
    expect(lines.at(-1)).toMatch(/^Established/);
    expect(lines.join(" ")).not.toContain("\u2014");
  });
});
