import { TwitterApi } from 'twitter-api-v2'
import { XMentionItem } from './types'

export class XApiClient {
  private client: TwitterApi | null = null
  private botUserId: string | null = null
  public botUsername: string | null = null
  public lastError: string | null = null

  constructor() {
    const appKey = process.env.X_API_KEY
    const appSecret = process.env.X_API_SECRET
    const accessToken = process.env.X_ACCESS_TOKEN
    const accessSecret = process.env.X_ACCESS_SECRET

    if (appKey && appSecret && accessToken && accessSecret) {
      this.client = new TwitterApi({
        appKey,
        appSecret,
        accessToken,
        accessSecret,
      })
      this.botUserId = process.env.X_BOT_USER_ID || null
    }
  }

  isConfigured(): boolean {
    return this.client !== null
  }

  /**
   * Fetches the bot's own user ID if not provided in env
   */
  async getBotUserId(): Promise<string | null> {
    if (this.botUserId) return this.botUserId
    if (!this.client) {
      this.lastError = 'Twitter client is not initialized (missing API keys)'
      return null
    }

    try {
      const me = await this.client.v2.me()
      this.botUserId = me.data.id
      this.botUsername = me.data.username
      return this.botUserId
    } catch (err: any) {
      this.lastError = `v2.me error (${err.code || err.status || 'unknown'}): ${err.message || err}`
      console.error('[XApiClient] Failed to fetch bot user identity:', err.message)
      return null
    }
  }

  /**
   * Fetches latest mentions using Twitter API v2
   */
  async fetchMentions(sinceId?: string): Promise<XMentionItem[]> {
    if (!this.client) {
      this.lastError = 'Twitter client not configured'
      return []
    }

    const botId = await this.getBotUserId()
    if (!botId) {
      if (!this.lastError) this.lastError = 'Could not resolve bot user ID'
      return []
    }

    try {
      const queryParams: any = {
        max_results: 10,
        'tweet.fields': ['created_at', 'author_id', 'conversation_id'],
        expansions: ['author_id'],
        'user.fields': ['username', 'name'],
      }

      if (sinceId) {
        queryParams.since_id = sinceId
      }

      const res = await this.client.v2.userMentionTimeline(botId, queryParams)
      if (!res.data || !res.data.data) {
        return []
      }

      const userMap = new Map<string, string>()
      if (res.data.includes && (res.data.includes as any).users) {
        for (const u of (res.data.includes as any).users) {
          userMap.set(u.id, u.username)
        }
      }

      return res.data.data.map(t => ({
        id: t.id,
        text: t.text,
        authorId: t.author_id,
        authorUsername: t.author_id ? userMap.get(t.author_id) : undefined,
        createdAt: t.created_at,
        conversationId: t.conversation_id,
      }))
    } catch (err: any) {
      this.lastError = `userMentionTimeline error (${err.code || err.status || 'unknown'}): ${err.message || err}`
      if (err.code === 429) {
        console.warn('[XApiClient] Rate limit reached (429). Will retry on next cycle.')
      } else {
        console.error('[XApiClient] Error fetching mentions:', err.message)
      }
      return []
    }
  }

  /**
   * Posts an on-chain confirmation reply to the original mention tweet
   */
  async reply(inReplyToTweetId: string, text: string): Promise<boolean> {
    if (!this.client) {
      console.log(`[XApiClient Dry-Run] Reply to ${inReplyToTweetId}: "${text}"`)
      return false
    }

    try {
      await this.client.v2.reply(text, inReplyToTweetId)
      return true
    } catch (err: any) {
      console.error(`[XApiClient] Failed to reply to tweet ${inReplyToTweetId}:`, err.message)
      return false
    }
  }
}
