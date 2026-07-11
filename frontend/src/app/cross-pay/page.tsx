'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { MdSend, MdHistory, MdHealing, MdArrowBack, MdSearch, MdErrorOutline, MdCheckCircle } from 'react-icons/md'
import { ChevronDown, RefreshCw, ArrowUpDown, Check, Wallet, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAccount, useSwitchChain, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi'
import { parseUnits, isAddress, createPublicClient, http, decodeEventLog, keccak256 } from 'viem'
import { CCTP_TOKEN_MESSENGER, getCctpDomain, BACKEND_URL, REGISTRY_ADDRESS, arcTestnet } from '@/lib/constants'
import { REGISTRY_ABI, USDC_ABI, MESSAGE_TRANSMITTER_ABI } from '@/lib/abi'

// ---- Real chain configs (verified chain IDs / public RPCs / explorers) ----
const CHAINS = [
  {
    id: "arc",
    name: "Arc Testnet",
    color: "#6b5bff",
    chainIdDec: 5042002,
    rpcUrl: "https://rpc.testnet.arc.network",
    explorer: "https://testnet.arcscan.app",
    nativeSymbol: "USDC",
    decimals: 18,
  },
  {
    id: "eth",
    name: "Ethereum Sepolia",
    color: "#8fa3c9",
    chainIdDec: 11155111,
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
    nativeSymbol: "ETH",
    decimals: 18,
  },
  {
    id: "arb",
    name: "Arbitrum Sepolia",
    color: "#28a0f0",
    chainIdDec: 421614,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
    nativeSymbol: "ETH",
    decimals: 18,
  },
  {
    id: "base",
    name: "Base Sepolia",
    color: "#0052ff",
    chainIdDec: 84532,
    rpcUrl: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    nativeSymbol: "ETH",
    decimals: 18,
  },
  {
    id: "ink",
    name: "Ink Testnet",
    color: "#9b5bd6",
    chainIdDec: 763373,
    rpcUrl: "https://rpc-gel-sepolia.inkonchain.com",
    explorer: "https://explorer-sepolia.inkonchain.com",
    nativeSymbol: "ETH",
    decimals: 18,
  },
  {
    id: "linea",
    name: "Linea Sepolia",
    color: "#61dfff",
    chainIdDec: 59141,
    rpcUrl: "https://rpc.sepolia.linea.build",
    explorer: "https://sepolia.lineascan.build",
    nativeSymbol: "ETH",
    decimals: 18,
  },
  {
    id: "monad",
    name: "Monad Testnet",
    color: "#8a5cf6",
    chainIdDec: 10143,
    rpcUrl: "https://testnet-rpc.monad.xyz",
    explorer: "https://testnet.monadexplorer.com",
    nativeSymbol: "MONAD",
    decimals: 18,
  },
  {
    id: "sonic",
    name: "Sonic Testnet",
    color: "#ff5b5b",
    chainIdDec: 57054,
    rpcUrl: "https://rpc.testnet.soniclabs.com",
    explorer: "https://testnet.sonicscan.org",
    nativeSymbol: "S",
    decimals: 18,
  },
  {
    id: "unichain",
    name: "Unichain Sepolia",
    color: "#ff66cc",
    chainIdDec: 1301,
    rpcUrl: "https://sepolia.unichain.org",
    explorer: "https://sepolia.uniscan.xyz",
    nativeSymbol: "ETH",
    decimals: 18,
  },
  {
    id: "op",
    name: "Optimism Sepolia",
    color: "#ff3e3e",
    chainIdDec: 11155420,
    rpcUrl: "https://sepolia.optimism.io",
    explorer: "https://sepolia-optimism.etherscan.io",
    nativeSymbol: "ETH",
    decimals: 18,
  }
];

// CCTP USDC & Messenger configs per Chain ID
const CCTP_CONFIGS: Record<number, { usdc: `0x${string}`, messenger: `0x${string}`, messageTransmitter: `0x${string}`, decimals: number }> = {
  11155111: { // Ethereum Sepolia
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    messenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    decimals: 6
  },
  421614: { // Arbitrum Sepolia
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    messenger: '0x127156157f13C07f6c3D02319c59508821034c4C',
    messageTransmitter: '0x109bc137cb64Eab7C0b1ddDd1EDfF241F719705d',
    decimals: 6
  },
  84532: { // Base Sepolia
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    messenger: '0x1682ae6375C4E8A7D564BC4930e159937D76e654',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    decimals: 6
  },
  5042002: { // Arc Testnet
    usdc: '0x3600000000000000000000000000000000000000',
    messenger: '0x0000000000000000000000000000000000000000',
    messageTransmitter: '0x0000000000000000000000000000000000000000',
    decimals: 18
  }
};

function getCctpContracts(chainId: number) {
  const cfg = CCTP_CONFIGS[chainId]
  if (cfg) return cfg
  return {
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
    messenger: CCTP_TOKEN_MESSENGER,
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD' as `0x${string}`,
    decimals: 6
  }
}

// ---- helpers ----
function hexToBigInt(hex: string) {
  try {
    return BigInt(hex);
  } catch {
    return BigInt(0);
  }
}

function formatUnits(raw: bigint, decimals: number, maxFrac = 4) {
  const neg = raw < BigInt(0);
  const v = neg ? -raw : raw;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  let fracStr = frac.toString().padStart(decimals, "0").slice(0, maxFrac);
  fracStr = fracStr.replace(/0+$/, "");
  const out = fracStr.length ? `${whole}.${fracStr}` : `${whole}`;
  return (neg ? "-" : "") + out;
}

async function rpcCall(rpcUrl: string, method: string, params: any[]) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

async function fetchNativeBalance(chain: typeof CHAINS[0], address: string) {
  const result = await rpcCall(chain.rpcUrl, "eth_getBalance", [address, "latest"]);
  return hexToBigInt(result);
}

async function fetchUsdcBalance(chain: typeof CHAINS[0], address: string) {
  try {
    const contracts = getCctpContracts(chain.chainIdDec);
    const data = `0x70a08231000000000000000000000000` + address.replace('0x', '').toLowerCase();
    const result = await rpcCall(chain.rpcUrl, "eth_call", [
      { to: contracts.usdc, data },
      "latest"
    ]);
    return hexToBigInt(result);
  } catch {
    return fetchNativeBalance(chain, address);
  }
}

// ---- Network logo marks ----
function NetworkMark({ id, size }: { id: string, size: number }) {
  const s = size;
  switch (id) {
    case "eth":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <polygon points="12,2 19,12.2 12,16 5,12.2" fill="#c1c9e8" opacity="0.9" />
          <polygon points="12,2 19,12.2 12,9.2" fill="#8fa3c9" />
          <polygon points="12,17.2 19,13.4 12,22 5,13.4" fill="#c1c9e8" opacity="0.9" />
          <polygon points="12,17.2 19,13.4 12,22" fill="#8fa3c9" />
        </svg>
      );
    case "arb":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" fill="#213147" />
          <path d="M8 16.5 L11.3 7 L13 7 L9.7 16.5 Z" fill="#28a0f0" />
          <path d="M12.7 16.5 L16 7 L17.7 7 L14.4 16.5 Z" fill="#fff" />
          <path d="M6.5 16.5 H17.8 L17 18.2 H7.3 Z" fill="#28a0f0" />
        </svg>
      );
    case "base":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" fill="#0052ff" />
          <rect x="6.4" y="10.6" width="11.2" height="2.8" fill="#fff" />
        </svg>
      );
    case "ink":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <defs>
            <linearGradient id="inkGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
          <path d="M12 2.5 C15.5 8 18.5 11 18.5 14.5 C18.5 18.6 15.6 21.5 12 21.5 C8.4 21.5 5.5 18.6 5.5 14.5 C5.5 11 8.5 8 12 2.5 Z" fill="url(#inkGrad)" />
        </svg>
      );
    case "linea":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#000" />
          <path d="M8 6 V15.5 H16" stroke="#61dfff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "monad":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <polygon points="12,2 20.5,7 20.5,17 12,22 3.5,17 3.5,7" fill="#8a5cf6" />
          <polygon points="12,6 16.5,8.7 16.5,15.3 12,18 7.5,15.3 7.5,8.7" fill="#0a0b0e" opacity="0.35" />
        </svg>
      );
    case "sonic":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#ff5b5b" />
          <path d="M7 14 L12 7 L17 14 H14 L12 11 L10 14 Z" fill="#fff" />
        </svg>
      );
    case "unichain":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#ff66cc" />
          <circle cx="12" cy="12" r="5" fill="#fff" />
        </svg>
      );
    case "op":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#ff3e3e" />
          <path d="M8 12 C8 9.5 9.5 8 12 8 C14.5 8 16 9.5 16 12 C16 14.5 14.5 16 12 16 C9.5 16 8 14.5 8 12 Z" stroke="#fff" strokeWidth="2.5" />
        </svg>
      );
    case "arc":
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" fill="#1a1730" />
          <path d="M4.5 15.5 A9 9 0 0 1 19.5 15.5" stroke="#6b5bff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="12" cy="15.6" r="2" fill="#a99bff" />
        </svg>
      );
  }
}

function ChainIcon({ chain, size = 22 }: { chain: typeof CHAINS[0], size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <NetworkMark id={chain.id} size={size} />
    </span>
  );
}

interface ChainSelectProps {
  value: typeof CHAINS[0]
  onChange: (chain: typeof CHAINS[0]) => void
  disabledId: string
}

function ChainSelect({ value, onChange, disabledId }: ChainSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "12px 14px",
          cursor: "pointer",
          color: "var(--text-primary)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChainIcon chain={value} />
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{value.name}</span>
        </span>
        <ChevronDown
          size={16}
          color="var(--text-secondary)"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            zIndex: 100,
            maxHeight: 240,
            overflowY: "auto",
            padding: 6,
          }}
        >
          {CHAINS.map((c) => {
            const selected = c.id === value.id;
            const disabled = c.id === disabledId;
            return (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  background: selected ? "rgba(255,255,255,0.05)" : "transparent",
                  border: "none",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.35 : 1,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!disabled) e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selected ? "rgba(255,255,255,0.05)" : "transparent";
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ChainIcon chain={c} size={20} />
                  <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: selected ? 700 : 500 }}>{c.name}</span>
                </span>
                {selected && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                    <Check size={13} /> Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PanelProps {
  label: string
  chain: typeof CHAINS[0]
  onChainChange: (chain: typeof CHAINS[0]) => void
  disabledId: string
  amount: string
  onAmountChange?: (val: string) => void
  readOnly?: boolean
  balanceMap: Record<string, string>
  loadingBalances: boolean
  onMax?: () => void
}

function Panel({
  label,
  chain,
  onChainChange,
  disabledId,
  amount,
  onAmountChange,
  readOnly,
  balanceMap,
  loadingBalances,
  onMax,
}: PanelProps) {
  const bal = balanceMap[chain.id];
  const balanceText = loadingBalances && bal === undefined ? "…" : bal !== undefined ? bal : "0.00";

  return (
    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          USDC Balance: {balanceText}
          {!readOnly && onMax && (
            <button
              type="button"
              onClick={onMax}
              style={{ fontSize: 11, fontWeight: 900, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              MAX
            </button>
          )}
        </span>
      </div>

      <ChainSelect value={chain} onChange={onChainChange} disabledId={disabledId} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: "6px 12px 6px 8px",
          }}
        >
          <ChainIcon chain={chain} size={22} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>USDC</span>
        </span>
        <input
          value={amount}
          readOnly={readOnly}
          onChange={(e) => onAmountChange && onAmountChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          style={{ background: "transparent", border: "none", outline: "none", textAlign: "right", fontSize: 26, fontWeight: 800, color: "var(--text-primary)", width: "50%" }}
        />
      </div>
    </div>
  );
}

export default function CrossPayPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'recovery'>('send')
  const { isConnected } = useAccount()

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
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px' }}>
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
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Cross Pay</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Send USDC across any supported testnet instantly.</p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: 'var(--surface-raised)', padding: '6px', borderRadius: '16px' }}>
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
              <MdSend size={18} /> Send
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
              <MdHistory size={18} /> History
            </button>
            <button
              onClick={() => setActiveTab('recovery')}
              style={{
                flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: activeTab === 'recovery' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'recovery' ? '#fff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <MdHealing size={18} /> Recovery
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'send' && <SendPaymentTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'recovery' && <RecoveryEngineTab />}

        </div>
      </main>
    </PageLayout>
  )
}

function SendPaymentTab() {
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient()

  const [fromChain, setFromChain] = useState(CHAINS[1]); // Ethereum Sepolia
  const [toChain, setToChain] = useState(CHAINS[0]); // Arc Testnet
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'approving' | 'burning' | 'attesting' | 'ready_to_claim' | 'claiming' | 'complete'>('idle')
  const [bridgeMessage, setBridgeMessage] = useState<string | null>(null)
  const [bridgeAttestation, setBridgeAttestation] = useState<string | null>(null)
  const [balanceMap, setBalanceMap] = useState<Record<string, string>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startPolling = useCallback((msgHash: string, currentMessage: string, destChainId: number) => {
    let attempts = 0
    const maxAttempts = 150
    const interval = setInterval(async () => {
      try {
        attempts++
        const res = await fetch(`https://iris-api-sandbox.circle.com/attestations/${msgHash}`)
        const data = await res.json()
        
        if (data.status === 'complete' && data.attestation) {
          clearInterval(interval)
          setBridgeAttestation(data.attestation)
          setBridgeStatus('ready_to_claim')
          
          // Save attestation to local storage
          localStorage.setItem('arc_pending_cross_tx', JSON.stringify({
            bridgeMessage: currentMessage,
            msgHash,
            attestation: data.attestation,
            toChainIdDec: destChainId
          }))
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          console.error("Attestation polling timed out")
          setBridgeStatus('idle')
        }
      } catch (err) {
        console.error("Error polling attestation:", err)
      }
    }, 6000)
  }, [])

  useEffect(() => {
    const pendingTxStr = localStorage.getItem('arc_pending_cross_tx')
    if (pendingTxStr) {
      try {
        const pendingTx = JSON.parse(pendingTxStr)
        if (pendingTx.bridgeMessage) {
          setBridgeMessage(pendingTx.bridgeMessage)
          if (pendingTx.toChainIdDec) {
            const destChain = CHAINS.find(c => c.chainIdDec === pendingTx.toChainIdDec)
            if (destChain) setToChain(destChain)
          }
          
          if (pendingTx.attestation) {
            setBridgeAttestation(pendingTx.attestation)
            setBridgeStatus('ready_to_claim')
          } else if (pendingTx.msgHash) {
            setBridgeStatus('attesting')
            startPolling(pendingTx.msgHash, pendingTx.bridgeMessage, pendingTx.toChainIdDec)
          }
        }
      } catch (err) {
        console.error("Failed to parse pending cross tx", err)
      }
    }
  }, [startPolling])

  // Contract calls configurations
  const currentCctp = getCctpContracts(fromChain.chainIdDec)
  const { writeContractAsync: writeContractApprove, data: approveHash } = useWriteContract()
  const { isLoading: isConfirmingApprove, isSuccess: isConfirmedApprove } = useWaitForTransactionReceipt({ hash: approveHash })

  const { writeContractAsync: writeContractDeposit, data: depositHash } = useWriteContract()
  const { writeContractAsync: writeContractClaim } = useWriteContract()

  // Read allowance
  const { data: allowance } = useReadContract({
    address: currentCctp.usdc,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, currentCctp.messenger] : undefined,
    query: { enabled: !!address && activeChainId === fromChain.chainIdDec },
  })

  const loadAllBalances = useCallback(async (addr: string) => {
    if (!addr) return;
    setLoadingBalances(true);
    const entries = await Promise.all(
      CHAINS.map(async (c) => {
        try {
          const contracts = getCctpContracts(c.chainIdDec);
          const raw = await fetchUsdcBalance(c, addr);
          return [c.id, formatUnits(raw, contracts.decimals, 4)];
        } catch {
          return [c.id, "—"];
        }
      })
    );
    setBalanceMap(Object.fromEntries(entries));
    setLoadingBalances(false);
  }, []);

  // Reload balances when wallet, fromChain, or transaction state changes
  useEffect(() => {
    if (address) {
      loadAllBalances(address)
    }
  }, [address, fromChain, bridgeStatus, loadAllBalances])

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

  const handleSendCrossChain = async () => {
    if (!amount || (!resolvedAddress && !address && !recipient)) return
    
    const targetAddress = resolvedAddress || (recipient.trim() === '' ? address : null)
    if (!targetAddress) return
    
    const contracts = getCctpContracts(fromChain.chainIdDec)
    const parsedAmount = parseUnits(amount, contracts.decimals)
    
    try {
      if (allowance === undefined || (allowance as bigint) < parsedAmount) {
        setBridgeStatus('approving')
        const txHash = await writeContractApprove({
          address: contracts.usdc,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [contracts.messenger, parsedAmount]
        })

        if (publicClient) {
          try {
            await publicClient.waitForTransactionReceipt({ hash: txHash })
          } catch (receiptErr) {
            console.warn("Failed to get transaction receipt, proceeding with fallback delay:", receiptErr)
            await new Promise(resolve => setTimeout(resolve, 4000))
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 4000))
        }
      }
      
      setBridgeStatus('burning')
      const targetBytes32 = ('0x000000000000000000000000' + targetAddress.replace('0x', '')) as `0x${string}`
      const destDomain = getCctpDomain(toChain.chainIdDec) === getCctpDomain(fromChain.chainIdDec)
        ? (getCctpDomain(fromChain.chainIdDec) === 0 ? 6 : 0)
        : getCctpDomain(toChain.chainIdDec)

      const txHash = await writeContractDeposit({
        address: contracts.messenger,
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
        args: [parsedAmount, destDomain, targetBytes32, contracts.usdc]
      })

      if (!publicClient) throw new Error("No public client")
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      
      setBridgeStatus('attesting')
      const messageSentTopic = '0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036'
      const log = receipt.logs.find(l => l.topics[0] === messageSentTopic)
      if (!log) throw new Error("MessageSent log not found")
      
      const decoded = decodeEventLog({
        abi: MESSAGE_TRANSMITTER_ABI,
        data: log.data,
        topics: log.topics,
        eventName: 'MessageSent'
      })
      const messageBytes = decoded.args.message as string
      setBridgeMessage(messageBytes)
      
      const msgHash = keccak256(messageBytes as `0x${string}`)
      
      // Save initial state to local storage
      localStorage.setItem('arc_pending_cross_tx', JSON.stringify({
        bridgeMessage: messageBytes,
        msgHash,
        toChainIdDec: toChain.chainIdDec
      }))
      
      // Poll for Attestation
      startPolling(msgHash, messageBytes, toChain.chainIdDec)

    } catch (e) {
       console.error("Transaction failed", e)
       setBridgeStatus('idle')
    }
  }

  const handleClaim = async () => {
    if (!bridgeMessage || !bridgeAttestation) return
    if (activeChainId !== toChain.chainIdDec) {
      if (switchChainAsync) {
        try {
          await switchChainAsync({ chainId: toChain.chainIdDec })
        } catch (err) {
          console.error("Failed to switch chain", err)
        }
      }
      return
    }

    try {
      setBridgeStatus('claiming')
      const contracts = getCctpContracts(toChain.chainIdDec)
      const txHash = await writeContractClaim({
        address: contracts.messageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [bridgeMessage as `0x${string}`, bridgeAttestation as `0x${string}`]
      })

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash })
      }
      setBridgeStatus('complete')
      localStorage.removeItem('arc_pending_cross_tx')
    } catch (e) {
      console.error("Claim failed", e)
      setBridgeStatus('ready_to_claim')
    }
  }

  const handleFromChainChange = async (c: typeof CHAINS[0]) => {
    setFromChain(c)
    setError(null)
    if (switchChainAsync) {
      try {
        await switchChainAsync({ chainId: c.chainIdDec })
      } catch (err: any) {
        setError(err?.message || `Failed to switch to ${c.name}`)
      }
    }
  }

  const refresh = () => {
    setSpinning(true)
    if (address) loadAllBalances(address)
    setTimeout(() => setSpinning(false), 500)
  }

  const swapDirection = () => {
    const temp = fromChain
    setFromChain(toChain)
    setToChain(temp)
    if (switchChainAsync) {
      switchChainAsync({ chainId: toChain.chainIdDec }).catch(console.error)
    }
  }

  const handleMax = () => {
    const bal = balanceMap[fromChain.id]
    if (bal && bal !== "—") setAmount(bal)
  }

  const walletOnCorrectChain = activeChainId === fromChain.chainIdDec

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>Select Bridge Path</span>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh Balances"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <RefreshCw size={13} color="var(--text-secondary)" style={{ animation: spinning ? "spin 0.5s linear" : "none" }} />
        </button>
      </div>

      <Panel
        label="From (Source Chain)"
        chain={fromChain}
        onChainChange={handleFromChainChange}
        disabledId={toChain.id}
        amount={amount}
        onAmountChange={setAmount}
        balanceMap={balanceMap}
        loadingBalances={loadingBalances}
        onMax={handleMax}
      />

      <div style={{ display: 'flex', justifyContent: 'center', margin: '-10px 0' }}>
        <button
          type="button"
          onClick={swapDirection}
          aria-label="Swap direction"
          style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2, position: "relative" }}
        >
          <ArrowUpDown size={15} color="var(--text-secondary)" />
        </button>
      </div>

      <Panel
        label="To (Destination Chain)"
        chain={toChain}
        onChainChange={setToChain}
        disabledId={fromChain.id}
        amount={amount}
        readOnly
        balanceMap={balanceMap}
        loadingBalances={loadingBalances}
      />

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Recipient (@username or Address)</label>
        <input 
          type="text" 
          placeholder="@alisheraz0ev or 0x... (Default: Your own address)" 
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

      {error && (
        <div style={{ fontSize: 12, color: "#ff6b6b", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.25)", borderRadius: 8, padding: "8px 10px" }}>
          {error}
        </div>
      )}

      {bridgeStatus === 'ready_to_claim' || bridgeStatus === 'claiming' ? (
        <button 
          onClick={handleClaim}
          disabled={bridgeStatus === 'claiming'}
          style={{
            width: '100%', padding: '18px', background: bridgeStatus === 'claiming' ? 'var(--text-secondary)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: bridgeStatus === 'claiming' ? 'not-allowed' : 'pointer', marginTop: '12px', boxShadow: bridgeStatus === 'claiming' ? 'none' : '0 4px 16px var(--accent-glow)', transition: 'all 0.2s'
          }}
        >
          {bridgeStatus === 'ready_to_claim' && activeChainId !== toChain.chainIdDec ? `Switch Wallet to ${toChain.name} to Claim` : (bridgeStatus === 'claiming' ? 'Claiming Funds...' : 'Claim Funds')}
        </button>
      ) : !walletOnCorrectChain ? (
        <button
          type="button"
          onClick={() => switchChainAsync && switchChainAsync({ chainId: fromChain.chainIdDec })}
          style={{
            width: '100%', padding: '18px', background: 'var(--yellow)', color: 'black', border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', marginTop: '12px', transition: 'all 0.2s'
          }}
        >
          Switch Wallet to {fromChain.name}
        </button>
      ) : (
        <button 
          onClick={handleSendCrossChain}
          disabled={bridgeStatus !== 'idle'}
          style={{
            width: '100%', padding: '18px', background: bridgeStatus !== 'idle' ? 'var(--text-secondary)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: bridgeStatus !== 'idle' ? 'not-allowed' : 'pointer', marginTop: '12px', boxShadow: bridgeStatus !== 'idle' ? 'none' : '0 4px 16px var(--accent-glow)', transition: 'all 0.2s'
          }}
        >
          {bridgeStatus === 'idle' && 'Send Cross-Chain Payment'}
          {bridgeStatus === 'approving' && 'Approving USDC in wallet...'}
          {bridgeStatus === 'burning' && 'Confirming Deposit...'}
          {bridgeStatus === 'attesting' && 'Waiting for Circle Attestation...'}
          {bridgeStatus === 'complete' && 'Payment Sent & Claimed!'}
        </button>
      )}

      {/* Confirmation statuses */}
      {bridgeStatus === 'complete' && (
        <div style={{ padding: '16px', background: 'var(--green-glow)', color: 'var(--green)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <MdCheckCircle size={20} /> Transaction successful! Funds have arrived on the destination chain.
        </div>
      )}
      {bridgeStatus === 'approving' && (
        <div style={{ padding: '16px', background: 'var(--surface-raised)', color: 'var(--text-secondary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Loader2 size={16} className="animate-spin" color="var(--text-secondary)" /> Waiting for approval...
        </div>
      )}
      {bridgeStatus === 'burning' && (
        <div style={{ padding: '16px', background: 'var(--surface-raised)', color: 'var(--text-secondary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Loader2 size={16} className="animate-spin" color="var(--text-secondary)" /> Please confirm the cross-chain deposit in your wallet...
        </div>
      )}
      {bridgeStatus === 'attesting' && (
        <div style={{ padding: '16px', background: 'var(--surface-raised)', color: 'var(--text-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Loader2 size={16} className="animate-spin" color="var(--accent)" /> Waiting for Circle Attestation (may take a few minutes)...
        </div>
      )}
      {bridgeStatus === 'claiming' && (
        <div style={{ padding: '16px', background: 'var(--surface-raised)', color: 'var(--text-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Loader2 size={16} className="animate-spin" color="var(--accent)" /> Claiming funds on destination chain...
        </div>
      )}
    </div>
  )
}

function HistoryTab() {
  const [filter, setFilter] = useState('All')
  const filters = ['All', 'Sent', 'Received', 'Pending', 'Failed', 'Recovered']

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '8px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {filters.map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
              background: filter === f ? 'var(--text-primary)' : 'var(--surface-raised)',
              color: filter === f ? 'var(--surface)' : 'var(--text-secondary)',
              border: filter === f ? 'none' : '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--border)', borderRadius: '16px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏱️</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>No {filter.toLowerCase()} transactions found</p>
      </div>
    </div>
  )
}

function RecoveryEngineTab() {
  return (
    <div>
      <div style={{ padding: '24px', background: 'rgba(225, 29, 46, 0.1)', border: '1px solid rgba(225, 29, 46, 0.3)', borderRadius: '16px', marginBottom: '24px', textAlign: 'center' }}>
        <MdHealing size={32} color="#E11D2E" style={{ marginBottom: '12px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#E11D2E', marginBottom: '8px' }}>Arc Recovery Engine</h3>
        <p style={{ color: '#E11D2E', fontSize: '13px', opacity: 0.8 }}>Automatically recovers funds from failed or stuck cross-chain transactions.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '20px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyIntersection: 'space-between' } as any}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Tx #99824</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Stuck during attestation</div>
          </div>
          <button style={{ padding: '8px 16px', background: '#E11D2E', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Recover 500 USDC
          </button>
        </div>
      </div>
    </div>
  )
}
