import defaultSignatureData from "../data/bot-signatures.json" with {
  type: "json",
};
import defaultRangeData from "../data/datacenter-ranges.json" with {
  type: "json",
};

export const CLASSIFIER_VERSION = "0.1.0";

export type VisitorCategory =
  | "human"
  | "training_crawler"
  | "agent_fetch"
  | "unidentified_bot"
  | "suspicious_spoofed";

export type SignatureCategory = Exclude<
  VisitorCategory,
  "human" | "unidentified_bot" | "suspicious_spoofed"
>;

export interface BotSignature {
  pattern: string;
  category: SignatureCategory;
  label: string;
}

export interface DatacenterRange {
  provider: string;
  cidr: string;
}

export interface BrowserSignal {
  executedAt?: string;
  webdriver: boolean | null;
  mouseMoved: boolean;
  scrolled: boolean;
  touched: boolean;
  screenWidth: number | null;
  screenHeight: number | null;
  navigationTimingMs: number | null;
}

export interface ClassificationInput {
  userAgent: string | null | undefined;
  ip?: string | null;
  browserSignal?: BrowserSignal | null;
  isPageLoad?: boolean;
}

export interface ClassificationResult {
  category: VisitorCategory;
  reason: string;
  matchedSignature?: BotSignature;
  datacenterProvider?: string;
  score: number;
  classifierVersion: string;
}

export const defaultSignatures: readonly BotSignature[] =
  defaultSignatureData.signatures as readonly BotSignature[];

export const defaultDatacenterRanges: readonly DatacenterRange[] =
  defaultRangeData.ranges as readonly DatacenterRange[];

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseIpv4(ip: string): number[] | null {
  const value = ip.replace(/^::ffff:/i, "");
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function ipv4ToInteger(octets: number[]): number {
  return (
    octets[0] * 2 ** 24 +
    octets[1] * 2 ** 16 +
    octets[2] * 2 ** 8 +
    octets[3]
  );
}

function cidrContains(ip: string, cidr: string): boolean {
  const address = parseIpv4(ip);
  const [network, prefixText] = cidr.split("/");
  const prefix = Number(prefixText);
  const networkOctets = parseIpv4(network);
  if (!address || !networkOctets || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (2 ** 32 - 2 ** (32 - prefix)) >>> 0;
  return (
    (ipv4ToInteger(address) >>> 0) & mask
  ) === ((ipv4ToInteger(networkOctets) >>> 0) & mask);
}

export function findDatacenterProvider(
  ip: string | null | undefined,
  ranges: readonly DatacenterRange[] = defaultDatacenterRanges,
): string | undefined {
  if (!ip) return undefined;
  return ranges.find((range) => cidrContains(ip, range.cidr))?.provider;
}

export function matchBotSignature(
  userAgent: string | null | undefined,
  signatures: readonly BotSignature[] = defaultSignatures,
): BotSignature | undefined {
  const normalizedUserAgent = normalize(userAgent);
  if (!normalizedUserAgent) return undefined;

  return signatures.find((signature) =>
    normalizedUserAgent.includes(normalize(signature.pattern)),
  );
}

function behavioralScore(
  signal: BrowserSignal,
  datacenterProvider: string | undefined,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const interacted = signal.mouseMoved || signal.scrolled || signal.touched;

  if (signal.webdriver === true) {
    score += 3;
    reasons.push("navigator.webdriver is true");
  }
  if (!interacted) {
    score += 1;
    reasons.push("no mouse, scroll, or touch activity in the observation window");
  }
  if (
    signal.navigationTimingMs !== null &&
    (!Number.isFinite(signal.navigationTimingMs) ||
      signal.navigationTimingMs < 0 ||
      signal.navigationTimingMs > 30_000)
  ) {
    score += 2;
    reasons.push("navigation timing is outside the plausible range");
  }
  if (
    signal.screenWidth !== null &&
    signal.screenHeight !== null &&
    (signal.screenWidth < 240 ||
      signal.screenHeight < 240 ||
      signal.screenWidth > 20_000 ||
      signal.screenHeight > 20_000)
  ) {
    score += 1;
    reasons.push("screen dimensions are implausible");
  }
  if (datacenterProvider) {
    score += 1;
    reasons.push(`source IP is in a ${datacenterProvider} range`);
  }

  return { score, reasons };
}

export function classifyRequest(
  input: ClassificationInput,
  options: {
    signatures?: readonly BotSignature[];
    datacenterRanges?: readonly DatacenterRange[];
  } = {},
): ClassificationResult {
  const matchedSignature = matchBotSignature(input.userAgent, options.signatures);
  const datacenterProvider = findDatacenterProvider(
    input.ip,
    options.datacenterRanges,
  );

  if (matchedSignature) {
    return {
      category: matchedSignature.category,
      reason: `User-Agent matched ${matchedSignature.label} (${matchedSignature.pattern})`,
      matchedSignature,
      datacenterProvider,
      score: 0,
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  if (!input.browserSignal) {
    return {
      category: input.isPageLoad === false ? "human" : "unidentified_bot",
      reason:
        input.isPageLoad === false
          ? "Non-page request has no browser signal requirement"
          : "No known bot signature and no browser signal has arrived",
      datacenterProvider,
      score: 0,
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  const behavior = behavioralScore(input.browserSignal, datacenterProvider);
  if (behavior.score >= 2) {
    return {
      category: "suspicious_spoofed",
      reason: `Behavioral checks exceeded the suspicion threshold: ${behavior.reasons.join("; ")}`,
      datacenterProvider,
      score: behavior.score,
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  return {
    category: "human",
    reason:
      behavior.reasons.length > 0
        ? `Browser signal arrived; low-risk observation: ${behavior.reasons.join("; ")}`
        : "Browser signal arrived and behavioral checks passed",
    datacenterProvider,
    score: behavior.score,
    classifierVersion: CLASSIFIER_VERSION,
  };
}

export function hashIp(ip: string, salt: string): string {
  let hash = 2166136261;
  for (const character of `${salt}:${ip}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}