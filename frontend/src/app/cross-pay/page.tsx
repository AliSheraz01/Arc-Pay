'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { PageLayout } from '@/components/PageLayout'
import Link from 'next/link'
import { 
  ArrowLeftRight, 
  ChevronDown, 
  Check, 
  Loader2, 
  X, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  ArrowLeft,
  CheckCircle2
} from 'lucide-react'
import { 
  useAccount, 
  useSwitchChain, 
  useChainId, 
  useWriteContract, 
  useReadContract 
} from 'wagmi'
import { 
  parseUnits, 
  isAddress, 
  createPublicClient, 
  http, 
  decodeEventLog, 
  encodeFunctionData 
} from 'viem'
import { 
  CCTP_V2_CONFIGS, 
  getCctpConfig, 
  addressToBytes32, 
  CctpChainConfig, 
  IS_PRODUCTION 
} from '@/lib/constants'
import { USDC_ABI, TOKEN_MESSENGER_ABI, MESSAGE_TRANSMITTER_ABI } from '@/lib/abi'

const SUPPORTED_CHAINS = Object.values(CCTP_V2_CONFIGS)

interface InFlightTransfer {
  sourceChainId: number
  destinationChainId: number
  amount: string
  sourceTxHash?: `0x${string}`
  destinationTxHash?: `0x${string}`
  cctpMessage?: `0x${string}`
  attestation?: string
  status: 'validating' | 'approving' | 'burning' | 'attestation_pending' | 'attestation_received' | 'destination_pending' | 'complete' | 'error'
  errorReason?: string
  timestamp: string
}

export default function CrossPayPage() {
  const { isConnected, address } = useAccount()
  const activeChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  // Default chains: Arc Mainnet (5042) and Base (8453)
  const defaultFrom = IS_PRODUCTION ? (CCTP_V2_CONFIGS[5042] || SUPPORTED_CHAINS[0]) : (CCTP_V2_CONFIGS[5042002] || SUPPORTED_CHAINS[0])
  const defaultTo = IS_PRODUCTION ? (CCTP_V2_CONFIGS[8453] || SUPPORTED_CHAINS[1] || SUPPORTED_CHAINS[0]) : (CCTP_V2_CONFIGS[84532] || SUPPORTED_CHAINS[0])

  const [fromChain, setFromChain] = useState<CctpChainConfig>(defaultFrom)
  const [toChain, setToChain] = useState<CctpChainConfig>(defaultTo)
  const [amount, setAmount] = useState('')
  const [balanceMap, setBalanceMap] = useState<Record<number, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Chain selection modal
  const [chainSelectorTarget, setChainSelectorTarget] = useState<'from' | 'to' | null>(null)

  // In-flight active transfer & modal
  const [activeTransfer, setActiveTransfer] = useState<InFlightTransfer | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)

  // Manually Claim modal
  const [showManualClaimModal, setShowManualClaimModal] = useState(false)

  const { writeContractAsync: writeApprove } = useWriteContract()
  const { writeContractAsync: writeDeposit } = useWriteContract()
  const { writeContractAsync: writeReceiveMessage } = useWriteContract()

  // Check allowance on source chain
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: fromChain.usdc,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, fromChain.tokenMessenger] : undefined,
    query: { enabled: !!address && activeChainId === fromChain.chainId },
  })

  // Load balances across chains
  const loadBalances = useCallback(async (addr: string) => {
    if (!addr) return
    setLoadingBalances(true)
    const map: Record<number, string> = {}
    await Promise.all(
      SUPPORTED_CHAINS.map(async (c) => {
        try {
          const client = createPublicClient({ transport: http(c.rpcUrl) })
          const bal = await client.readContract({
            address: c.usdc,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [addr as `0x${string}`],
          })
          const formatted = (Number(bal) / Math.pow(10, c.decimals)).toFixed(4)
          map[c.chainId] = formatted
        } catch {
          map[c.chainId] = '0.0000'
        }
      })
    )
    setBalanceMap(map)
    setLoadingBalances(false)
  }, [])

  useEffect(() => {
    if (address) {
      loadBalances(address)
    }
  }, [address, loadBalances, activeTransfer?.status])

  // Restore active transfer on mount
  useEffect(() => {
    if (!address) return
    try {
      const saved = localStorage.getItem(`cctp_transfer_${address.toLowerCase()}`)
      if (saved) {
        const parsed: InFlightTransfer = JSON.parse(saved)
        if (parsed && parsed.status !== 'complete') {
          setActiveTransfer(parsed)
          // If in progress and not complete, reopen modal and resume polling
          setShowTransferModal(true)
          if (parsed.sourceTxHash && parsed.status === 'attestation_pending') {
            const srcCfg = getCctpConfig(parsed.sourceChainId)
            pollCircleAttestation(srcCfg.domain, parsed.sourceTxHash, parsed.cctpMessage || null, parsed)
          }
        }
      }
    } catch {}
  }, [address])

  // Save transfer state
  useEffect(() => {
    if (!address) return
    if (activeTransfer) {
      localStorage.setItem(`cctp_transfer_${address.toLowerCase()}`, JSON.stringify(activeTransfer))
      // Also sync to general history
      if (activeTransfer.sourceTxHash) {
        try {
          const raw = localStorage.getItem(`easyzpay_local_txs_${address.toLowerCase()}`) || '[]'
          const list = JSON.parse(raw)
          const existingIdx = list.findIndex((t: any) => t.txHash?.toLowerCase() === activeTransfer.sourceTxHash?.toLowerCase())
          const item = {
            id: activeTransfer.sourceTxHash,
            txHash: activeTransfer.sourceTxHash,
            fromAddress: address.toLowerCase(),
            toAddress: address.toLowerCase(),
            amount: activeTransfer.amount,
            token: 'USDC',
            chainId: activeTransfer.sourceChainId,
            sourceChain: activeTransfer.sourceChainId,
            destinationChain: activeTransfer.destinationChainId,
            destinationTxHash: activeTransfer.destinationTxHash,
            type: 'CROSS_PAY',
            status: activeTransfer.status === 'complete' ? 'COMPLETED' : 'PENDING',
            timestamp: activeTransfer.timestamp,
          }
          if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...item }
          } else {
            list.unshift(item)
          }
          localStorage.setItem(`easyzpay_local_txs_${address.toLowerCase()}`, JSON.stringify(list.slice(0, 50)))
        } catch {}
      }
    }
  }, [activeTransfer, address])

  // Poll Circle Attestation
  const pollCircleAttestation = async (
    sourceDomainId: number,
    txHash: `0x${string}`,
    rawMsgFallback: `0x${string}` | null,
    baseTransfer: InFlightTransfer
  ) => {
    let attempts = 0
    const maxAttempts = 120
    const interval = setInterval(async () => {
      attempts++
      try {
        let attData: any = null
        // 1. Try local Next.js route
        try {
          const res = await fetch('/api/cctp/attestation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceDomainId, transactionHash: txHash }),
          })
          if (res.ok) {
            attData = await res.json()
          }
        } catch {}

        // 2. Fallback directly to Circle Iris API
        if (!attData || !attData.attestation) {
          try {
            const irisRes = await fetch(`https://iris-api.circle.com/v2/messages/${sourceDomainId}?transactionHash=${txHash}`)
            if (irisRes.ok) {
              const irisJson = await irisRes.json()
              if (irisJson.messages?.[0]) {
                attData = {
                  status: irisJson.messages[0].status,
                  attestation: irisJson.messages[0].attestation,
                  message: irisJson.messages[0].message || rawMsgFallback,
                }
              }
            }
          } catch {}
        }

        if (attData && attData.status === 'complete' && attData.attestation) {
          clearInterval(interval)
          setActiveTransfer(prev => prev ? {
            ...prev,
            cctpMessage: (attData.message as `0x${string}`) || rawMsgFallback || prev.cctpMessage,
            attestation: attData.attestation,
            status: 'attestation_received',
          } : null)
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval)
          setActiveTransfer(prev => prev ? {
            ...prev,
            status: 'error',
            errorReason: 'Circle attestation polling timed out. You can manually claim once ready.',
          } : null)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 5000)
  }

  // Swap chains
  const handleSwapChains = () => {
    const temp = fromChain
    setFromChain(toChain)
    setToChain(temp)
    if (switchChainAsync) {
      switchChainAsync({ chainId: toChain.chainId }).catch(console.error)
    }
  }

  // Execute Bridge flow
  const handleBridge = async () => {
    if (!address) return
    setErrorMessage(null)

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter an amount greater than 0')
      return
    }

    const currentBal = parseFloat(balanceMap[fromChain.chainId] || '0')
    if (parseFloat(amount) > currentBal) {
      setErrorMessage(`Insufficient USDC balance on ${fromChain.name}`)
      return
    }

    const parsedAmount = parseUnits(amount, fromChain.decimals)

    const newTransfer: InFlightTransfer = {
      sourceChainId: fromChain.chainId,
      destinationChainId: toChain.chainId,
      amount,
      status: 'validating',
      timestamp: new Date().toISOString(),
    }
    setActiveTransfer(newTransfer)
    setShowTransferModal(true)

    try {
      // 1. Ensure connected to source chain
      if (activeChainId !== fromChain.chainId) {
        await switchChainAsync({ chainId: fromChain.chainId })
      }

      // 2. Approve TokenMessenger if necessary
      if (allowance === undefined || (allowance as bigint) < parsedAmount) {
        setActiveTransfer(prev => prev ? { ...prev, status: 'approving' } : null)
        const approveTx = await writeApprove({
          address: fromChain.usdc,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [fromChain.tokenMessenger, parsedAmount],
          chainId: fromChain.chainId,
        })
        const sourceClient = createPublicClient({ transport: http(fromChain.rpcUrl) })
        await sourceClient.waitForTransactionReceipt({ hash: approveTx })
        await refetchAllowance()
      }

      // 3. Deposit For Burn on Source Chain (Circle CCTP V2)
      setActiveTransfer(prev => prev ? { ...prev, status: 'burning' } : null)
      const mintRecipientBytes32 = addressToBytes32(address)
      const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

      const burnTxHash = await writeDeposit({
        address: fromChain.tokenMessenger,
        abi: TOKEN_MESSENGER_ABI,
        functionName: 'depositForBurn',
        args: [
          parsedAmount,
          toChain.domain,
          mintRecipientBytes32,
          fromChain.usdc,
          ZERO_BYTES32,     // destinationCaller: anyone
          0n,               // maxFee: 0 = Standard Transfer
          2000,             // minFinalityThreshold: 2000 = Finalized
        ],
        chainId: fromChain.chainId,
      })

      setActiveTransfer(prev => prev ? {
        ...prev,
        sourceTxHash: burnTxHash,
        status: 'attestation_pending',
      } : null)

      // 4. Wait for Source Receipt and extract CCTP Message
      const sourceClient = createPublicClient({ transport: http(fromChain.rpcUrl) })
      const sourceReceipt = await sourceClient.waitForTransactionReceipt({ hash: burnTxHash })

      let rawMessage: `0x${string}` | null = null
      for (const log of sourceReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: MESSAGE_TRANSMITTER_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'MessageSent' && decoded.args?.message) {
            rawMessage = decoded.args.message as `0x${string}`
            break
          }
        } catch {}
      }

      if (rawMessage) {
        setActiveTransfer(prev => prev ? { ...prev, cctpMessage: rawMessage || undefined } : null)
      }

      // 5. Poll Circle Attestation
      pollCircleAttestation(fromChain.domain, burnTxHash, rawMessage, newTransfer)
    } catch (err: any) {
      console.error('Bridge error:', err)
      const reason = err.message?.slice(0, 140) || 'Transaction failed.'
      setErrorMessage(reason)
      setActiveTransfer(prev => prev ? { ...prev, status: 'error', errorReason: reason } : null)
    }
  }

  // Claim on destination
  const handleClaim = async () => {
    if (!activeTransfer || !activeTransfer.cctpMessage || !activeTransfer.attestation) return
    const destCfg = getCctpConfig(activeTransfer.destinationChainId)

    setActiveTransfer(prev => prev ? { ...prev, status: 'destination_pending' } : null)

    try {
      // 1. Switch to destination chain
      if (activeChainId !== destCfg.chainId) {
        await switchChainAsync({ chainId: destCfg.chainId })
      }

      // 2. Call receiveMessage
      const destTxHash = await writeReceiveMessage({
        address: destCfg.messageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [
          activeTransfer.cctpMessage,
          activeTransfer.attestation as `0x${string}`,
        ],
        chainId: destCfg.chainId,
      })

      // 3. Wait for confirmation
      const destClient = createPublicClient({ transport: http(destCfg.rpcUrl) })
      await destClient.waitForTransactionReceipt({ hash: destTxHash })

      setActiveTransfer(prev => prev ? {
        ...prev,
        destinationTxHash: destTxHash,
        status: 'complete',
      } : null)

      if (address) {
        loadBalances(address)
        localStorage.removeItem(`cctp_transfer_${address.toLowerCase()}`)
      }
    } catch (err: any) {
      console.error('Claim error:', err)
      const reason = err.message?.slice(0, 140) || 'Failed to claim USDC on destination chain.'
      setActiveTransfer(prev => prev ? { ...prev, status: 'error', errorReason: reason } : null)
    }
  }

  const sourceBal = balanceMap[fromChain.chainId] || '0.0000'
  const destBal = balanceMap[toChain.chainId] || '0.0000'
  const isWrongNetwork = activeChainId !== fromChain.chainId

  return (
    <PageLayout>
      <main style={{ maxWidth: '580px', margin: '0 auto', padding: '0 16px 60px 16px' }}>
        
        {/* Back Link */}
        <Link 
          href="/" 
          style={{ 
            color: 'var(--text-muted)', 
            fontSize: '13px', 
            textDecoration: 'none', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            marginBottom: '20px', 
            fontWeight: 600 
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* Main Card (Styled exactly like https://www.cctp.to/) */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '28px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
          position: 'relative'
        }}>

          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <BridgeIcon size={22} color="var(--accent)" />
                <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                  Start Bridging
                </h1>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                Move assets across chains. This site adds no fees.
              </p>
            </div>

            {/* Manually Claim Pill Button */}
            <button
              type="button"
              onClick={() => setShowManualClaimModal(true)}
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              Manually Claim
            </button>
          </div>

          {/* Chain Selectors Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            
            {/* Source Chain */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Source Chain
              </span>
              <button
                type="button"
                onClick={() => setChainSelectorTarget('from')}
                style={{
                  width: '100%',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <ChainLogo chain={fromChain} size={22} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {fromChain.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {loadingBalances ? '...' : sourceBal} USDC
                  </span>
                  <ChevronDown size={14} color="var(--text-muted)" />
                </div>
              </button>
            </div>

            {/* Swap Button */}
            <div style={{ paddingTop: '20px' }}>
              <button
                type="button"
                onClick={handleSwapChains}
                aria-label="Swap source and destination chains"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                <ArrowLeftRight size={15} />
              </button>
            </div>

            {/* Destination Chain */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Destination Chain
              </span>
              <button
                type="button"
                onClick={() => setChainSelectorTarget('to')}
                style={{
                  width: '100%',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <ChainLogo chain={toChain} size={22} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {toChain.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {loadingBalances ? '...' : destBal} USDC
                  </span>
                  <ChevronDown size={14} color="var(--text-muted)" />
                </div>
              </button>
            </div>
          </div>

          {/* Amount Box */}
          <div style={{ marginBottom: '18px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Amount
            </span>
            <div style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                
                {/* USDC Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '6px 12px',
                }}>
                  <UsdcIcon size={22} />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>USDC</span>
                  <ChevronDown size={14} color="var(--text-muted)" />
                </div>

                {/* Amount Input */}
                <input
                  type="number"
                  step="any"
                  placeholder="0.0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{
                    width: '60%',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '28px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Balance & Quick Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '10px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Balance: {sourceBal}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const num = parseFloat(sourceBal)
                    if (num > 0) setAmount((num / 2).toFixed(4))
                  }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', padding: 0
                  }}
                >
                  Half
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const num = parseFloat(sourceBal)
                    if (num > 0) setAmount(sourceBal)
                  }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', padding: 0
                  }}
                >
                  Max
                </button>
              </div>
            </div>
          </div>

          {/* Send To Row (Connected Wallet only) */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Send to
            </span>
            <div style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '13.5px',
                color: address ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {address || 'Connect wallet to view destination address'}
              </span>
              {address && (
                <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
                  <CheckCircle2 size={18} fill="#10b981" color="#fff" />
                </div>
              )}
            </div>
          </div>

          {/* Info Badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
            <span style={{
              background: 'rgba(16, 53, 246, 0.08)',
              color: 'var(--accent)',
              fontSize: '12px',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '10px'
            }}>
              Fee: 0 USDC
            </span>
            <span style={{
              background: 'rgba(16, 53, 246, 0.08)',
              color: 'var(--accent)',
              fontSize: '12px',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '10px'
            }}>
              ETA: a few seconds
            </span>
            <span style={{
              background: 'rgba(16, 53, 246, 0.08)',
              color: 'var(--accent)',
              fontSize: '12px',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '10px'
            }}>
              CCTP v2
            </span>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '12px',
              color: '#ef4444',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary Action Button */}
          {!address ? (
            <div style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '15px'
            }}>
              Connect wallet from top bar to bridge
            </div>
          ) : isWrongNetwork ? (
            <button
              type="button"
              onClick={() => switchChainAsync({ chainId: fromChain.chainId })}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 53, 246, 0.3)'
              }}
            >
              Switch Network to {fromChain.name}
            </button>
          ) : (
            <button
              type="button"
              disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(sourceBal)}
              onClick={handleBridge}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                background: !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(sourceBal)
                  ? 'var(--surface-raised)' 
                  : '#1f242f',
                border: !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(sourceBal)
                  ? '1px solid var(--border)' 
                  : 'none',
                color: !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(sourceBal)
                  ? 'var(--text-muted)' 
                  : '#fff',
                fontWeight: 800,
                fontSize: '16px',
                cursor: !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(sourceBal)
                  ? 'not-allowed' 
                  : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {!amount || parseFloat(amount) <= 0 
                ? 'Enter an amount' 
                : parseFloat(amount) > parseFloat(sourceBal)
                ? 'Insufficient balance'
                : 'Bridge'}
            </button>
          )}

          {/* In-Flight Transfer Quick Re-open Banner */}
          {activeTransfer && activeTransfer.status !== 'complete' && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(16, 53, 246, 0.08)',
              border: '1px solid var(--border-accent)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="animate-spin" color="var(--accent)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active transfer: {activeTransfer.amount} USDC to {getCctpConfig(activeTransfer.destinationChainId).name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                View Status
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Chain Selector Modal */}
      {chainSelectorTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Select {chainSelectorTarget === 'from' ? 'Source' : 'Destination'} Chain
              </h3>
              <button
                type="button"
                onClick={() => setChainSelectorTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUPPORTED_CHAINS.map(c => {
                const disabled = chainSelectorTarget === 'from' 
                  ? c.chainId === toChain.chainId 
                  : c.chainId === fromChain.chainId
                const isSelected = chainSelectorTarget === 'from'
                  ? c.chainId === fromChain.chainId
                  : c.chainId === toChain.chainId

                return (
                  <button
                    key={c.chainId}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (chainSelectorTarget === 'from') {
                        setFromChain(c)
                        if (switchChainAsync) switchChainAsync({ chainId: c.chainId }).catch(console.error)
                      } else {
                        setToChain(c)
                      }
                      setChainSelectorTarget(null)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: isSelected ? 'rgba(16, 53, 246, 0.08)' : 'var(--surface-raised)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ChainLogo chain={c} size={24} />
                      <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {balanceMap[c.chainId] || '0.0000'} USDC
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Transferring / Claim Modal (Screenshot 2) */}
      {showTransferModal && activeTransfer && (
        <TransferProgressModal
          transfer={activeTransfer}
          fromChain={getCctpConfig(activeTransfer.sourceChainId)}
          toChain={getCctpConfig(activeTransfer.destinationChainId)}
          activeChainId={activeChainId}
          onSwitchChain={switchChainAsync}
          onClaim={handleClaim}
          onClose={() => setShowTransferModal(false)}
        />
      )}

      {/* Manually Claim Modal */}
      {showManualClaimModal && (
        <ManuallyClaimModal
          onClose={() => setShowManualClaimModal(false)}
          connectedAddress={address}
          activeChainId={activeChainId}
          onSwitchChain={switchChainAsync}
          onClaimSuccess={() => {
            if (address) loadBalances(address)
          }}
        />
      )}

    </PageLayout>
  )
}

// ----------------------------------------------------
// Subcomponents
// ----------------------------------------------------

function TransferProgressModal({
  transfer,
  fromChain,
  toChain,
  activeChainId,
  onSwitchChain,
  onClaim,
  onClose,
}: {
  transfer: InFlightTransfer
  fromChain: CctpChainConfig
  toChain: CctpChainConfig
  activeChainId?: number
  onSwitchChain: (args: { chainId: number }) => Promise<any>
  onClaim: () => Promise<void>
  onClose: () => void
}) {
  const [claiming, setClaiming] = useState(false)
  const isReceived = transfer.status === 'attestation_received' || transfer.status === 'destination_pending' || transfer.status === 'complete'
  const isComplete = transfer.status === 'complete'
  const isPendingAttestation = transfer.status === 'attestation_pending'
  const isWrongChainForClaim = activeChainId !== toChain.chainId

  const handleActionClick = async () => {
    if (isWrongChainForClaim) {
      await onSwitchChain({ chainId: toChain.chainId })
    } else {
      setClaiming(true)
      try {
        await onClaim()
      } finally {
        setClaiming(false)
      }
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: '#f4f6fa',
        color: '#111827',
        border: '1px solid #e5e7eb',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        padding: '32px 28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        textAlign: 'center'
      }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {/* Title: Transferring {amount} [USDC] to {toChain} [Logo] */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: 800,
          color: '#111827',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '28px',
          letterSpacing: '-0.02em'
        }}>
          Transferring <span style={{ fontWeight: 900 }}>{transfer.amount}</span>
          <UsdcIcon size={24} />
          to {toChain.name}
          <ChainLogo chain={toChain} size={24} />
        </h2>

        {/* Center Animated Bridge Icon Graphic (from Screenshot 2) */}
        <div style={{
          width: '120px',
          height: '120px',
          margin: '0 auto 24px auto',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Subtle glowing backdrop circle */}
          <div style={{
            position: 'absolute',
            inset: '6px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.12)',
          }} />

          {/* Animated Circular Progress Ring */}
          {!isComplete && (
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                animation: 'spin 3s linear infinite'
              }}
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="4"
                strokeDasharray="90 180"
                strokeLinecap="round"
              />
            </svg>
          )}

          {/* Inner icon */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isComplete ? (
              <CheckCircle2 size={48} color="#10b981" />
            ) : (
              <BridgeIcon size={46} color="#3b82f6" />
            )}
          </div>
        </div>

        {/* Explanatory Subtitle */}
        <p style={{
          color: '#4b5563',
          fontSize: '14px',
          lineHeight: '1.5',
          maxWidth: '320px',
          margin: '0 auto 20px auto'
        }}>
          {isComplete 
            ? 'Your USDC has been successfully minted to your wallet on ' + toChain.name + '!'
            : 'Claim your USDC on ' + toChain.name + ' once available to complete the transfer.'}
        </p>

        {/* Status Pill (Exactly like Screenshot 2: Status [Received]) */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '26px',
          fontSize: '13px',
          fontWeight: 700,
          color: '#374151'
        }}>
          <span>Status</span>
          <span style={{
            background: isComplete 
              ? '#10b981' 
              : isReceived 
              ? '#1f242f' 
              : 'rgba(59, 130, 246, 0.15)',
            color: isComplete || isReceived ? '#ffffff' : '#2563eb',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 800
          }}>
            {isComplete 
              ? 'Complete' 
              : isReceived 
              ? 'Received' 
              : isPendingAttestation 
              ? 'Attestation Pending' 
              : 'Burning...'}
          </span>
        </div>

        {/* Action Button (Screenshot 2: "Connect to Base" or "Claim USDC") */}
        {isComplete ? (
          <div>
            {transfer.destinationTxHash && (
              <a
                href={`${toChain.explorerUrl}/tx/${transfer.destinationTxHash}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#2563eb',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  marginBottom: '16px'
                }}
              >
                View on {toChain.name} Explorer <ExternalLink size={13} />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                background: '#1f242f',
                border: 'none',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!isReceived || claiming}
            onClick={handleActionClick}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              background: !isReceived 
                ? '#9ca3af' 
                : '#1f242f',
              border: 'none',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 800,
              cursor: !isReceived || claiming ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isReceived ? '0 4px 12px rgba(0, 0, 0, 0.2)' : 'none'
            }}
          >
            {claiming && <Loader2 size={18} className="animate-spin" />}
            {!isReceived 
              ? 'Waiting for Circle Attestation...' 
              : isWrongChainForClaim 
              ? `Connect to ${toChain.name}` 
              : `Claim ${transfer.amount} USDC`}
          </button>
        )}

      </div>
    </div>
  )
}

function ManuallyClaimModal({
  onClose,
  connectedAddress,
  activeChainId,
  onSwitchChain,
  onClaimSuccess,
}: {
  onClose: () => void
  connectedAddress?: string
  activeChainId?: number
  onSwitchChain: (args: { chainId: number }) => Promise<any>
  onClaimSuccess: () => void
}) {
  const [hashInput, setHashInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimData, setClaimData] = useState<{
    sourceChain: CctpChainConfig
    destinationChain: CctpChainConfig
    amount: string
    cctpMessage: `0x${string}`
    attestation: string
    alreadyClaimed: boolean
  } | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimedTx, setClaimedTx] = useState<string | null>(null)

  const { writeContractAsync: writeReceive } = useWriteContract()

  // Pre-load known transfer (e.g. from local storage)
  const [storedPendingTxs, setStoredPendingTxs] = useState<any[]>([])

  useEffect(() => {
    if (!connectedAddress) return
    try {
      const raw = localStorage.getItem(`easyzpay_local_txs_${connectedAddress.toLowerCase()}`) || '[]'
      const list = JSON.parse(raw)
      const pendings = list.filter((t: any) => t.type === 'CROSS_PAY' && t.status !== 'COMPLETED' && t.txHash)
      setStoredPendingTxs(pendings)
    } catch {}
  }, [connectedAddress])

  const handleSearch = async (hashToSearch?: string) => {
    const hash = (hashToSearch || hashInput).trim()
    setError(null)
    setClaimData(null)
    setClaimedTx(null)

    if (!hash.startsWith('0x') || hash.length !== 66) {
      setError('Please provide a valid 66-character EVM transaction hash starting with 0x.')
      return
    }

    setSearching(true)

    try {
      // 1. Fetch receipt from Arc Mainnet (Domain 26)
      let sourceCfg = CCTP_V2_CONFIGS[5042] || SUPPORTED_CHAINS[0]
      let receipt: any = null

      try {
        const client = createPublicClient({ transport: http(sourceCfg.rpcUrl) })
        receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` })
      } catch {
        // Fallback to checking other supported chains
        for (const cfg of SUPPORTED_CHAINS) {
          if (cfg.chainId === sourceCfg.chainId) continue
          try {
            const client = createPublicClient({ transport: http(cfg.rpcUrl) })
            const r = await client.getTransactionReceipt({ hash: hash as `0x${string}` })
            if (r) {
              receipt = r
              sourceCfg = cfg
              break
            }
          } catch {}
        }
      }

      if (!receipt) {
        throw new Error('Transaction receipt not found on Arc Mainnet or supported chains.')
      }

      // 2. Decode MessageSent
      let rawMsg: `0x${string}` | null = null
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: MESSAGE_TRANSMITTER_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'MessageSent' && decoded.args?.message) {
            rawMsg = decoded.args.message as `0x${string}`
            break
          }
        } catch {}
      }

      if (!rawMsg) {
        throw new Error('No CCTP MessageSent event found in this transaction.')
      }

      // 3. Parse destination domain and amount
      const dstDomain = parseInt(rawMsg.slice(18, 26), 16)
      const destCfg = SUPPORTED_CHAINS.find(c => c.domain === dstDomain) || CCTP_V2_CONFIGS[8453]

      let parsedAmount = '0.1'
      for (const log of receipt.logs) {
        if (log.topics[0] === '0x0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5') {
          const dataHex = log.data.replace('0x', '')
          if (dataHex.length >= 64) {
            const amtUnits = BigInt('0x' + dataHex.slice(0, 64))
            parsedAmount = (Number(amtUnits) / Math.pow(10, sourceCfg.decimals)).toString()
          }
          break
        }
      }

      // 4. Fetch Iris attestation
      let attestation: string | null = null
      try {
        const res = await fetch('/api/cctp/attestation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceDomainId: sourceCfg.domain, transactionHash: hash }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'complete' && data.attestation) {
            attestation = data.attestation
          }
        }
      } catch {}

      if (!attestation) {
        try {
          const irisRes = await fetch(`https://iris-api.circle.com/v2/messages/${sourceCfg.domain}?transactionHash=${hash}`)
          if (irisRes.ok) {
            const irisJson = await irisRes.json()
            if (irisJson.messages?.[0]?.status === 'complete' && irisJson.messages[0].attestation) {
              attestation = irisJson.messages[0].attestation
            }
          }
        } catch {}
      }

      if (!attestation) {
        throw new Error('Circle Iris API has not signed this attestation yet. Please wait a few moments and try again.')
      }

      // 5. Check if already claimed on destination
      let alreadyClaimed = false
      try {
        const destClient = createPublicClient({ transport: http(destCfg.rpcUrl) })
        await destClient.call({
          to: destCfg.messageTransmitter,
          data: encodeFunctionData({
            abi: MESSAGE_TRANSMITTER_ABI,
            functionName: 'receiveMessage',
            args: [rawMsg, attestation as `0x${string}`],
          }),
          account: (connectedAddress || '0xd2d5e4309fa480cc88c73cf66184c751cfd0adab') as `0x${string}`,
        })
      } catch (simErr: any) {
        const m = simErr.message || ''
        if (m.includes('Nonce already used') || m.includes('execution reverted')) {
          alreadyClaimed = true
        }
      }

      setClaimData({
        sourceChain: sourceCfg,
        destinationChain: destCfg,
        amount: parsedAmount,
        cctpMessage: rawMsg,
        attestation,
        alreadyClaimed,
      })
    } catch (err: any) {
      console.error('Manual claim search error:', err)
      setError(err.message || 'Failed to inspect transaction hash.')
    } finally {
      setSearching(false)
    }
  }

  const handleManualClaim = async () => {
    if (!claimData) return
    setClaiming(true)
    setError(null)

    try {
      if (activeChainId !== claimData.destinationChain.chainId) {
        await onSwitchChain({ chainId: claimData.destinationChain.chainId })
      }

      const tx = await writeReceive({
        address: claimData.destinationChain.messageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [
          claimData.cctpMessage,
          claimData.attestation as `0x${string}`,
        ],
        chainId: claimData.destinationChain.chainId,
      })

      const destClient = createPublicClient({ transport: http(claimData.destinationChain.rpcUrl) })
      await destClient.waitForTransactionReceipt({ hash: tx })

      setClaimedTx(tx)
      setClaimData(prev => prev ? { ...prev, alreadyClaimed: true } : null)
      onClaimSuccess()

      if (connectedAddress) {
        localStorage.removeItem(`cctp_transfer_${connectedAddress.toLowerCase()}`)
      }
    } catch (err: any) {
      console.error('Claim execute error:', err)
      setError(err.message?.slice(0, 140) || 'Failed to complete destination transaction.')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: '#f4f6fa',
        color: '#111827',
        border: '1px solid #e5e7eb',
        borderRadius: '24px',
        maxWidth: '460px',
        width: '100%',
        padding: '28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
            Manually Claim
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ color: '#4b5563', fontSize: '13px', lineHeight: '1.4', marginBottom: '18px' }}>
          Enter your transaction hash from the source chain to check attestation and claim USDC.
        </p>

        {/* Pending Local Transactions Shortcuts */}
        {storedPendingTxs.length > 0 && !claimData && (
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Pending In-Flight Transfers
            </span>
            {storedPendingTxs.map((t: any) => (
              <button
                key={t.txHash}
                type="button"
                onClick={() => {
                  setHashInput(t.txHash)
                  handleSearch(t.txHash)
                }}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  marginBottom: '6px',
                  textAlign: 'left'
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                    {t.amount} USDC
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#6b7280', marginLeft: '6px' }}>
                    ({t.txHash.slice(0, 8)}...{t.txHash.slice(-6)})
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700 }}>
                  Load & Claim →
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Input & Search */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="0x..."
            value={hashInput}
            onChange={e => setHashInput(e.target.value)}
            style={{
              flex: 1,
              background: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '14px',
              padding: '12px 14px',
              fontSize: '13.5px',
              fontFamily: 'monospace',
              color: '#111827',
              outline: 'none'
            }}
          />
          <button
            type="button"
            disabled={searching || !hashInput.trim()}
            onClick={() => handleSearch()}
            style={{
              background: '#1f242f',
              border: 'none',
              borderRadius: '14px',
              padding: '12px 18px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: searching || !hashInput.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px',
            padding: '12px',
            color: '#dc2626',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* Claim Data Summary Card */}
        {claimData && (
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            padding: '18px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>Amount:</span>
              <span style={{ fontSize: '16px', fontWeight: 900, color: '#111827' }}>
                {claimData.amount} USDC
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>Route:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ChainLogo chain={claimData.sourceChain} size={16} /> {claimData.sourceChain.name}
                <span>→</span>
                <ChainLogo chain={claimData.destinationChain} size={16} /> {claimData.destinationChain.name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>Circle Attestation:</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                Signed & Ready ✓
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>Status:</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: claimData.alreadyClaimed ? '#10b981' : '#2563eb' }}>
                {claimData.alreadyClaimed ? 'Already Claimed ✓' : 'Ready to Claim'}
              </span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {claimData && (
          claimData.alreadyClaimed ? (
            <div>
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: '12px'
              }}>
                This USDC has already been claimed on {claimData.destinationChain.name}!
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  background: '#1f242f',
                  border: 'none',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={claiming}
              onClick={handleManualClaim}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                background: '#1f242f',
                border: 'none',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 800,
                cursor: claiming ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {claiming && <Loader2 size={18} className="animate-spin" />}
              {activeChainId !== claimData.destinationChain.chainId
                ? `Connect to ${claimData.destinationChain.name}`
                : `Claim ${claimData.amount} USDC on ${claimData.destinationChain.name}`}
            </button>
          )
        )}

        {claimedTx && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              🎉 Successfully claimed on {claimData?.destinationChain.name}!
            </span>
            <a
              href={`${claimData?.destinationChain.explorerUrl}/tx/${claimedTx}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2563eb', fontSize: '12.5px', fontWeight: 700, textDecoration: 'none' }}
            >
              View on Explorer <ExternalLink size={12} style={{ display: 'inline' }} />
            </a>
          </div>
        )}

      </div>
    </div>
  )
}

function ChainLogo({ chain, size = 20 }: { chain: CctpChainConfig; size?: number }) {
  const [imgError, setImgError] = useState(false)

  if (chain.chainId === 5042 || chain.chainId === 5042002) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(16, 53, 246, 0.3)'
      }}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
          <path d="M4 19A8 8 0 0 1 20 19" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    )
  }

  if (chain.logoUrl && !imgError) {
    return (
      <img
        src={chain.logoUrl}
        alt={chain.name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: chain.color, flexShrink: 0, display: 'inline-block' }} />
  )
}

function UsdcIcon({ size = 20 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: '#2775ca',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: size * 0.55,
      fontWeight: 900,
      flexShrink: 0
    }}>
      $
    </div>
  )
}

function BridgeIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" />
      <path d="M4 15a8 8 0 0 1 16 0" />
      <line x1="8" y1="7" x2="8" y2="19" />
      <line x1="16" y1="7" x2="16" y2="19" />
    </svg>
  )
}
