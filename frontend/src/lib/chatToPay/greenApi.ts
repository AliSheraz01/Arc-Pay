const GREEN_API_ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE || '710722767360'
const GREEN_API_TOKEN_INSTANCE = process.env.GREEN_API_TOKEN_INSTANCE || 'a0fe160db0fe4de8ac1d93c7ec9cd3cf67ef66a855014e8087'
const GREEN_API_HOST = process.env.GREEN_API_HOST || 'https://api.green-api.com'

export async function sendGreenApiMessage(chatId: string, message: string): Promise<boolean> {
  if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN_INSTANCE) {
    console.warn('[Green-API] Missing GREEN_API_ID_INSTANCE or GREEN_API_TOKEN_INSTANCE')
    return false
  }

  // Green-API requires chatId to end with @c.us for WhatsApp users
  const formattedChatId = chatId.includes('@') ? chatId : `${chatId.replace(/^\+/, '')}@c.us`
  const url = `${GREEN_API_HOST}/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN_INSTANCE}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: formattedChatId,
        message,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Green-API] Error sending message:', err)
      return false
    }

    console.log(`[Green-API] Message successfully sent to ${formattedChatId}`)
    return true
  } catch (err) {
    console.error('[Green-API] Network error while sending message:', err)
    return false
  }
}
