/**
 * Signal Scorer
 *
 * Purpose:   Turn verified news shifts and analyzed job descriptions into the
 *            Signal Matrix: for each skill, a News signal, a JD signal, news
 *            momentum, and a quadrant (Rising, Emerging, Established, Fading, Quiet).
 * Input:     ScoreInput (below): the role's skills, PUBLISHED shifts only,
 *            article cards (date and source type), JD mentions, the number of
 *            analyzed JDs, and config/scoring.json.
 * Output:    ScoreOutput: asOfDate plus one SkillScore per skill.
 * Uses LLM:  No. Pure TypeScript, no file or network access, so the exact same
 *            code runs in the offline pipeline, the browser, and the unit tests.
 * Failure:   None expected. Missing data scores as 0 (Quiet), never an error.
 *
 * The formulas, in plain words:
 *   News signal = sum over articles mentioning the skill of
 *                 recency x source weight x evidence weight, divided by
 *                 `saturation` and capped at 1. Each article counts once per skill.
 *   JD signal   = (required mentions x 1.0 + preferred x 0.5) / analyzed JDs.
 *   Momentum    = (recent rate - earlier rate) / the larger of the two, from -1 to 1,
 *                 where a rate is articles per day in that window.
 *   Quadrant    = strong news + strong JDs: Rising
 *                 strong news only:        Emerging
 *                 strong JDs only:         Established
 *                 neither, momentum <= fadingMomentum, with enough earlier
 *                 mentions:                Fading
 *                 otherwise:               Quiet
 */
import type {
  ArticleCard,
  EvidenceLevel,
  JDSkillMention,
  Quadrant,
  ScoringConfig,
  Skill,
  SkillScore,
  VerifiedShift,
} from "@/pipeline/schemas";

export interface ScoreInput {
  role: string;
  skills: Skill[];
  shifts: VerifiedShift[];
  articles: ArticleCard[];
  jdMentions: JDSkillMention[];
  analyzedJdCount: number;
  config: ScoringConfig;
}

export interface ScoreOutput {
  asOfDate: string;
  scores: SkillScore[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** "Today" for scoring: the configured date, or the newest article's date. */
export function resolveAsOfDate(articles: ArticleCard[], config: ScoringConfig): string {
  if (config.asOfDate) return config.asOfDate;
  return articles.reduce((max, a) => (a.publishedDate > max ? a.publishedDate : max), "1970-01-01");
}

/** A mention loses half its weight every `halfLifeDays`. */
export function recencyWeight(ageDays: number, halfLifeDays: number): number {
  return Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays);
}

/** Recent rate vs earlier rate, scaled to -1..1. 0 when there is no news at all. */
export function momentum(recent: number, earlier: number, recentDays: number, earlierDays: number): number {
  const recentRate = recent / recentDays;
  const earlierRate = earlier / earlierDays;
  const larger = Math.max(recentRate, earlierRate);
  return larger === 0 ? 0 : (recentRate - earlierRate) / larger;
}

export function classify(
  newsSignal: number,
  jdSignal: number,
  momentumValue: number,
  earlierArticles: number,
  t: ScoringConfig["thresholds"],
): Quadrant {
  const newsStrong = newsSignal >= t.newsStrong;
  const jdStrong = jdSignal >= t.jdStrong;
  if (newsStrong && jdStrong) return "Rising";
  if (newsStrong) return "Emerging";
  if (jdStrong) return "Established";
  if (momentumValue <= t.fadingMomentum && earlierArticles >= t.minEarlierMentionsForFading) return "Fading";
  return "Quiet";
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function scoreSkills(input: ScoreInput): ScoreOutput {
  const { role, skills, shifts, articles, jdMentions, analyzedJdCount, config } = input;
  const asOfDate = resolveAsOfDate(articles, config);
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const published = shifts.filter((s) => s.status === "published");
  const { recentDays, earlierDays } = config.windows;

  const scores = skills.map((skill): SkillScore => {
    // News side: the strongest published shift per article, so each article counts once.
    const bestPerArticle = new Map<string, { weight: number; age: number }>();
    const evidence: { id: string; date: string }[] = [];
    for (const shift of published) {
      if (!shift.skillIds.includes(skill.id)) continue;
      const article = articleById.get(shift.articleId);
      if (!article) continue;
      const age = daysBetween(article.publishedDate, asOfDate);
      if (age < 0) continue; // published after the as-of date: not "news yet"
      const weight =
        recencyWeight(age, config.news.recencyHalfLifeDays) *
        config.news.sourceWeights[article.sourceType] *
        config.news.evidenceWeights[shift.verification.evidenceLevel as EvidenceLevel];
      const prev = bestPerArticle.get(article.id);
      if (!prev || weight > prev.weight) bestPerArticle.set(article.id, { weight, age });
      evidence.push({ id: shift.id, date: article.publishedDate });
    }
    const perArticle = [...bestPerArticle.values()];
    const newsWeight = perArticle.reduce((sum, a) => sum + a.weight, 0);
    const recent = perArticle.filter((a) => a.age <= recentDays).length;
    const earlier = perArticle.filter((a) => a.age > recentDays && a.age <= recentDays + earlierDays).length;

    // JD side: one mention per JD per skill (the JD Analyzer guarantees this).
    const mentions = jdMentions.filter((m) => m.skillId === skill.id);
    const required = mentions.filter((m) => m.requirement === "required").length;
    const preferred = mentions.length - required;
    const jdWeight = required * config.jd.requiredWeight + preferred * config.jd.preferredWeight;

    const newsSignal = Math.min(1, newsWeight / config.news.saturation);
    const jdSignal = analyzedJdCount ? Math.min(1, jdWeight / analyzedJdCount) : 0;
    const momentumValue = momentum(recent, earlier, recentDays, earlierDays);

    return {
      skillId: skill.id,
      role,
      newsSignal: round(newsSignal),
      jdSignal: round(jdSignal),
      momentum: round(momentumValue),
      quadrant: classify(newsSignal, jdSignal, momentumValue, earlier, config.thresholds),
      stats: {
        articles: perArticle.length,
        recentArticles: recent,
        earlierArticles: earlier,
        newsWeight: round(newsWeight),
        required,
        preferred,
        jdCount: analyzedJdCount,
      },
      newsEvidence: evidence.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).map((e) => e.id),
      jdEvidence: mentions,
    };
  });

  return { asOfDate, scores };
}

/** Plain-language explanation of one score, for the Skill detail screen. */
export function explainScore(score: SkillScore, config: ScoringConfig): string[] {
  const { stats, quadrant } = score;
  const t = config.thresholds;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const lines = [
    `News signal ${score.newsSignal.toFixed(2)}: ${stats.articles} verified article(s) mention this skill, ` +
      `weighted by how recent they are, source type, and evidence level (${stats.newsWeight.toFixed(2)} of ${config.news.saturation} needed for a full signal). ` +
      `Strong means at least ${t.newsStrong}.`,
    `JD signal ${score.jdSignal.toFixed(2)}: ${stats.required} of ${stats.jdCount} job descriptions require it and ${stats.preferred} prefer it ` +
      `(preferred counts ${config.jd.preferredWeight}). Strong means at least ${pct(t.jdStrong)}.`,
    `Momentum ${score.momentum >= 0 ? "+" : ""}${score.momentum.toFixed(2)}: ${stats.recentArticles} article(s) in the last ${config.windows.recentDays} days ` +
      `vs ${stats.earlierArticles} in the ${config.windows.earlierDays} days before, compared per day.`,
  ];
  const why: Record<Quadrant, string> = {
    Rising: "Rising because it is strong in both the news and job descriptions.",
    Emerging: "Emerging because the news is strong but few job descriptions ask for it yet: an early mover opportunity.",
    Established: "Established because job descriptions ask for it but it is not in the news: table stakes.",
    Fading: "Fading because news coverage is dropping and few job descriptions ask for it.",
    Quiet: "Quiet because neither signal is strong and coverage is not clearly dropping.",
  };
  lines.push(why[quadrant]);
  return lines;
}
