'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { MdArrowBack, MdArrowDownward, MdTimer, MdLocalGasStation, MdCheckCircle, MdSearch, MdErrorOutline } from 'react-icons/md'
import Link from 'next/link'
import { useAccount, useSwitchChain, useChainId } from 'wagmi'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { USDC_ABI, REGISTRY_ABI } from '@/lib/abi'
import { parseUnits, isAddress, createPublicClient, http } from 'viem'
import { CCTP_TOKEN_MESSENGER, getCctpDomain, BACKEND_URL, arcTestnet, REGISTRY_ADDRESS } from '@/lib/constants'

// Note: Usually CCTP depositForBurn involves token approval. We need the TokenMessenger address for approve.
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Example Sepolia USDC

export default function CrossPayPage() {
  const { address, isConnected } = useAccount()
  const { chains } = useSwitchChain()
  const chainId = useChainId()
  
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  // Bridge state: idle -> approving -> burning -> attesting -> minting -> complete
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'approving' | 'burning' | 'attesting' | 'minting' | 'complete'>('idle')

  const [destChainId, setDestChainId] = useState<number>(chains[0]?.id || 0)

  const currentChain = chains.find(c => c.id === chainId)

  // Contract calls
  const { writeContractAsync: writeContractApprove, data: approveHash } = useWriteContract()
  const { isLoading: isConfirmingApprove, isSuccess: isConfirmedApprove } = useWaitForTransactionReceipt({ hash: approveHash })

  const { writeContractAsync: writeContractDeposit, data: depositHash, isPending: isPendingDeposit } = useWriteContract()
  const { isLoading: isConfirmingDeposit, isSuccess: isConfirmedDeposit } = useWaitForTransactionReceipt({ hash: depositHash })

  // Read allowance and balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, CCTP_TOKEN_MESSENGER] : undefined,
    query: { enabled: !!address },
  })

  const formattedBalance = usdcBalance ? Number(usdcBalance) / 1e6 : 0

  const resolveRecipient = useCallback(async (value: string) => {
    setResolveError('')
    setResolvedAddress(null)

    if (!value) return

    if (isAddress(value)) {
      setResolvedAddress(value as `0x${string}`)
      return
    }

    const username = value.startsWith('@') ? value.slice(1) : value
    if (!username) return

    setResolving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/resolve/${username}`)
      if (res.ok) {
        const data = await res.json()
        if (data.address) {
          setResolvedAddress(data.address as `0x${string}`)
          return
        }
      }
      throw new Error('backend failed')
    } catch {
      try {
        const client = createPublicClient({
          chain: arcTestnet,
          transport: http('https://rpc.testnet.arc.network'),
        })
        const resolved = await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'resolveUsername',
          args: [username.toLowerCase()],
        }) as `0x${string}`

        if (resolved && resolved !== '0x0000000000000000000000000000000000000000') {
          setResolvedAddress(resolved)
          return
        }
      } catch (onChainErr) {
        console.error('On-chain resolve failed:', onChainErr)
      }
      setResolveError(`Could not find user "@${username}"`)
    } finally {
      setResolving(false)
    }
  }, [])

  const handleBridge = async () => {
    if (!amount || (!resolvedAddress && !address && !recipient)) return
    
    // If recipient input is empty, default to user's address. If resolved, use resolved.
    const targetAddress = resolvedAddress || (recipient.trim() === '' ? address : null)
    if (!targetAddress) return
    
    const parsedAmount = parseUnits(amount, 6)
    
    try {
      // 1. Check Allowance and Approve if needed
      if (allowance === undefined || (allowance as bigint) < parsedAmount) {
        setBridgeStatus('approving')
        await writeContractApprove({
          address: USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [CCTP_TOKEN_MESSENGER, parsedAmount]
        })
        // wait for useEffect to catch isConfirmedApprove
      } else {
        executeDeposit(targetAddress, parsedAmount)
      }
    } catch (e) {
       console.error("Approval failed", e)
       setBridgeStatus('idle')
    }
  }

  const executeDeposit = async (targetAddr: `0x${string}`, parsedAmount: bigint) => {
    try {
      setBridgeStatus('burning')
      await writeContractDeposit({
        address: CCTP_TOKEN_MESSENGER,
        abi: [{
          "inputs": [
            { "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "internalType": "uint32", "name": "destinationDomain", "type": "uint32" },
            { "internalType": "bytes32", "name": "mintRecipient", "type": "bytes32" },
            { "internalType": "address", "name": "burnToken", "type": "address" }
          ],
          "name": "depositForBurn",
          "outputs": [{ "internalType": "uint64", "name": "nonce", "type": "uint64" }],
          "stateMutability": "nonpayable",
          "type": "function"
        }],
        functionName: 'depositForBurn',
        args: [
          parsedAmount,
          getCctpDomain(destChainId), 
          ('0x000000000000000000000000' + targetAddr.replace('0x', '')) as `0x${string}`, 
          USDC_ADDRESS as `0x${string}`
        ]
      })
    } catch (e) {
      console.error("Deposit failed", e)
      setBridgeStatus('idle')
    }
  }

  // Handle Approve Confirmation
  useEffect(() => {
    if (isConfirmedApprove && bridgeStatus === 'approving') {
       // Proceed to deposit
       const targetAddress = resolvedAddress || (recipient.trim() === '' ? address : null)
       if (targetAddress && amount) {
          executeDeposit(targetAddress as `0x${string}`, parseUnits(amount, 6))
       }
    }
  }, [isConfirmedApprove, bridgeStatus])

  // Update bridge status tracker based on Deposit status
  useEffect(() => {
    if (isPendingDeposit) setBridgeStatus('burning')
    else if (isConfirmingDeposit) setBridgeStatus('attesting')
    else if (isConfirmedDeposit) setBridgeStatus('complete')
  }, [isPendingDeposit, isConfirmingDeposit, isConfirmedDeposit])

  if (!isConnected) {
    return (
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to bridge USDC.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '0 16px' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>
        
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Main Card */}
          <div style={{ 
            flex: '1 1 450px',
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '24px', 
            padding: '28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                <div>
                  <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Cross-chain transfers</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Native USDC bridging powered by Circle</p>
                </div>
                <div style={{ background: 'rgba(39, 117, 202, 0.1)', padding: '6px 12px', borderRadius: '20px', color: '#2775ca', fontSize: '12px', fontWeight: 800 }}>
                  V2
                </div>
              </div>

              {/* From Chain */}
              <div style={{ background: 'var(--surface-raised)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>From Network</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Balance: {formattedBalance.toFixed(2)} USDC</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {currentChain?.name || 'Unknown'} (Current)
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', margin: '-12px 0', position: 'relative', zIndex: 2 }}>
                <div style={{ width: '36px', height: '36px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <MdArrowDownward size={18} />
                </div>
              </div>

              {/* To Chain */}
              <div style={{ background: 'var(--surface-raised)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>To Network</span>
                </div>
                <select 
                  value={destChainId}
                  onChange={e => setDestChainId(Number(e.target.value))}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '18px', fontWeight: 800, outline: 'none', appearance: 'none', cursor: 'pointer' }}
                >
                  {chains.map(c => (
                    <option key={c.id} value={c.id} style={{ background: 'var(--surface)' }}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Amount</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={{ width: '100%', padding: '16px 80px 16px 16px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '28px', fontWeight: 900, outline: 'none' }}
                  />
                  <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>USDC</span>
                  </div>
                </div>
              </div>

              {/* Recipient Field */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Recipient (Optional @username or Address)</label>
                <input 
                  type="text" 
                  placeholder="Leave blank to send to yourself" 
                  value={recipient}
                  onChange={e => {
                    setRecipient(e.target.value)
                    resolveRecipient(e.target.value)
                  }}
                  style={{ width: '100%', padding: '14px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                />
                {resolving && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><MdSearch /> Resolving username...</div>}
                {resolveError && <div style={{ fontSize: '12px', color: '#ff4466', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><MdErrorOutline /> {resolveError}</div>}
                {resolvedAddress && !resolving && !resolveError && recipient !== resolvedAddress && (
                  <div style={{ fontSize: '12px', color: 'var(--green)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MdCheckCircle /> Resolved: {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', padding: '16px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
                    <MdTimer size={16} /> Estimated Time
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}>~2 Minutes</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
                    <MdLocalGasStation size={16} /> Bridge Fee
                  </div>
                  <div style={{ color: 'var(--green)', fontSize: '13px', fontWeight: 800 }}>Free (CCTP)</div>
                </div>
              </div>

              <button 
                onClick={handleBridge}
                disabled={bridgeStatus !== 'idle'}
                style={{
                  width: '100%', padding: '18px', background: bridgeStatus === 'idle' ? '#2775ca' : 'var(--surface-raised)', color: bridgeStatus === 'idle' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: bridgeStatus === 'idle' ? 'pointer' : 'not-allowed', boxShadow: bridgeStatus === 'idle' ? '0 4px 16px rgba(39, 117, 202, 0.3)' : 'none', transition: 'all 0.2s'
                }}
              >
                {bridgeStatus === 'idle' && 'Bridge USDC'}
                {bridgeStatus === 'approving' && 'Approving USDC...'}
                {bridgeStatus === 'burning' && 'Confirm Deposit in Wallet...'}
                {bridgeStatus === 'attesting' && 'Processing Transaction...'}
                {bridgeStatus === 'minting' && 'Minting USDC on Destination...'}
                {bridgeStatus === 'complete' && 'Bridge Complete!'}
              </button>
          </div>

          {/* Progress Tracker Card - Only show when active */}
          {bridgeStatus !== 'idle' && (
            <div style={{ 
              flex: '1 1 250px',
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '24px', 
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              alignSelf: 'flex-start'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px' }}>Executing Bridge...</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '24px' }}>Please wait while the transaction is processed on-chain.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '11px', top: '12px', bottom: '12px', width: '2px', background: 'var(--surface-raised)', zIndex: 0 }}></div>
                
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: (bridgeStatus !== 'idle' && bridgeStatus !== 'approving') ? 'var(--green)' : 'var(--surface-raised)', border: (bridgeStatus === 'approving') ? '2px solid var(--text-primary)' : '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                    {(bridgeStatus !== 'idle' && bridgeStatus !== 'approving') && <MdCheckCircle size={14} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: (bridgeStatus !== 'idle') ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Initialize & Approve</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{bridgeStatus === 'approving' ? 'Pending wallet signature...' : 'Approved successfully'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: (bridgeStatus === 'complete' || bridgeStatus === 'attesting' || bridgeStatus === 'minting') ? 'var(--green)' : 'var(--surface-raised)', border: (bridgeStatus === 'burning') ? '2px solid var(--text-primary)' : '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                    {(bridgeStatus === 'complete' || bridgeStatus === 'attesting' || bridgeStatus === 'minting') && <MdCheckCircle size={14} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: (bridgeStatus === 'complete' || bridgeStatus === 'attesting' || bridgeStatus === 'minting' || bridgeStatus === 'burning') ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Execute Bridge</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{bridgeStatus === 'burning' ? 'Pending wallet signature...' : (bridgeStatus === 'complete' || bridgeStatus === 'attesting' || bridgeStatus === 'minting') ? 'Bridged on source chain' : 'Waiting...'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: bridgeStatus === 'complete' ? 'var(--green)' : 'var(--surface-raised)', border: (bridgeStatus === 'attesting' || bridgeStatus === 'minting') ? '2px solid var(--text-primary)' : '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                    {bridgeStatus === 'complete' && <MdCheckCircle size={14} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: bridgeStatus === 'complete' || bridgeStatus === 'attesting' || bridgeStatus === 'minting' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Finalize & Sync</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{bridgeStatus === 'complete' ? 'Sync Complete' : (bridgeStatus === 'attesting' || bridgeStatus === 'minting') ? 'Awaiting attestation...' : 'Waiting...'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </PageLayout>
  )
}
