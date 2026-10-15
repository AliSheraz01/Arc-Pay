import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WhatsAppAIAgent } from './aiAgent';
import { generatePairingToken, encryptPrivateKey, normalizePhone } from './crypto';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'easyzpay-arc-webhook-verify-token';
const BOT_PHONE_NUMBER = process.env.WHATSAPP_BOT_NUMBER || '923497225236';

// Green-API configuration (Free Developer plan)
const GREEN_API_ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE || '';
const GREEN_API_TOKEN_INSTANCE = process.env.GREEN_API_TOKEN_INSTANCE || '';
const GREEN_API_HOST = process.env.GREEN_API_HOST || 'https://api.green-api.com';

async function sendGreenApiMessage(chatId: string, message: string) {
  if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN_INSTANCE) {
    console.warn('[Green-API] GREEN_API_ID_INSTANCE or GREEN_API_TOKEN_INSTANCE not set');
    return;
  }
  const url = `${GREEN_API_HOST}/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN_INSTANCE}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Green-API] Error sending message:', err);
    } else {
      console.log(`[Green-API] Message sent to ${chatId}`);
    }
  } catch (e) {
    console.error('[Green-API] Network error:', e);
  }
}

export function createChatToPayRouter(prisma: PrismaClient): Router {
  const router = Router();
  const agent = new WhatsAppAIAgent(prisma);

  /**
   * 1. Create a time-sensitive pairing session from the frontend
   */
  router.post('/pairing/create', async (req: Request, res: Response) => {
    try {
      const { 
        smartAccountAddress, 
        ownerAddress, 
        sessionPublicKey, 
        sessionPrivateKey, 
        spendingLimit = '50.0', 
        expiryDays = 7 
      } = req.body;

      if (!smartAccountAddress || !ownerAddress || !sessionPublicKey || !sessionPrivateKey) {
        return res.status(400).json({ 
          error: 'Missing required parameters: smartAccountAddress, ownerAddress, sessionPublicKey, sessionPrivateKey' 
        });
      }

      // Generate secure 6-char time-sensitive pairing token (ARC-XXXX)
      const pairingToken = generatePairingToken();
      const pairingTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const validUntil = new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000);

      // Encrypt session private key at rest
      const sessionPrivateKeyEncrypted = encryptPrivateKey(sessionPrivateKey);

      const session = await prisma.whatsAppSession.create({
        data: {
          pairingToken,
          pairingTokenExpiresAt,
          smartAccountAddress,
          ownerAddress,
          sessionPublicKey,
          sessionPrivateKeyEncrypted,
          spendingLimit: String(spendingLimit),
          validUntil,
          status: 'PENDING_PAIRING',
        },
      });

      const whatsappDeepLink = `https://wa.me/${BOT_PHONE_NUMBER}?text=${encodeURIComponent(`PAIR ${pairingToken}`)}`;

      return res.json({
        success: true,
        pairingToken,
        expiresAt: pairingTokenExpiresAt.toISOString(),
        whatsappDeepLink,
        sessionId: session.id,
      });
    } catch (err: any) {
      console.error('[ChatToPay Router] Pairing creation error:', err);
      return res.status(500).json({ error: 'Failed to create pairing session' });
    }
  });

  /**
   * 2. Check pairing session status from the frontend
   */
  router.get('/pairing/status/:token', async (req: Request, res: Response) => {
    try {
      const token = req.params.token.toUpperCase();
      const session = await prisma.whatsAppSession.findUnique({
        where: { pairingToken: token },
        select: {
          id: true,
          status: true,
          phoneId: true,
          spendingLimit: true,
          spentAmount: true,
          validUntil: true,
          pairingTokenExpiresAt: true,
        },
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      return res.json({
        paired: session.status === 'PAIRED',
        status: session.status,
        phoneId: session.phoneId,
        spendingLimit: session.spendingLimit,
        spentAmount: session.spentAmount,
        validUntil: session.validUntil,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve session status' });
    }
  });

  /**
   * 3. Meta / WhatsApp Cloud API Webhook Verification (GET)
   */
  router.get('/webhook/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('[WhatsApp Webhook] Verification successful');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  });

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

  /**
   * 4. Incoming WhatsApp Message Webhook (POST) - Supports Green-API, Twilio & Meta
   */
  router.post('/webhook/whatsapp', async (req: Request, res: Response) => {
    try {
      const body = req.body;
      let senderPhone = '';
      let messageText = '';
      const isTwilio = Boolean(body.AccountSid || (body.From && String(body.From).startsWith('whatsapp:')));
      const isGreenApi = Boolean(body.typeWebhook === 'incomingMessageReceived' || body.instanceData);
      let greenApiChatId = '';

      if (isGreenApi && body.messageData) {
        // Green-API format
        greenApiChatId = body.senderData?.chatId || body.senderData?.sender || '';
        senderPhone = normalizePhone(greenApiChatId.replace(/@.*$/, ''));
        messageText = (
          body.messageData?.textMessageData?.textMessage ||
          body.messageData?.extendedTextMessageData?.text ||
          ''
        ).trim();
      } else if (body.entry && body.entry[0]?.changes && body.entry[0]?.changes[0]?.value?.messages) {
        // Meta Cloud API format
        const msg = body.entry[0].changes[0].value.messages[0];
        senderPhone = normalizePhone(msg.from);
        messageText = msg.text?.body || '';
      } else if (body.From && (body.Body !== undefined)) {
        // Twilio WhatsApp format: From="whatsapp:+1234567890", Body="Pay 5 USDC..."
        senderPhone = normalizePhone(String(body.From).replace('whatsapp:', ''));
        messageText = String(body.Body || '').trim();
      } else if (body.from && body.text) {
        // Generic JSON payload
        senderPhone = normalizePhone(body.from);
        messageText = body.text;
      }

      if (!senderPhone || !messageText) {
        if (isTwilio) {
          res.setHeader('Content-Type', 'text/xml');
          return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        }
        return res.status(200).json({ status: 'ignored_empty_message' });
      }

      const providerTag = isGreenApi ? 'Green-API' : isTwilio ? 'Twilio' : 'Meta';
      console.log(`[WhatsApp Webhook] (${providerTag}) Message from ${senderPhone}: "${messageText}"`);

      // AI Agent parses intent and handles two-step confirmation
      const replyMessage = await agent.handleIncomingMessage(senderPhone, messageText);

      console.log(`[WhatsApp Webhook] Replying to ${senderPhone}: "${replyMessage}"`);

      // 1. If request came from Green-API, send reply via Green-API REST API
      if (isGreenApi && greenApiChatId) {
        await sendGreenApiMessage(greenApiChatId, replyMessage);
        return res.status(200).json({ status: 'ok', to: greenApiChatId });
      }

      // 2. If request came from Twilio, respond with TwiML XML
      if (isTwilio) {
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escapeXml(replyMessage)}</Message>\n</Response>`
        );
      }

      // 3. Default JSON response (for Meta or simulator)
      return res.json({
        success: true,
        to: senderPhone,
        reply: replyMessage,
      });
    } catch (err: any) {
      console.error('[WhatsApp Webhook] Handler error:', err);
      return res.status(500).json({ error: 'Internal webhook error' });
    }
  });

  /**
   * 5. Interactive Simulator Endpoint (for testing, demo, & CI verification)
   */
  router.post('/simulate', async (req: Request, res: Response) => {
    try {
      const { phoneId, message } = req.body;
      if (!phoneId || !message) {
        return res.status(400).json({ error: 'phoneId and message are required' });
      }

      const normalized = normalizePhone(phoneId);
      const reply = await agent.handleIncomingMessage(normalized, message);

      return res.json({
        success: true,
        phoneId: normalized,
        incomingMessage: message,
        replyMessage: reply,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
