'use client'

import { useState, useRef, useEffect } from 'react'
import { useChainId, useChains, useSwitchChain } from 'wagmi'
import { FiChevronDown } from 'react-icons/fi'

export function NetworkSwitcher() {
  const chainId = useChainId()
  const chains = useChains()
  const { switchChainAsync } = useSwitchChain()
  
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeChain = chains.find(c => c.id === chainId)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!activeChain) return null

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'all 0.2s',
        }}
        className="network-btn hover-border"
      >
        <div style={{ 
          width: '20px', 
          height: '20px', 
          borderRadius: '50%', 
          background: 'var(--surface)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {/* Simple fallback avatar for chains without icons */}
          <span style={{ fontSize: '10px' }}>{activeChain.name.charAt(0)}</span>
        </div>
        <span>{activeChain.name}</span>
        <FiChevronDown size={14} style={{ opacity: 0.6 }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '8px',
          width: '220px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {chains.map((chain) => (
            <button
              key={chain.id}
              onClick={async () => {
                try {
                  if (switchChainAsync) await switchChainAsync({ chainId: chain.id })
                  setIsOpen(false)
                } catch (e) {
                  console.error(e)
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px',
                background: chain.id === chainId ? 'var(--surface-raised)' : 'transparent',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'background 0.2s'
              }}
              className="chain-item"
            >
              <div style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%', 
                background: 'var(--surface-raised)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <span style={{ fontSize: '10px' }}>{chain.name.charAt(0)}</span>
              </div>
              <span style={{ flex: 1 }}>{chain.name}</span>
              {chain.id === chainId && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} />
              )}
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .hover-border:hover { border-color: var(--accent); }
        .chain-item:hover { background: var(--surface-raised); }
      `}</style>
    </div>
  )
}
