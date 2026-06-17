'use client'

import { useState, useRef, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import {
  USDC_ADDRESS,
  REGISTRY_ADDRESS,
  BULK_ROUTER_ADDRESS,
  EXPLORER_URL
} from '@/lib/constants'
import { USDC_ABI, REGISTRY_ABI, BULK_ROUTER_ABI } from '@/lib/abi'
import { MdAutoAwesome, MdSend, MdCheckCircle, MdArrowForward, MdWarning } from 'react-icons/md'
import styles from './Agent.module.css'

type Recipient = {
  rawInput: string
  address: string | null
  amount: string
  isValid: boolean
}

export default function AgentPage() {
  const { address: myAddress } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [input, setInput] = useState('')
  const [state, setState] = useState<'idle' | 'analyzing' | 'breakdown' | 'approving' | 'sending' | 'success'>('idle')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [totalAmount, setTotalAmount] = useState('0')
  const [error, setError] = useState('')
  
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [sendTxHash, setSendTxHash] = useState<`0x${string}` | undefined>()

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: myAddress ? [myAddress, BULK_ROUTER_ADDRESS] : undefined,
  })

  const { isSuccess: sendSuccess } = useWaitForTransactionReceipt({ hash: sendTxHash })

  useEffect(() => {
    if (sendSuccess) {
      setState('success')
    }
  }, [sendSuccess])

  const handleAnalyze = async () => {
    if (!input.trim()) return
    setState('analyzing')
    setError('')
    
    // Simulate AI thinking delay
    await new Promise(r => setTimeout(r, 1200))

    try {
      // 1. Extract Amount
      const amountMatch = input.match(/(\d+(?:\.\d+)?)\s*USDC/i)
      const amount = amountMatch ? amountMatch[1] : null

      if (!amount) {
        throw new Error("I couldn't understand the amount. Try 'Send 10 USDC to...'")
      }

      // 2. Extract Recipients
      const toMatch = input.match(/to\s+(.*)/i)
      if (!toMatch) {
        throw new Error("I couldn't find the recipients. Try 'Send 10 USDC to alisheraz, alli'")
      }

      const rawNames = toMatch[1].split(/,|\band\b/).map(r => r.trim()).filter(r => r.length > 0)
      if (rawNames.length === 0) {
        throw new Error("No valid recipients found.")
      }

      // 3. Resolve addresses concurrently
      const resolvedRecipients: Recipient[] = await Promise.all(rawNames.map(async (name) => {
        let addr = null
        let isValid = false
        if (name.startsWith('0x') && name.length === 42) {
          addr = name
          isValid = true
        } else {
          const cleanName = name.replace('@', '').toLowerCase()
          try {
            const res = await publicClient!.readContract({
              address: REGISTRY_ADDRESS,
              abi: REGISTRY_ABI,
              functionName: 'resolveUsername',
              args: [cleanName]
            }) as string
            
            if (res && res !== '0x0000000000000000000000000000000000000000') {
              addr = res
              isValid = true
            }
          } catch (e) {
            console.error('Resolve failed for', name, e)
          }
        }
        return {
          rawInput: name,
          address: addr,
          amount: amount,
          isValid
        }
      }))

      setRecipients(resolvedRecipients)
      const total = Number(amount) * resolvedRecipients.length
      setTotalAmount(total.toString())
      setState('breakdown')

    } catch (err: any) {
      setError(err.message)
      setState('idle')
    }
  }

  const handleConfirm = async () => {
    const invalidCount = recipients.filter(r => !r.isValid).length
    if (invalidCount > 0) {
      setError(`Cannot proceed. ${invalidCount} recipient(s) are invalid.`)
      return
    }

    try {
      const amounts = recipients.map(r => parseUnits(r.amount, 6))
      const totalUnits = amounts.reduce((acc, val) => acc + val, 0n)
      
      if (allowance === undefined || (allowance as bigint) < totalUnits) {
        // Need to approve
        setState('approving')
        const hash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [BULK_ROUTER_ADDRESS, totalUnits],
        })
        setApproveTxHash(hash)
        
        // Wait briefly for approval to be mined (matching send page pattern)
        await new Promise(r => setTimeout(r, 3000))
      }

      // Execute send
      await executeBulkSend(amounts)
      
    } catch (e: any) {
      setError(e.message || "Transaction failed")
      setState('breakdown')
    }
  }

  const executeBulkSend = async (precomputedAmounts?: readonly bigint[]) => {
    setState('sending')
    try {
      const addresses = recipients.map(r => r.address as `0x${string}`)
      const amounts = precomputedAmounts || recipients.map(r => parseUnits(r.amount, 6))
      const memos = recipients.map(() => 'Sent via AI Pay Agent')

      const hash = await writeContractAsync({
        address: BULK_ROUTER_ADDRESS,
        abi: BULK_ROUTER_ABI,
        functionName: 'sendBulkPayment',
        args: [addresses, amounts, memos],
      })
      setSendTxHash(hash)
    } catch (e: any) {
      setError(e.message || "Bulk send failed")
      setState('breakdown')
    }
  }

  return (
    <PageLayout>
      <NetworkGuard>
        <div className={styles.container}>
          
          <div className={styles.header}>
            <h1 className={styles.title}>
              <MdAutoAwesome color="var(--accent)" /> AI Pay Agent
            </h1>
            <p className={styles.subtitle}>Send payments by simply asking.</p>
          </div>

          {state === 'idle' && (
            <div className={`${styles.card} slide-up`}>
              <div className={styles.chatArea}>
                <label className={styles.chatLabel}>Payment Command</label>
                <div className={styles.chatInputWrapper}>
                  <textarea
                    className={styles.chatInput}
                    placeholder="e.g. Send 10 USDC to alisheraz, alli, and 0x123..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAnalyze()
                      }
                    }}
                  />
                  <button 
                    className={styles.sendButton} 
                    onClick={handleAnalyze}
                    disabled={!input.trim()}
                  >
                    <MdSend size={20} />
                  </button>
                </div>
                {error && <div style={{ color: 'var(--red)', fontSize: '14px', marginTop: '8px' }}>{error}</div>}
              </div>
            </div>
          )}

          {state === 'analyzing' && (
            <div className={`${styles.card} ${styles.analyzingState} slide-up`}>
              <div className={styles.spinner}></div>
              <div className={styles.analyzingText}>Analyzing Request...</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Resolving usernames to wallet addresses</p>
            </div>
          )}

          {(state === 'breakdown' || state === 'approving' || state === 'sending') && (
            <div className={`${styles.card} slide-up`}>
              <div className={styles.breakdownHeader}>
                Payment Breakdown
              </div>
              
              <div className={styles.recipientList}>
                {recipients.map((r, i) => (
                  <div key={i} className={styles.recipientItem}>
                    <div className={styles.recipientInfo}>
                      <div className={styles.recipientAvatar}>
                        {r.rawInput[0].toUpperCase()}
                      </div>
                      <div>
                        <div className={styles.recipientName}>
                          {r.rawInput.startsWith('0x') ? 'Address' : `@${r.rawInput.replace('@', '')}`}
                          {!r.isValid && <MdWarning color="var(--red)" title="Address not found" />}
                        </div>
                        <div className={styles.recipientAddress} style={{ color: r.isValid ? 'var(--text-secondary)' : 'var(--red)' }}>
                          {r.isValid ? r.address : 'Unregistered User'}
                        </div>
                      </div>
                    </div>
                    <div className={styles.recipientAmount}>
                      {r.amount} USDC
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.totalSection}>
                <div className={styles.totalLabel}>Total Batch Amount</div>
                <div className={styles.totalValue}>{totalAmount} USDC</div>
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>{error}</div>}

              <div className={styles.actionRow}>
                <button 
                  className={styles.cancelBtn} 
                  onClick={() => setState('idle')}
                  disabled={state !== 'breakdown'}
                >
                  Cancel
                </button>
                <button 
                  className={styles.confirmBtn} 
                  onClick={handleConfirm}
                  disabled={state !== 'breakdown' || recipients.some(r => !r.isValid)}
                >
                  {state === 'approving' ? 'Approving USDC...' : state === 'sending' ? 'Sending Bulk Payment...' : 'Confirm Bulk Payment'}
                  {state === 'breakdown' && <MdArrowForward />}
                </button>
              </div>
            </div>
          )}

          {state === 'success' && (
            <div className={`${styles.card} ${styles.successState} slide-up`}>
              <div className={styles.successIcon}>
                <MdCheckCircle size={40} />
              </div>
              <h2 className={styles.successTitle}>Payment Successful!</h2>
              <p className={styles.successSubtitle}>Your bulk transaction has been confirmed on the Arc Network.</p>
              
              <div className={styles.receiptCard}>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>Recipients</span>
                  <span className={styles.receiptValue}>{recipients.length}</span>
                </div>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>Total Amount</span>
                  <span className={styles.receiptValue}>{totalAmount} USDC</span>
                </div>
                {sendTxHash && (
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Transaction Hash</span>
                    <a href={`${EXPLORER_URL}/tx/${sendTxHash}`} target="_blank" rel="noreferrer" className={styles.receiptValue} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                      {sendTxHash.slice(0,10)}...{sendTxHash.slice(-8)}
                    </a>
                  </div>
                )}
                <div className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>Status</span>
                  <span className={styles.receiptValue} style={{ color: 'var(--green)' }}>Confirmed</span>
                </div>
              </div>

              <button 
                className={styles.confirmBtn} 
                style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}
                onClick={() => {
                  setInput('')
                  setState('idle')
                }}
              >
                Start New Payment
              </button>
            </div>
          )}

        </div>
      </NetworkGuard>
    </PageLayout>
  )
}
