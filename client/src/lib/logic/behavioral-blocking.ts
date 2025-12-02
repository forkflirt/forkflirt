import { get, set } from 'idb-keyval';

// Types for behavioral blocking
interface BlockedBehavior {
  userId: string;
  reason: 'spam' | 'harassment' | 'impersonation' | 'blocklist_bypass';
  timestamp: number;
  expiresAt: number;
  severity: 'low' | 'medium' | 'high';
}

export class BehavioralBlockList {
  private readonly STORAGE_KEY = 'forkflirt_behavioral_blocks';

  /**
   * Adds a behavioral block for a user
   */
  async addBehavioralBlock(
    userId: string,
    reason: BlockedBehavior['reason'],
    severity: BlockedBehavior['severity'] = 'medium',
    durationMs: number = 7 * 24 * 60 * 60 * 1000
  ): Promise<void> {
    const blocks = await this.getBlocks();
    const now = Date.now();

    blocks.push({
      userId,
      reason,
      timestamp: now,
      expiresAt: now + durationMs,
      severity
    });

    // Clean up expired blocks
    const active = blocks.filter(b => b.expiresAt > now);
    await set(this.STORAGE_KEY, active);

    console.log(`🚫 Behavioral block added for user ${userId} (${reason}, ${severity})`);
  }

  /**
   * Checks if a user is behaviorally blocked
   */
  async isBlocked(userId: string): Promise<boolean> {
    const blocks = await this.getBlocks();
    const now = Date.now();

    // Clean up expired blocks
    const active = blocks.filter(b => b.expiresAt > now);
    await set(this.STORAGE_KEY, active);

    return active.some(b => b.userId === userId);
  }

  /**
   * Gets block information for a user
   */
  async getBlockInfo(userId: string): Promise<BlockedBehavior | null> {
    const blocks = await this.getBlocks();
    const now = Date.now();

    // Clean up expired blocks
    const active = blocks.filter(b => b.expiresAt > now);
    await set(this.STORAGE_KEY, active);

    return active.find(b => b.userId === userId) || null;
  }

  /**
   * Gets all active behavioral blocks
   */
  async getBlocks(): Promise<BlockedBehavior[]> {
    return await get(this.STORAGE_KEY) || [];
  }

  /**
   * Removes a behavioral block for a user
   */
  async removeBehavioralBlock(userId: string): Promise<void> {
    const blocks = await this.getBlocks();
    const filtered = blocks.filter(b => b.userId !== userId);
    await set(this.STORAGE_KEY, filtered);

    console.log(`✅ Behavioral block removed for user ${userId}`);
  }

  /**
   * Clears all behavioral blocks
   */
  async clearAllBlocks(): Promise<void> {
    await set(this.STORAGE_KEY, []);
    console.log('🗑️ All behavioral blocks cleared');
  }
}

// Fuzzy matching functions to prevent keyword obfuscation bypass

/**
 * Normalizes text for fuzzy keyword matching by removing common obfuscation patterns
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Remove non-alphanumeric characters
    .replace(/[^\w]/g, '')
    // Common leet speak replacements
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/2/g, 'z')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/6/g, 'g')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'p')
    // Remove repeated characters (e.g., "llaaame" -> "lame")
    .replace(/(.)\1{2,}/g, '$1');
}

/**
 * Fuzzy keyword matching that detects obfuscated versions of blocked keywords
 */
export function fuzzyKeywordMatch(text: string, keyword: string): boolean {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);

  // Direct match in normalized text
  if (normalizedText.includes(normalizedKeyword)) {
    return true;
  }

  // Check for partial matches (catches things like "tr*nsf*r")
  const keywords = keyword.split(/\s+/);
  if (keywords.length > 1) {
    // For multi-word keywords, check if most words are present
    const matchedWords = keywords.filter(word =>
      normalizedText.includes(normalizeText(word))
    );
    return matchedWords.length >= Math.ceil(keywords.length * 0.7);
  }

  return false;
}

/**
 * Advanced pattern detection for sophisticated obfuscation
 */
export function detectObfuscationPatterns(text: string): boolean {
  const patterns = [
    // Character repetition or removal
    /[a-z]{1,2}[\*\.\_\-]+[a-z]{1,2}/gi,
    // Mixed case patterns
    /[a-z][A-Z][a-z][A-Z]/gi,
    // Number substitution
    /\w*[0-9]+\w*/gi,
    // Excessive whitespace
    /\s{3,}/,
    // Random character insertion
    /[a-z][^\w\s][a-z]/gi
  ];

  const suspiciousPatterns = patterns.filter(pattern => pattern.test(text));
  return suspiciousPatterns.length >= 2; // Require multiple patterns to avoid false positives
}

/**
 * Analyzes behavioral patterns to detect potential abuse
 */
export class BehavioralAnalyzer {
  private readonly patternStorageKey = 'forkflirt_behavioral_analysis';

  /**
   * Analyzes user behavior for potential spam or harassment patterns
   */
  async analyzeBehavior(
    userId: string,
    content: string,
    context: 'message' | 'profile' | 'interaction'
  ): Promise<{
    risk: 'low' | 'medium' | 'high';
    reasons: string[];
    suggestedAction?: 'monitor' | 'block' | 'flag';
  }> {
    const patterns = await this.getStoredPatterns(userId);
    const now = Date.now();

    // Analyze content
    const issues: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for repetitive content
    if (this.isRepetitive(content, patterns)) {
      issues.push('Repetitive content detected');
      riskLevel = 'medium';
    }

    // Check for rapid interactions
    const recentInteractions = patterns.interactions?.filter(
      (i: any) => now - i.timestamp < 60000 // Last minute
    ) || [];

    if (recentInteractions.length > 10) {
      issues.push('Rapid interaction pattern');
      riskLevel = 'high';
    }

    // Check for obfuscation patterns
    if (detectObfuscationPatterns(content)) {
      issues.push('Obfuscation techniques detected');
      riskLevel = 'high';
    }

    // Store this interaction for future analysis
    await this.recordInteraction(userId, content, context);

    return {
      risk: riskLevel,
      reasons: issues,
      suggestedAction: riskLevel === 'high' ? 'block' : riskLevel === 'medium' ? 'monitor' : undefined
    };
  }

  private isRepetitive(content: string, patterns: any): boolean {
    // Simple repetition detection
    const recentContents = patterns.content?.slice(-5) || [];
    const normalizedContent = normalizeText(content);

    const similarCount = recentContents.filter((c: string) => {
      const similarity = this.calculateSimilarity(normalizedContent, normalizeText(c));
      return similarity > 0.8; // 80% similarity threshold
    }).length;

    return similarCount >= 2;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async recordInteraction(userId: string, content: string, context: string): Promise<void> {
    const patterns = await this.getStoredPatterns(userId);
    const now = Date.now();

    if (!patterns.content) patterns.content = [];
    if (!patterns.interactions) patterns.interactions = [];

    patterns.content.push(content);
    patterns.interactions.push({
      timestamp: now,
      context,
      contentHash: this.simpleHash(content)
    });

    // Keep only recent data (last 100 items)
    patterns.content = patterns.content.slice(-100);
    patterns.interactions = patterns.interactions.slice(-100);

    await set(`${this.patternStorageKey}_${userId}`, patterns);
  }

  private async getStoredPatterns(userId: string): Promise<any> {
    return await get(`${this.patternStorageKey}_${userId}`) || {};
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}

// Export instances for easy use
export const behavioralBlockList = new BehavioralBlockList();
export const behavioralAnalyzer = new BehavioralAnalyzer();