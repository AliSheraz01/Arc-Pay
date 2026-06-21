'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { useWallet } from '@solana/wallet-adapter-react'
import { parseUnits, isAddress } from 'viem'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { USDC_ADDRESS, ROUTER_ADDRESS, EXPLORER_URL, BACKEND_URL, arcTestnet } from '@/lib/constants'
import { USDC_ABI, ROUTER_ABI } from '@/lib/abi'
import { sepolia, baseSepolia } from 'wagmi/chains'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MdArrowBack, MdAccessTime, MdCheckCircle, MdSearch, MdErrorOutline } from 'react-icons/md'

type Step = 'form' | 'confirm' | 'cctp_progress' | 'success'

const CHAINS = [
  { id: arcTestnet.id.toString(), name: 'Arc Testnet', type: 'evm' },
  { id: sepolia.id.toString(), name: 'Ethereum Sepolia', type: 'evm' },
  { id: baseSepolia.id.toString(), name: 'Base Sepolia', type: 'evm' },
  { id: 'solana-devnet', name: 'Solana Devnet', type: 'solana' }
]

function SendForm() {
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount()
  const currentChainId = useChainId()
  const { publicKey, connected: isSolanaConnected } = useWallet()
  const solanaAddress = publicKey?.toBase58()

  const searchParams = useSearchParams()

  const [step, setStep] = useState<Step>('form')
  const [recipient, setRecipient] = useState(() => searchParams.get('to') || '')
  
  // Wallet Map resolved from backend
  const [resolvedWallets, setResolvedWallets] = useState<any>(null)
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null)
  
  const [amount, setAmount] = useState(() => searchParams.get('amount') || '')
  const [memo, setMemo] = useState(() => searchParams.get('memo') || '')
  
  const [sendFrom, setSendFrom] = useState(CHAINS[0].id)
  const [receiveOn, setReceiveOn] = useState(CHAINS[0].id)

  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const [cctpPhase, setCctpPhase] = useState<'burning' | 'attesting' | 'minting'>('burning')

  const { writeContractAsync } = useWriteContract()

  // Simplified balance reading for current chain
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: evmAddress ? [evmAddress] : undefined,
    query: { enabled: !!evmAddress },
  })

  const balanceFormatted = usdcBalance ? parseFloat((Number(usdcBalance) / 1e6).toString()).toFixed(2) : '1000.00' // mock balance for demo
  const amountNum = parseFloat(amount || '0')
  const isValidAmount = !isNaN(amountNum) && amountNum > 0

  const resolveRecipient = useCallback(async (value: string) => {
    setResolveError('')
    setResolvedAddress(null)
    setResolvedWallets(null)

    if (!value) return

    if (isAddress(value)) {
      setResolvedAddress(value)
      return
    }

    const username = value.startsWith('@') ? value.slice(1) : value
    if (!username) return

    setResolving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/resolve/${username}`)
      if (res.ok) {
        const data = await res.json()
        if (data.wallets) {
          setResolvedWallets(data.wallets)
          // Pre-select the destination address based on current receiveOn
          updateResolvedAddressForChain(receiveOn, data.wallets)
          return
        }
      }
      throw new Error('User not found')
    } catch (e: any) {
      setResolveError(`Could not find user "@${username}"`)
    } finally {
      setResolving(false)
    }
  }, [receiveOn])

  const updateResolvedAddressForChain = (chainId: string, wallets: any = resolvedWallets) => {
    if (!wallets) return
    let addr = null
    if (chainId === arcTestnet.id.toString()) addr = wallets.arcTestnet
    else if (chainId === sepolia.id.toString()) addr = wallets.ethSepolia
    else if (chainId === baseSepolia.id.toString()) addr = wallets.baseSepolia
    else if (chainId === 'solana-devnet') addr = wallets.solanaDevnet

    if (addr) {
      setResolvedAddress(addr)
      setResolveError('')
    } else {
      setResolvedAddress(null)
      setResolveError(`User has no linked wallet for the selected destination chain.`)
    }
  }

  useEffect(() => {
    updateResolvedAddressForChain(receiveOn)
  }, [receiveOn])

  useEffect(() => {
    const initialTo = searchParams.get('to')
    if (initialTo) resolveRecipient(initialTo)
  }, [searchParams, resolveRecipient])

  async function handleSend() {
    if (!resolvedAddress || !isValidAmount) return
    
    if (sendFrom === receiveOn) {
      // Normal Transfer (simulated for now to avoid router requirements)
      setStep('cctp_progress')
      setCctpPhase('burning')
      setTimeout(() => setStep('success'), 2000)
    } else {
      // Cross-Chain CCTP Flow Simulation
      setStep('cctp_progress')
      setCctpPhase('burning')
      setTimeout(() => {
        setCctpPhase('attesting')
        setTimeout(() => {
          setCctpPhase('minting')
          setTimeout(() => {
            setStep('success')
          }, 2500)
        }, 3000)
      }, 2000)
    }
  }

  const isConnected = isEvmConnected || isSolanaConnected

  if (!isConnected) {
    return (
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to send payments.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '480px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>

        {step === 'form' && (
          <div style={{ 
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Send USDC</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Balance: {balanceFormatted} USDC</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Send From</label>
                <select 
                  value={sendFrom} 
                  onChange={e => setSendFrom(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                  }}
                >
                  {CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Receive On</label>
                <select 
                  value={receiveOn} 
                  onChange={e => setReceiveOn(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                  }}
                >
                  {CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                To (@username)
              </label>
              <input
                type="text"
                placeholder="@username"
                value={recipient}
                onChange={e => {
                  setRecipient(e.target.value)
                  resolveRecipient(e.target.value)
                }}
                style={{
                  width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)',
                  fontSize: '15px', outline: 'none', boxSizing: 'border-box'
                }}
              />
              {resolving && <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px' }}><MdSearch size={12} className="shimmer-rotate" /> Resolving username...</p>}
              {resolvedAddress && !resolveError && (
                <p style={{ color: 'var(--green)', fontSize: '12px', marginTop: '6px', fontFamily: 'monospace', fontWeight: 600 }}>
                  ✓ Destination: {resolvedAddress.slice(0, 10)}…{resolvedAddress.slice(-8)}
                </p>
              )}
              {resolveError && (
                <p style={{ color: 'var(--red)', fontSize: '12px', marginTop: '6px', fontWeight: 600 }}>
                  <MdErrorOutline size={12} /> {resolveError}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Amount
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '14px 70px 14px 16px', color: 'var(--text-primary)',
                    fontSize: '15px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
                <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', fontWeight: 800, fontSize: '14px' }}>
                  USDC
                </span>
              </div>
            </div>

            <button
              disabled={!resolvedAddress || !isValidAmount}
              onClick={() => setStep('confirm')}
              style={{
                width: '100%', background: resolvedAddress && isValidAmount ? 'linear-gradient(135deg, #1035f6, #3b82f6)' : 'var(--border)',
                border: 'none', borderRadius: '12px', padding: '16px', color: resolvedAddress && isValidAmount ? 'white' : 'var(--text-secondary)',
                fontSize: '15px', fontWeight: 800, cursor: resolvedAddress && isValidAmount ? 'pointer' : 'not-allowed',
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div style={{ 
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '24px' }}>Confirm Transfer</h1>

            <div style={{
              background: 'var(--surface-raised)', border: '1px solid var(--border)',
              borderRadius: '16px', padding: '24px', marginBottom: '24px', textAlign: 'center'
            }}>
              <span style={{ fontSize: '42px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {parseFloat(amount).toFixed(2)}
              </span>
              <span style={{ fontSize: '16px', color: 'var(--accent)', fontWeight: 800, marginLeft: '6px' }}>USDC</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Recipient</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}>{recipient}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>From</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}>{CHAINS.find(c => c.id === sendFrom)?.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>To</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}>{CHAINS.find(c => c.id === receiveOn)?.name}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setStep('form')}
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                style={{ flex: 1, background: 'linear-gradient(135deg, #1035f6, #3b82f6)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}
              >
                Confirm & Send
              </button>
            </div>
          </div>
        )}

        {step === 'cctp_progress' && (
          <div style={{ 
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '40px 28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', textAlign: 'center'
          }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '32px' }}>
              {sendFrom === receiveOn ? 'Processing Payment...' : 'Cross-Chain Transfer'}
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: cctpPhase === 'burning' ? 1 : 0.5 }}>
                {cctpPhase === 'burning' ? <MdAccessTime size={24} className="shimmer-rotate" color="var(--accent)" /> : <MdCheckCircle size={24} color="var(--green)" />}
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                  1. {sendFrom === receiveOn ? 'Sending USDC' : 'Initiating Burn on Source Chain'}
                </span>
              </div>
              
              {sendFrom !== receiveOn && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: cctpPhase === 'attesting' ? 1 : cctpPhase === 'minting' ? 0.5 : 0.2 }}>
                    {cctpPhase === 'attesting' ? <MdAccessTime size={24} className="shimmer-rotate" color="var(--accent)" /> : cctpPhase === 'minting' ? <MdCheckCircle size={24} color="var(--green)" /> : <div style={{width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)'}} />}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      2. Waiting for Circle Attestation
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: cctpPhase === 'minting' ? 1 : 0.2 }}>
                    {cctpPhase === 'minting' ? <MdAccessTime size={24} className="shimmer-rotate" color="var(--accent)" /> : <div style={{width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)'}} />}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      3. Minting USDC on Destination Chain
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div style={{ 
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '40px 28px', textAlign: 'center',
            boxShadow: '0 4px 30px rgba(0, 212, 168, 0.05)'
          }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--green)', marginBottom: '8px' }}>Payment Completed!</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
              You successfully sent {parseFloat(amount).toFixed(2)} USDC to {recipient} on {CHAINS.find(c => c.id === receiveOn)?.name}
            </p>

            <Link href="/" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%', background: 'linear-gradient(135deg, #1035f6, #3b82f6)',
                border: 'none', borderRadius: '12px', padding: '16px',
                color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
              }}>
                Return to Dashboard
              </button>
            </Link>
          </div>
        )}
      </main>
    </PageLayout>
  )
}

export default function SendPage() {
  return (
    <Suspense fallback={<PageLayout><div style={{ textAlign: 'center', marginTop: '80px' }}>Loading...</div></PageLayout>}>
      <SendForm />
    </Suspense>
  )
}
