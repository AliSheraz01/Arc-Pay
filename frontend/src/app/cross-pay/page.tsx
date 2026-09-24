'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { MdSend, MdHistory, MdHealing, MdArrowBack, MdSearch, MdErrorOutline, MdCheckCircle, MdOpenInNew, MdContentCopy, MdAccessTime, MdInfoOutline } from 'react-icons/md'
import { ChevronDown, RefreshCw, ArrowUpDown, Check, Wallet, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useAccount, useSwitchChain, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient, useGasPrice } from 'wagmi'
import { parseUnits, isAddress, createPublicClient, http, decodeEventLog, keccak256, formatEther, encodeAbiParameters, parseAbiParameters } from 'viem'
import { 
  CCTP_V2_CONFIGS, 
  getCctpConfig, 
  getCctpDomain, 
  addressToBytes32, 
  BACKEND_URL, 
  REGISTRY_ADDRESS, 
  EXPLORER_URL,
  CctpChainConfig,
  IS_PRODUCTION
} from '@/lib/constants'
import { REGISTRY_ABI, USDC_ABI, TOKEN_MESSENGER_ABI, MESSAGE_TRANSMITTER_ABI } from '@/lib/abi'

// Supported CCTP V2 Networks
const SUPPORTED_CHAINS = Object.values(CCTP_V2_CONFIGS)

type BridgeStatus = 
  | 'idle'
  | 'validating'
  | 'approving'
  | 'burning'
  | 'source_pending'
  | 'source_confirmed'
  | 'attestation_pending'
  | 'attestation_received'
  | 'destination_pending'
  | 'complete'
  | 'error'

interface InFlightCrossPay {
  id?: string
  sourceChainId: number
  destinationChainId: number
  amount: string
  recipientInput: string
  recipientAddress: string
  sourceTxHash?: `0x${string}`
  cctpMessage?: `0x${string}`
  messageHash?: `0x${string}`
  attestationBytes?: string
  destinationTxHash?: `0x${string}`
  status: BridgeStatus
  errorReason?: string
}

export default function CrossPayPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send')
  const { isConnected, address } = useAccount()

  if (!isConnected) {
    return (
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to use Cross Pay.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '0 16px' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>

        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '24px', 
          padding: '28px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Cross Pay</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Move native USDC between Arc and supported networks via Circle CCTP V2.</p>
            </div>
            <span style={{
              background: 'rgba(16, 53, 246, 0.1)',
              color: 'var(--accent)',
              border: '1px solid var(--border-accent)',
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '12px',
              letterSpacing: '0.04em'
            }}>
              CIRCLE CCTP V2
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', margin: '24px 0 28px 0', background: 'var(--surface-raised)', padding: '6px', borderRadius: '16px' }}>
            <button
              onClick={() => setActiveTab('send')}
              style={{
                flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: activeTab === 'send' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'send' ? '#fff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <MdSend size={18} /> Bridge & Send
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: activeTab === 'history' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'history' ? '#fff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <MdHistory size={18} /> Transfer History
            </button>
          </div>

          {activeTab === 'send' && <CctpTransferEngine />}
          {activeTab === 'history' && <CctpHistoryTab address={address} />}
        </div>
      </main>
    </PageLayout>
  )
}

function CctpTransferEngine() {
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient()

  // Source and Destination chains dynamically defaulted based on environment
  const chainList = Object.values(CCTP_V2_CONFIGS)
  const defaultFrom = IS_PRODUCTION ? (CCTP_V2_CONFIGS[8453] || chainList[1] || chainList[0]) : (CCTP_V2_CONFIGS[84532] || chainList[0])
  const defaultTo = IS_PRODUCTION ? (CCTP_V2_CONFIGS[5042] || chainList[0]) : (CCTP_V2_CONFIGS[5042002] || chainList[0])

  const [fromChain, setFromChain] = useState<CctpChainConfig>(defaultFrom)
  const [toChain, setToChain] = useState<CctpChainConfig>(defaultTo)

  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null)
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  // Balances
  const [balanceMap, setBalanceMap] = useState<Record<number, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [spinning, setSpinning] = useState(false)

  // State Machine & Modal
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [transferState, setTransferState] = useState<InFlightCrossPay | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { writeContractAsync: writeApprove } = useWriteContract()
  const { writeContractAsync: writeDeposit } = useWriteContract()
  const { writeContractAsync: writeReceiveMessage } = useWriteContract()

  // Read current allowance on source chain
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
          const client = createPublicClient({
            transport: http(c.rpcUrl),
          })
          const bal = await client.readContract({
            address: c.usdc,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [addr as `0x${string}`],
          })
          const formatted = (Number(bal) / Math.pow(10, c.decimals)).toFixed(2)
          map[c.chainId] = formatted
        } catch {
          map[c.chainId] = '0.00'
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
  }, [address, loadBalances, transferState?.status])

  // Restore in-flight transfer on mount from backend/localStorage
  useEffect(() => {
    const checkActiveTransfer = async () => {
      if (!address) return
      try {
        const res = await fetch(`${BACKEND_URL}/api/crosspay/active/${address}`)
        if (res.ok) {
          const data = await res.json()
          if (data.activeTx) {
            const tx = data.activeTx
            setTransferState({
              id: tx.id,
              sourceChainId: tx.sourceChain,
              destinationChainId: tx.destinationChain,
              amount: tx.amount,
              recipientInput: tx.recipientUsername || tx.recipientAddress,
              recipientAddress: tx.recipientAddress,
              sourceTxHash: tx.sourceTxHash as `0x${string}`,
              destinationTxHash: tx.destinationTxHash as `0x${string}`,
              cctpMessage: tx.cctpMessageId as `0x${string}`,
              attestationBytes: tx.attestationBytes,
              status: tx.status as BridgeStatus,
              errorReason: tx.errorReason,
            })
            return
          }
        }
      } catch (err) {
        console.warn('Could not restore from backend, checking localStorage', err)
      }

      const saved = localStorage.getItem(`cctp_tx_${address?.toLowerCase()}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setTransferState(parsed)
        } catch {}
      }
    }
    checkActiveTransfer()
  }, [address])

  // Sync transfer state to localStorage and backend
  useEffect(() => {
    if (!address || !transferState) return
    localStorage.setItem(`cctp_tx_${address.toLowerCase()}`, JSON.stringify(transferState))

    if (transferState.id) {
      fetch(`${BACKEND_URL}/api/crosspay/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transferState.id,
          status: transferState.status,
          sourceTxHash: transferState.sourceTxHash,
          destinationTxHash: transferState.destinationTxHash,
          cctpMessageId: transferState.cctpMessage,
          attestationStatus: transferState.attestationBytes ? 'complete' : 'pending',
          attestationBytes: transferState.attestationBytes,
          errorReason: transferState.errorReason,
        }),
      }).catch(err => console.warn('Failed to sync state to backend:', err))
    }
  }, [transferState, address])

  // Resolve Recipient (@username, x/@username, or 0x address)
  const resolveRecipient = useCallback(async (val: string) => {
    setResolveError(null)
    setResolvedAddress(null)
    setResolvedName(null)
    if (!val) return

    const clean = val.trim()

    // 1. Direct EVM address
    if (isAddress(clean)) {
      setResolvedAddress(clean as `0x${string}`)
      setResolvedName(`${clean.slice(0, 6)}...${clean.slice(-4)}`)
      return
    }

    setResolving(true)

    // 2. X username (e.g. x/@username or @x:username)
    if (clean.startsWith('x/') || clean.startsWith('x:@')) {
      const xHandle = clean.replace(/^x\//, '').replace(/^x:@/, '').replace('@', '').toLowerCase()
      try {
        const res = await fetch(`${BACKEND_URL}/api/resolve/x/${xHandle}`)
        const data = await res.json()
        if (res.ok && data.connected && data.address) {
          setResolvedAddress(data.address as `0x${string}`)
          setResolvedName(`X: @${data.username} (${data.displayName})`)
          return
        }
        setResolveError(`X user "@${xHandle}" hasn't connected EasyZPay yet.`)
      } catch {
        setResolveError(`Could not resolve X user "@${xHandle}".`)
      } finally {
        setResolving(false)
      }
      return
    }

    // 3. EasyZPay username
    const username = clean.replace('@', '').toLowerCase()
    try {
      const res = await fetch(`${BACKEND_URL}/api/resolve/${username}`)
      if (res.ok) {
        const data = await res.json()
        if (data.address) {
          setResolvedAddress(data.address as `0x${string}`)
          setResolvedName(`@${username}`)
          return
        }
      }
      // Check X fallback
      const xRes = await fetch(`${BACKEND_URL}/api/resolve/x/${username}`)
      if (xRes.ok) {
        const xData = await xRes.json()
        if (xData.connected && xData.address) {
          setResolvedAddress(xData.address as `0x${string}`)
          setResolvedName(`X: @${xData.username}`)
          return
        }
      }
      setResolveError(`Could not find EasyZPay user "@${username}"`)
    } catch {
      setResolveError(`Could not resolve recipient "${val}"`)
    } finally {
      setResolving(false)
    }
  }, [])

  // Swap chains
  const handleSwapChains = () => {
    const temp = fromChain
    setFromChain(toChain)
    setToChain(temp)
  }

  // Pre-flight check before review
  const handleOpenReview = () => {
    setErrorMessage(null)
    const targetAddr = resolvedAddress || (recipient.trim() === '' ? address : null)

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid USDC amount greater than 0.')
      return
    }

    if (!targetAddr) {
      setErrorMessage('Please provide a valid recipient username or wallet address.')
      return
    }

    const currentBal = parseFloat(balanceMap[fromChain.chainId] || '0')
    if (parseFloat(amount) > currentBal) {
      setErrorMessage(`Insufficient USDC balance on ${fromChain.name}. You have ${currentBal} USDC.`)
      return
    }

    setShowReviewModal(true)
  }

  // Execute CCTP V2 Flow
  const handleExecuteBridge = async () => {
    setShowReviewModal(false)
    setErrorMessage(null)

    const targetAddr = resolvedAddress || (recipient.trim() === '' ? (address as `0x${string}`) : null)
    if (!targetAddr || !address) return

    const parsedAmount = parseUnits(amount, fromChain.decimals)
    const idempotencyKey = `cctp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Step 1: Create backend record
    let crossPayId: string | undefined
    try {
      const createRes = await fetch(`${BACKEND_URL}/api/crosspay/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: fromChain.chainId,
          destinationChain: toChain.chainId,
          amount,
          senderAddress: address,
          recipientAddress: targetAddr,
          recipientUsername: resolvedName || recipient,
          idempotencyKey,
        }),
      })
      const createData = await createRes.json()
      if (createData.crossPay) {
        crossPayId = createData.crossPay.id
      }
    } catch (err) {
      console.warn('Backend creation failed, proceeding with client-side state machine:', err)
    }

    const currentTransfer: InFlightCrossPay = {
      id: crossPayId,
      sourceChainId: fromChain.chainId,
      destinationChainId: toChain.chainId,
      amount,
      recipientInput: resolvedName || recipient || address,
      recipientAddress: targetAddr,
      status: 'validating',
    }
    setTransferState(currentTransfer)

    try {
      // 1. Ensure connected to source chain
      if (activeChainId !== fromChain.chainId) {
        setTransferState(prev => prev ? { ...prev, status: 'validating' } : null)
        await switchChainAsync({ chainId: fromChain.chainId })
      }

      // 2. Approve TokenMessenger if necessary
      const reqAllowance = parsedAmount
      if (allowance === undefined || (allowance as bigint) < reqAllowance) {
        setTransferState(prev => prev ? { ...prev, status: 'approving' } : null)
        const approveTx = await writeApprove({
          address: fromChain.usdc,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [fromChain.tokenMessenger, reqAllowance],
        })
        
        // Wait for approval confirmation
        const client = createPublicClient({ transport: http(fromChain.rpcUrl) })
        await client.waitForTransactionReceipt({ hash: approveTx })
        await refetchAllowance()
      }

      // 3. Deposit for Burn on Source Chain (Official CCTP V2)
      setTransferState(prev => prev ? { ...prev, status: 'burning' } : null)
      const mintRecipientBytes32 = addressToBytes32(targetAddr)
      const destinationDomain = toChain.domain

      const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

      const burnTxHash = await writeDeposit({
        address: fromChain.tokenMessenger,
        abi: TOKEN_MESSENGER_ABI,
        functionName: 'depositForBurn',
        args: [
          parsedAmount,
          destinationDomain,
          mintRecipientBytes32,
          fromChain.usdc,
          ZERO_BYTES32,     // destinationCaller: 0x0 = anyone can call receiveMessage
          0n,               // maxFee: 0 = Standard Transfer
          2000,             // minFinalityThreshold: 2000 = Standard Transfer (finalized)
        ],
      })

      setTransferState(prev => prev ? { 
        ...prev, 
        sourceTxHash: burnTxHash, 
        status: 'source_pending' 
      } : null)

      // 4. Wait for Source Receipt and extract CCTP Message Bytes
      const sourceClient = createPublicClient({ transport: http(fromChain.rpcUrl) })
      const sourceReceipt = await sourceClient.waitForTransactionReceipt({ hash: burnTxHash })

      setTransferState(prev => prev ? { ...prev, status: 'source_confirmed' } : null)

      // Find MessageSent log from MessageTransmitter on source chain
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

      // If message was emitted, calculate messageHash = keccak256(rawMessage)
      let msgHash: `0x${string}` | null = null
      if (rawMessage) {
        msgHash = keccak256(rawMessage)
      } else {
        // Fallback to tx hash
        msgHash = burnTxHash
      }

      setTransferState(prev => prev ? { 
        ...prev, 
        cctpMessage: rawMessage || undefined,
        messageHash: msgHash || undefined,
        status: 'attestation_pending' 
      } : null)

      // 5. Poll Circle Iris Attestation API via backend (CCTP V2)
      pollCircleAttestation(fromChain.domain, burnTxHash, rawMessage, currentTransfer)
    } catch (err: any) {
      console.error('CCTP Execution error:', err)
      const reason = err.message?.slice(0, 120) || 'Transaction failed'
      setErrorMessage(reason)
      setTransferState(prev => prev ? { ...prev, status: 'error', errorReason: reason } : null)
    }
  }

  // Poll Circle Attestation until status === 'complete'
  const pollCircleAttestation = async (
    sourceDomainId: number,
    txHash: `0x${string}`,
    rawMessageFallback: `0x${string}` | null,
    baseTransfer: InFlightCrossPay
  ) => {
    let attempts = 0
    const maxAttempts = 120

    const checkInterval = setInterval(async () => {
      attempts++
      try {
        const res = await fetch(`${BACKEND_URL}/api/cctp/attestation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceDomainId, transactionHash: txHash }),
        })
        const data = await res.json()

        if (data.status === 'complete' && data.attestation) {
          clearInterval(checkInterval)
          setTransferState(prev => prev ? {
            ...prev,
            cctpMessage: (data.message as `0x${string}`) || rawMessageFallback || prev.cctpMessage,
            attestationBytes: data.attestation,
            status: 'attestation_received'
          } : null)
        }

        if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          setTransferState(prev => prev ? {
            ...prev,
            status: 'error',
            errorReason: 'Circle attestation polling timed out. Please check Iris API status.'
          } : null)
        }
      } catch (e) {
        console.error('Attestation polling error:', e)
      }
    }, 6000)
  }

  // Complete Destination Mint / Receive
  const handleClaimDestination = async () => {
    if (!transferState || !transferState.cctpMessage || !transferState.attestationBytes) return

    setErrorMessage(null)
    setTransferState(prev => prev ? { ...prev, status: 'destination_pending' } : null)

    try {
      // 1. Switch to Destination Chain
      if (activeChainId !== toChain.chainId) {
        await switchChainAsync({ chainId: toChain.chainId })
      }

      // 2. Call receiveMessage on Destination MessageTransmitter
      const destTxHash = await writeReceiveMessage({
        address: toChain.messageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [
          transferState.cctpMessage as `0x${string}`,
          transferState.attestationBytes as `0x${string}`,
        ],
      })

      // 3. Wait for confirmation on destination chain
      const destClient = createPublicClient({ transport: http(toChain.rpcUrl) })
      await destClient.waitForTransactionReceipt({ hash: destTxHash })

      setTransferState(prev => prev ? {
        ...prev,
        destinationTxHash: destTxHash,
        status: 'complete',
      } : null)

      // Refresh balances
      if (address) loadBalances(address)
    } catch (err: any) {
      console.error('Destination receiveMessage failed:', err)
      const reason = err.message?.slice(0, 120) || 'Failed to complete destination transaction.'
      setErrorMessage(reason)
      setTransferState(prev => prev ? { ...prev, status: 'error', errorReason: reason } : null)
    }
  }

  // Reset to create another transfer
  const handleReset = () => {
    if (address) localStorage.removeItem(`cctp_tx_${address.toLowerCase()}`)
    setTransferState(null)
    setAmount('')
    setRecipient('')
    setResolvedAddress(null)
    setResolvedName(null)
    setErrorMessage(null)
  }

  const handleFromChainChange = (c: CctpChainConfig) => {
    setFromChain(c)
    setResolveError(null)
    if (switchChainAsync) {
      try {
        switchChainAsync({ chainId: c.chainId })
      } catch (err: any) {
        console.error(err)
      }
    }
  }

  const refresh = () => {
    setSpinning(true)
    if (address) loadBalances(address)
    setTimeout(() => setSpinning(false), 500)
  }

  const swapDirection = () => {
    const temp = fromChain
    setFromChain(toChain)
    setToChain(temp)
    if (switchChainAsync) {
      switchChainAsync({ chainId: toChain.chainId }).catch(console.error)
    }
  }

  const handleMax = () => {
    const bal = balanceMap[fromChain.chainId]
    if (bal && bal !== "—") setAmount(bal)
  }

  const walletOnCorrectChain = activeChainId === fromChain.chainId

  return (
    <div className="bridge-layout">
      <div className="panel-box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: '16px' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Cross-chain transfers</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last updated: Just now</span>
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh Balances"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: 'all 0.2s' }}
            >
              <RefreshCw size={14} color="var(--text-secondary)" style={{ animation: spinning ? "spin 0.5s linear" : "none" }} />
            </button>
          </div>
        </div>

        <Panel
          label="From"
          chain={fromChain}
          onChainChange={handleFromChainChange}
          disabledId={toChain.chainId}
          amount={amount}
          onAmountChange={setAmount}
          balanceMap={balanceMap}
          loadingBalances={loadingBalances}
          onMax={handleMax}
        />

        <div style={{ display: 'flex', justifyContent: 'center', margin: '-14px 0', position: 'relative', zIndex: 5 }}>
          <button
            type="button"
            onClick={swapDirection}
            aria-label="Swap direction"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
          >
            <ArrowUpDown size={15} color="var(--text-secondary)" />
          </button>
        </div>

        <Panel
          label="To"
          chain={toChain}
          onChainChange={setToChain}
          disabledId={fromChain.chainId}
          amount={amount}
          readOnly
          balanceMap={balanceMap}
          loadingBalances={loadingBalances}
        />

        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Recipient (@username or Address)</label>
          <input 
            type="text" 
            placeholder="@alisheraz0ev or 0x... (Default: Your address)" 
            value={recipient}
            onChange={e => {
              setRecipient(e.target.value)
              resolveRecipient(e.target.value)
            }}
            style={{ width: '100%', padding: '16px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none' }}
          />
          {resolving && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><MdSearch /> Resolving username...</div>}
          {resolveError && <div style={{ fontSize: '12px', color: '#ff4466', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><MdErrorOutline /> {resolveError}</div>}
          {resolvedAddress && !resolving && !resolveError && recipient !== resolvedAddress && (
            <div style={{ fontSize: '12px', color: 'var(--green)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MdCheckCircle /> Resolved: {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
            </div>
          )}
        </div>

        {errorMessage && (
          <div style={{ fontSize: '12px', color: '#ff4466', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MdErrorOutline /> {errorMessage}
          </div>
        )}

        <button
          onClick={handleOpenReview}
          disabled={!amount || parseFloat(amount) <= 0 || !!resolveError}
          style={{
            width: '100%',
            marginTop: '20px',
            background: amount && parseFloat(amount) > 0 && !resolveError ? 'linear-gradient(135deg, #1035f6, #3b82f6)' : 'var(--border)',
            border: 'none', borderRadius: '14px', padding: '16px',
            color: amount && parseFloat(amount) > 0 && !resolveError ? 'white' : 'var(--text-secondary)',
            fontSize: '15px', fontWeight: 800,
            cursor: amount && parseFloat(amount) > 0 && !resolveError ? 'pointer' : 'not-allowed',
          }}
        >
          Review Transfer
        </button>
      </div>

      {/* Confirmation Modal */}
      {showReviewModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '24px', padding: '28px', maxWidth: '460px', width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Review Cross-Chain Transfer
            </h3>

            <div style={{ background: 'var(--surface-raised)', borderRadius: '16px', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)' }}>
                {parseFloat(amount).toFixed(2)}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent)', marginLeft: '6px' }}>USDC</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px', textAlign: 'left', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>From</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fromChain.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>To</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{toChain.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Recipient</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                    {resolvedName || recipient || `${address?.slice(0, 8)}...${address?.slice(-6)}`}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '14px', color: 'var(--text-primary)',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBridge}
                style={{
                  flex: 1, background: 'linear-gradient(135deg, #1035f6, #3b82f6)',
                  border: 'none', borderRadius: '12px', padding: '14px',
                  color: 'white', fontSize: '14px', fontWeight: 800, cursor: 'pointer',
                }}
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Panel({
  label,
  chain,
  onChainChange,
  disabledId,
  amount,
  onAmountChange,
  readOnly = false,
  balanceMap,
  loadingBalances,
  onMax,
}: {
  label: string
  chain: CctpChainConfig
  onChainChange: (c: CctpChainConfig) => void
  disabledId: number
  amount: string
  onAmountChange?: (amt: string) => void
  readOnly?: boolean
  balanceMap: Record<number, string>
  loadingBalances: boolean
  onMax?: () => void
}) {
  const currentBal = balanceMap[chain.chainId] || '0.00'

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>Balance:</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {loadingBalances ? '...' : currentBal} USDC
          </span>
          {onMax && (
            <button
              type="button"
              onClick={onMax}
              style={{
                background: 'var(--accent-glow)',
                border: '1px solid var(--border-accent)',
                color: 'var(--accent)',
                fontSize: '11px',
                fontWeight: 800,
                borderRadius: '6px',
                padding: '2px 8px',
                cursor: 'pointer',
                marginLeft: '4px'
              }}
            >
              MAX
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={e => onAmountChange?.(e.target.value)}
            readOnly={readOnly}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              fontSize: '28px',
              fontWeight: 900,
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
        </div>
        <ChainDropdown
          selectedChain={chain}
          onSelect={onChainChange}
          disabledChainId={disabledId}
        />
      </div>
    </div>
  )
}

function ChainDropdown({
  selectedChain,
  onSelect,
  disabledChainId
}: {
  selectedChain: CctpChainConfig
  onSelect: (chain: CctpChainConfig) => void
  disabledChainId: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 14px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: selectedChain.color }} />
          <span style={{ fontSize: '14.5px', fontWeight: 700 }}>{selectedChain.name}</span>
        </span>
        <ChevronDown size={16} color="var(--text-secondary)" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '6px', zIndex: 50,
          boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
        }}>
          {SUPPORTED_CHAINS.map(chain => {
            const isSelected = chain.chainId === selectedChain.chainId
            const isDisabled = chain.chainId === disabledChainId
            return (
              <button
                key={chain.chainId}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  onSelect(chain)
                  setOpen(false)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isSelected ? 'var(--accent-glow)' : 'transparent',
                  border: 'none',
                  color: isDisabled ? 'var(--text-muted)' : isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: '13.5px',
                  fontWeight: isSelected ? 800 : 500,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.4 : 1,
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: chain.color }} />
                  <span>{chain.name}</span>
                </span>
                {isSelected && <Check size={14} color="var(--accent)" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CctpLiveProgressTracker({
  transfer,
  fromChain,
  toChain,
  onClaim,
  onReset,
  errorMessage,
  showTechDetails,
  setShowTechDetails,
}: {
  transfer: InFlightCrossPay
  fromChain: CctpChainConfig
  toChain: CctpChainConfig
  onClaim: () => void
  onReset: () => void
  errorMessage: string | null
  showTechDetails: boolean
  setShowTechDetails: (fn: (prev: boolean) => boolean) => void
}) {
  const isSourceComplete = [
    'source_confirmed',
    'attestation_pending',
    'attestation_received',
    'destination_pending',
    'complete'
  ].includes(transfer.status)

  const isAttestationComplete = [
    'attestation_received',
    'destination_pending',
    'complete'
  ].includes(transfer.status)

  const isDestinationComplete = transfer.status === 'complete'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ textAlign: 'center', padding: '12px 0 6px 0' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {isDestinationComplete ? 'Cross-Chain Transfer Complete!' : 'Moving Native USDC Across Chains'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {transfer.amount} USDC from {fromChain.name} to {toChain.name}
        </p>
      </div>

      {/* Progress Steps Timeline */}
      <div style={{ background: 'var(--surface-raised)', borderRadius: '18px', padding: '24px 20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Step 1: Source Burn */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: isSourceComplete ? 'rgba(0, 212, 168, 0.15)' : 'var(--accent-glow)',
            color: isSourceComplete ? 'var(--green)' : 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {isSourceComplete ? <Check size={16} /> : <Loader2 size={16} className="animate-spin" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: isSourceComplete ? 'var(--text-primary)' : 'var(--accent)' }}>
                {isSourceComplete ? 'Source Transaction Confirmed' : 'Submitting on ' + fromChain.name}
              </span>
              {transfer.sourceTxHash && (
                <a
                  href={`${fromChain.explorerUrl}/tx/${transfer.sourceTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  View Tx <MdOpenInNew size={12} />
                </a>
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              USDC deposited for burn on {fromChain.name} via CCTP TokenMessenger
            </p>
          </div>
        </div>

        {/* Step 2: Circle Attestation */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: isAttestationComplete ? 'rgba(0, 212, 168, 0.15)' : isSourceComplete ? 'var(--accent-glow)' : 'rgba(255,255,255,0.05)',
            color: isAttestationComplete ? 'var(--green)' : isSourceComplete ? 'var(--accent)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {isAttestationComplete ? <Check size={16} /> : isSourceComplete ? <Loader2 size={16} className="animate-spin" /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: isAttestationComplete ? 'var(--text-primary)' : isSourceComplete ? 'var(--accent)' : 'var(--text-muted)' }}>
              {isAttestationComplete ? 'Circle Attestation Signed' : 'Waiting for Circle Attestation'}
            </span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Circle Iris API cryptographic verification
            </p>
          </div>
        </div>

        {/* Step 3: Destination Mint */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: isDestinationComplete ? 'rgba(0, 212, 168, 0.15)' : isAttestationComplete ? 'var(--accent-glow)' : 'rgba(255,255,255,0.05)',
            color: isDestinationComplete ? 'var(--green)' : isAttestationComplete ? 'var(--accent)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {isDestinationComplete ? <Check size={16} /> : isAttestationComplete ? <Loader2 size={16} className="animate-spin" /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: isDestinationComplete ? 'var(--green)' : isAttestationComplete ? 'var(--accent)' : 'var(--text-muted)' }}>
                {isDestinationComplete ? 'USDC Received on ' + toChain.name : 'Destination Processing'}
              </span>
              {transfer.destinationTxHash && (
                <a
                  href={`${toChain.explorerUrl}/tx/${transfer.destinationTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  View Dest Tx <MdOpenInNew size={12} />
                </a>
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Native USDC minted directly to recipient wallet
            </p>
          </div>
        </div>

      </div>

      {/* Action Buttons for In-Flight State */}
      {isAttestationComplete && !isDestinationComplete && (
        <button
          onClick={onClaim}
          disabled={transfer.status === 'destination_pending'}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #1035f6, #3b82f6)',
            border: 'none', borderRadius: '14px', padding: '16px',
            color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(16, 53, 246, 0.25)',
          }}
        >
          {transfer.status === 'destination_pending' ? 'Confirming on ' + toChain.name + '...' : 'Complete & Receive USDC on ' + toChain.name}
        </button>
      )}

      {isDestinationComplete && (
        <button
          onClick={onReset}
          style={{
            width: '100%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: '14px', padding: '14px',
            color: 'var(--text-primary)', fontSize: '14px', fontWeight: 800, cursor: 'pointer',
          }}
        >
          Start Another Transfer
        </button>
      )}

      {/* Technical Details Accordion */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setShowTechDetails(prev => !prev)}
          style={{
            width: '100%', padding: '12px 16px', background: 'transparent',
            border: 'none', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', color: 'var(--text-secondary)', fontSize: '12px',
            fontWeight: 700, cursor: 'pointer'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdInfoOutline size={14} /> Technical Onchain Details
          </span>
          <ChevronDown size={14} style={{ transform: showTechDetails ? 'rotate(180deg)' : 'none' }} />
        </button>

        {showTechDetails && (
          <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border)', fontSize: '11px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
            <div><strong>Source Domain:</strong> {fromChain.domain} ({fromChain.name})</div>
            <div><strong>Destination Domain:</strong> {toChain.domain} ({toChain.name})</div>
            <div><strong>Recipient:</strong> {transfer.recipientAddress}</div>
            {transfer.sourceTxHash && <div><strong>Source Hash:</strong> {transfer.sourceTxHash}</div>}
            {transfer.messageHash && <div><strong>Message Hash:</strong> {transfer.messageHash}</div>}
            {transfer.destinationTxHash && <div><strong>Destination Hash:</strong> {transfer.destinationTxHash}</div>}
          </div>
        )}
      </div>

    </div>
  )
}

function CctpHistoryTab({ address }: { address?: string }) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    const fetchHistory = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BACKEND_URL}/api/crosspay/user/${address}`)
        if (res.ok) {
          const data = await res.json()
          setHistory(data)
        }
      } catch (err) {
        console.error('Failed to load Cross Pay history:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [address])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
        <p style={{ fontSize: '13px' }}>Loading cross-chain transfer history...</p>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '14px', marginBottom: '4px' }}>No cross-chain transfers yet.</p>
        <p style={{ fontSize: '12px' }}>Your completed and in-flight CCTP V2 transfers will appear here.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {history.map((tx: any) => {
        const fromCfg = getCctpConfig(tx.sourceChain)
        const toCfg = getCctpConfig(tx.destinationChain)
        const isComplete = tx.status === 'COMPLETED'
        return (
          <div key={tx.id} style={{
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '14px 18px', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {tx.amount} USDC
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                  background: isComplete ? 'rgba(0,212,168,0.1)' : 'var(--accent-glow)',
                  color: isComplete ? 'var(--green)' : 'var(--accent)',
                }}>
                  {tx.status}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {fromCfg.name} → {toCfg.name} • {new Date(tx.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {tx.sourceTxHash && (
                <a
                  href={`${fromCfg.explorerUrl}/tx/${tx.sourceTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '12px', color: 'var(--accent)', textDecoration: 'none',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    padding: '6px 10px', borderRadius: '8px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  Source Tx <MdOpenInNew size={12} />
                </a>
              )}
              {tx.destinationTxHash && (
                <a
                  href={`${toCfg.explorerUrl}/tx/${tx.destinationTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '12px', color: 'var(--green)', textDecoration: 'none',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    padding: '6px 10px', borderRadius: '8px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  Dest Tx <MdOpenInNew size={12} />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
