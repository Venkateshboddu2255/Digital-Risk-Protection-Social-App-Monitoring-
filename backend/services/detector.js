const CONFUSABLES = {
  "а":"a", "е":"e", "о":"o", "р":"p", "с":"c", "х":"x", "у":"y", "і":"i",
  "ј":"j", "к":"k", "м":"m", "т":"t", "в":"b", "ԁ":"d", "ⅼ":"l", "ο":"o",
  "ρ":"p", "ν":"v"
};

export function normalizeName(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[аеорсхуіјктвԁⅼορν]/g, ch => CONFUSABLES[ch] || ch)
    .replace(/[^a-z0-9]/g, "");
}

export function levenshtein(a = "", b = "") {
  const s = normalizeName(a);
  const t = normalizeName(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let previous = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const current = [i];
    for (let j = 1; j <= t.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[t.length];
}

export function similarity(a = "", b = "") {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  return Math.max(0, 1 - levenshtein(x, y) / Math.max(x.length, y.length));
}

export function riskLevel(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

function includesBrandTerm(text, brand, keywords) {
  const haystack = normalizeName(text);
  const terms = [brand.name, ...(brand.keywords || []), ...(keywords || [])]
    .filter(Boolean)
    .map(normalizeName)
    .filter(term => term.length >= 4);
  return terms.some(term => haystack.includes(term));
}

function hasSuspiciousLink(text = "") {
  return /(bit\.ly|tinyurl\.com|t\.me\/|wa\.me\/|telegram\.me\/|secure-login|verify-account|claim-prize)/i.test(text);
}

function officialSocialMatch(candidate, brand) {
  const url = String(candidate.profileUrl || candidate.sourceUrl || "").replace(/\/+$/, "").toLowerCase();
  const accountId = String(candidate.accountId || "").toLowerCase();
  return (brand.officialSocialAccounts || []).some(account => {
    const trustedUrl = String(account.profileUrl || "").replace(/\/+$/, "").toLowerCase();
    return (url && trustedUrl && url === trustedUrl) ||
      (accountId && account.accountId && accountId === String(account.accountId).toLowerCase());
  });
}

function officialAppMatch(candidate, brand) {
  const packageId = String(candidate.packageId || "").toLowerCase();
  const url = String(candidate.storeUrl || candidate.sourceUrl || "").replace(/\/+$/, "").toLowerCase();
  return (brand.officialApps || []).some(app => {
    const trustedPackage = String(app.packageId || "").toLowerCase();
    const trustedUrl = String(app.storeUrl || "").replace(/\/+$/, "").toLowerCase();
    return (packageId && trustedPackage && packageId === trustedPackage) ||
      (url && trustedUrl && url === trustedUrl);
  });
}

export function analyzeCandidate(candidate, brand, type) {
  const name = candidate.displayName || candidate.appName || candidate.name || candidate.candidateName || "";
  const description = candidate.description || candidate.bio || "";
  const username = candidate.username || "";
  const publisher = candidate.developer || candidate.publisher || "";
  const combined = `${name} ${username} ${description}`;
  const brandName = brand.name;
  const nameSimilarity = Math.max(similarity(name, brandName), similarity(username, brandName));
  const signals = [];
  const evidence = [];
  let score = 0;

  const isOfficial = type === "social"
    ? officialSocialMatch(candidate, brand)
    : officialAppMatch(candidate, brand);

  if (isOfficial) {
    return { isOfficial: true, riskScore: 0, riskLevel: "Low", signals: [], evidence: ["Matched registered official identifier"] };
  }

  if (nameSimilarity >= 0.9 && normalizeName(name) !== normalizeName(brandName)) {
    score += 25; signals.push("Strong look-alike name"); evidence.push(`Name similarity ${(nameSimilarity * 100).toFixed(0)}%`);
  } else if (nameSimilarity >= 0.72) {
    score += 15; signals.push("Moderate name similarity"); evidence.push(`Name similarity ${(nameSimilarity * 100).toFixed(0)}%`);
  }

  if (includesBrandTerm(combined, brand, candidate.keywords)) {
    score += 15; signals.push("Brand-related description or keyword"); evidence.push("Brand terms appear in profile/listing text");
  }

  if (hasSuspiciousLink(`${candidate.sourceUrl || ""} ${description}`)) {
    score += 20; signals.push("Suspicious link pattern"); evidence.push("URL/text matches a basic suspicious-link heuristic");
  }

  if (type === "social") {
    if (/(official support|customer support|verify your account|claim reward|giveaway|free bonus|urgent support)/i.test(description)) {
      score += 15; signals.push("Potential scam language"); evidence.push("Description contains common scam-like phrases");
    }
    if (candidate.logoSimilarity === "high" || candidate.logoSimilarity === true) {
      score += 25; signals.push("Logo similarity reported"); evidence.push("Collector marked avatar as highly similar to the brand logo");
    }
  } else {
    const trustedPublishers = (brand.officialApps || []).map(a => a.publisher.toLowerCase());
    if (publisher && trustedPublishers.length && !trustedPublishers.includes(publisher.toLowerCase())) {
      score += 15; signals.push("Publisher differs from trusted publisher"); evidence.push(`Observed publisher: ${publisher}`);
    }
    if (candidate.iconSimilarity === "high" || candidate.iconSimilarity === true) {
      score += 25; signals.push("App icon similarity reported"); evidence.push("Collector marked app icon as highly similar to the official icon");
    }
    if (/(wallet recovery|unofficial bonus|enter password|verify wallet|free money|instant reward)/i.test(description)) {
      score += 15; signals.push("Potentially misleading app description"); evidence.push("Description contains potentially risky claims");
    }
  }

  score = Math.min(100, score);
  if (score === 0) {
    signals.push("No strong risk signal detected");
    evidence.push("No configured heuristic crossed its threshold");
  }

  return { isOfficial: false, riskScore: score, riskLevel: riskLevel(score), signals, evidence, nameSimilarity };
}

export function candidateKey(candidate, type) {
  const stable = candidate.accountId || candidate.packageId || candidate.profileUrl ||
    candidate.storeUrl || candidate.sourceUrl || `${candidate.platform || candidate.store || ""}:${candidate.username || candidate.displayName || candidate.appName || candidate.name || ""}`;
  return `${type}:${String(stable).trim().toLowerCase()}`;
}
