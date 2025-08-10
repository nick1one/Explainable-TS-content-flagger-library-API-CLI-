import { config } from '../config.js';
import { AccountContext, Flag } from '../schema.js';

export interface AccountFeatures {
  isNewAccount: boolean;
  accountAgeDays: number;
  hasPriorViolations: boolean;
  violationCount: number;
}

/**
 * Analyze account context and generate metadata flags
 */
export function analyzeAccountFeatures(context: AccountContext): {
  features: AccountFeatures;
  flags: Flag[];
} {
  const flags: Flag[] = [];
  const features: AccountFeatures = {
    isNewAccount: false,
    accountAgeDays: 0,
    hasPriorViolations: false,
    violationCount: 0,
  };

  // Account age analysis
  if (context.createdAt) {
    const createdAt = new Date(context.createdAt);
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
    features.accountAgeDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    if (features.accountAgeDays <= config.account.newAccountDays) {
      features.isNewAccount = true;
      flags.push({
        source: 'metadata',
        category: 'new_account',
        weight: 15,
        message: `New account (${features.accountAgeDays} days old)`,
        confidence: 1.0,
      });
    }
  }

  // Prior violations analysis
  if (context.priorViolations && context.priorViolations > 0) {
    features.hasPriorViolations = true;
    features.violationCount = context.priorViolations;

    if (context.priorViolations >= config.account.maxViolations) {
      flags.push({
        source: 'metadata',
        category: 'repeat_violator',
        weight: 25,
        message: `Account has ${context.priorViolations} prior violations`,
        confidence: 1.0,
      });
    } else if (context.priorViolations > 2) {
      flags.push({
        source: 'metadata',
        category: 'prior_violations',
        weight: 10,
        message: `Account has ${context.priorViolations} prior violations`,
        confidence: 1.0,
      });
    }
  }

  // Verification status
  if (context.isVerified === false) {
    flags.push({
      source: 'metadata',
      category: 'unverified_account',
      weight: 5,
      message: 'Unverified account',
      confidence: 1.0,
    });
  } else if (context.isVerified === true) {
    // Verified accounts get a small trust boost (negative weight)
    flags.push({
      source: 'metadata',
      category: 'verified_account',
      weight: -5,
      message: 'Verified account',
      confidence: 1.0,
    });
  }

  return { features, flags };
}

/**
 * Get account risk multiplier based on features
 */
export function getAccountRiskMultiplier(features: AccountFeatures): number {
  let multiplier = 1.0;

  // New accounts get higher risk
  if (features.isNewAccount) {
    multiplier *= 1.5;
  }

  // Prior violations increase risk
  if (features.hasPriorViolations) {
    multiplier *= 1 + features.violationCount * 0.2;
  }

  return Math.min(multiplier, 3.0); // Cap at 3x
}
