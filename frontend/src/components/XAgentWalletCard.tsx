'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { USDC_ADDRESS } from '@/lib/constants'
import { USDC_ABI } from '@/lib/abi'
import { 
  MdSecurity, 
  MdContentCopy, 
  MdOpenInNew, 
  MdArrowDownward, 
  MdArrowUpward, 
  MdCheckCircle,
  MdAccessTime
} from 'react-icons/md'

export function XAgentWalletCard() {
  const { address } = useAccount()
  const [loading, setLoading] = useState(true)
  const [agentData, setAgentData] = useState<{
    agentWalletAddress?: string
    balanceUSDC?: string
    dailyLimitUSDC?: string
    xAccount?: {
      username: string
      displayName?: string
      avatar?: string
    } | null
  } | null>(null)

  const [depositAmount, setDepositAmount] = useState('10.0')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState('')

  const { writeContractAsync, isPending: isDepositing } = useWriteContract()
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isWaitingDeposit, isSuccess: depositSuccess } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  })

  // Load Agent Wallet & Linked X data
  const fetchAgentData = async () => {
    if (!address) return
    try {
      const res = await fetch(`/api/x-bot/agent-wallet?address=${address}`)
      if (res.ok) {
        const data = await res.json()
        setAgentData(data)
      }
    } catch (e) {
      console.warn('Failed to fetch agent wallet:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgentData()
    const interval = setInterval(fetchAgentData, 6000)
    return () => clearInterval(interval)
  }, [address])

  useEffect(() => {
    if (depositSuccess) {
      fetchAgentData()
      setShowDepositModal(false)
      setDepositTxHash(undefined)
    }
  }, [depositSuccess])

  // Deposit funds from Main Wallet to Agent Wallet via canonical ERC-20 transfer
  const handleDeposit = async () => {
    if (!agentData?.agentWalletAddress || !depositAmount) return
    try {
      const parsedUnits = parseUnits(depositAmount, 6)
      const tx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [agentData.agentWalletAddress as `0x${string}`, parsedUnits],
      })
      setDepositTxHash(tx)
    } catch (err: any) {
      console.error('Deposit error:', err)
    }
  }

  // Withdraw (sweep) funds from Agent Wallet back to Main Wallet
  const handleWithdraw = async () => {
    if (!address) return
    setWithdrawing(true)
    setWithdrawSuccess('')
    try {
      const res = await fetch('/api/x-bot/agent-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      if (res.ok) {
        const data = await res.json()
        setWithdrawSuccess(`Swept ${data.withdrawnUSDC} USDC back to your main wallet!`)
        fetchAgentData()
      }
    } catch (err) {
      console.error('Withdraw error:', err)
    } finally {
      setWithdrawing(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Linked 𝕏 Account Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#000',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '16px',
              }}
            >
              𝕏
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                𝕏 (Twitter) Social Identity
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Official OAuth 2.0 PKCE Verification
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: agentData?.xAccount ? 'var(--green)' : 'var(--text-muted)',
              background: agentData?.xAccount ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-raised)',
              border: agentData?.xAccount ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border)',
              padding: '4px 10px',
              borderRadius: '12px',
            }}
          >
            {agentData?.xAccount ? '● CONNECTED' : 'NOT LINKED'}
          </span>
        </div>

        {agentData?.xAccount ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={agentData.xAccount.avatar || `https://unavatar.io/twitter/${agentData.xAccount.username}`}
                alt="Avatar"
                style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border)' }}
              />
              <div>
                <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
                  @{agentData.xAccount.username}
                </strong>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  {agentData.xAccount.displayName || 'Arc Pay User'}
                </p>
              </div>
            </div>
            <a
              href="/profile"
              style={{
                fontSize: '12px',
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Manage in Profile ↗
            </a>
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              background: 'var(--surface-raised)',
              borderRadius: '16px',
              border: '1px dashed var(--border)',
            }}
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px 0' }}>
              Link your 𝕏 account so the bot can associate incoming tips directly with your identity.
            </p>
            <a
              href="/profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#000',
                color: '#fff',
                borderRadius: '12px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              <span>𝕏</span>
              <span>Link 𝕏 Account in Profile</span>
            </a>
          </div>
        )}
      </div>

      {/* 2. Isolated Agent Wallet Vault Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(16, 53, 246, 0.1)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MdSecurity size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Isolated Agent Wallet (Hot Vault)
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Non-Custodial Separation • Main Wallet Never Exposed
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--accent)',
              background: 'var(--accent-glow)',
              padding: '4px 10px',
              borderRadius: '12px',
            }}
          >
            ARC MAINNET
          </span>
        </div>

        {/* Balance Display */}
        <div
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
              Available Hot Balance
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Daily Limit: {agentData?.dailyLimitUSDC || '50.00'} USDC
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {loading ? '...' : agentData?.balanceUSDC || '0.00'}
            </span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>USDC</span>
          </div>

          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Vault Address:</span>
            <code style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>
              {agentData?.agentWalletAddress
                ? `${agentData.agentWalletAddress.slice(0, 6)}...${agentData.agentWalletAddress.slice(-4)}`
                : 'Loading...'}
            </code>
            {agentData?.agentWalletAddress && (
              <button
                type="button"
                onClick={() => handleCopy(agentData.agentWalletAddress!)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
              >
                <MdContentCopy size={14} />
              </button>
            )}
            {copied && <span style={{ color: 'var(--green)', fontSize: '11px' }}>Copied!</span>}
          </div>
        </div>

        {withdrawSuccess && (
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--green)',
              fontSize: '12.5px',
              marginBottom: '16px',
              fontWeight: 700,
            }}
          >
            ✅ {withdrawSuccess}
          </div>
        )}

        {/* Action Buttons: Fund & Withdraw */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setShowDepositModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '14px',
              padding: '12px',
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 53, 246, 0.25)',
            }}
          >
            <MdArrowDownward size={18} />
            <span>Fund Agent Wallet</span>
          </button>

          <button
            type="button"
            disabled={withdrawing || parseFloat(agentData?.balanceUSDC || '0') <= 0}
            onClick={handleWithdraw}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '12px',
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: parseFloat(agentData?.balanceUSDC || '0') > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <MdArrowUpward size={18} />
            <span>{withdrawing ? 'Sweeping...' : 'Withdraw to Main'}</span>
          </button>
        </div>
      </div>

      {/* 3. Deposit Modal */}
      {showDepositModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              Fund Agent Hot Wallet
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Transfer native USDC from your connected Main Wallet into your isolated Agent Wallet. The bot will strictly use these funds.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Amount (USDC)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="10.0"
                style={{
                  width: '100%',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  fontWeight: 800,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Quick Chips */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {['5', '10', '25', '50'].map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setDepositAmount(chip)}
                  style={{
                    flex: 1,
                    background: depositAmount === chip ? 'var(--accent)' : 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '8px',
                    color: depositAmount === chip ? '#fff' : 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  +{chip}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDepositing || isWaitingDeposit || !depositAmount}
                onClick={handleDeposit}
                style={{
                  flex: 1.5,
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isDepositing || isWaitingDeposit ? 'not-allowed' : 'pointer',
                }}
              >
                {isWaitingDeposit ? 'Confirming on Arc...' : isDepositing ? 'Signing...' : `Deposit ${depositAmount} USDC`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
