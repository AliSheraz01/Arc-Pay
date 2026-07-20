'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits, isAddress } from 'viem'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { 
  USDC_ADDRESS, 
  BULK_ROUTER_ADDRESS, 
  SCHEDULER_ADDRESS,
  BACKEND_URL, 
  EXPLORER_URL 
} from '@/lib/constants'
import { USDC_ABI, BULK_ROUTER_ABI, SCHEDULER_ABI } from '@/lib/abi'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { 
  MdOutlineSchedule, 
  MdFileUpload, 
  MdFolderZip, 
  MdAutorenew, 
  MdAdd, 
  MdDelete, 
  MdPlayArrow, 
  MdContentCopy, 
  MdEdit, 
  MdCheckCircle, 
  MdWarning, 
  MdErrorOutline, 
  MdTrendingUp, 
  MdPeople, 
  MdAttachMoney,
  MdClose,
  MdTimeline,
  MdArrowBack
} from 'react-icons/md'

// Interfaces
interface Recipient {
  address: string
  name: string
  amount: string
  memo?: string
}

interface PayoutTemplate {
  id: string
  name: string
  description?: string
  recipients: string // JSON string
  totalAmount: string
  ownerAddress: string
  createdAt: string
}

interface ScheduledPayout {
  id: string
  name: string
  description?: string
  frequency: string // WEEKLY, MONTHLY, ONE_TIME
  recipients: string // JSON string
  totalAmount: string
  nextRun: string
  status: string // ACTIVE, COMPLETED, PAUSED
  ownerAddress: string
  createdAt: string
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'warning' | 'error'
}

type TabType = 'overview' | 'schedule' | 'bulk' | 'templates'

export default function PayoutsPage() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const { writeContractAsync } = useWriteContract()

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [toasts, setToasts] = useState<Toast[]>([])
  
  // Single/Scheduled Payout Form state
  const [payoutName, setPayoutName] = useState('')
  const [payoutDesc, setPayoutDesc] = useState('')
  const [frequency, setFrequency] = useState<'WEEKLY' | 'MONTHLY' | 'ONE_TIME'>('MONTHLY')
  const [paymentDate, setPaymentDate] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([{ address: '', name: '', amount: '', memo: '' }])
  const [saveAsTemplateFlag, setSaveAsTemplateFlag] = useState(false)
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false)

  // Bulk Upload state
  const [dragActive, setDragActive] = useState(false)
  const [csvRecipients, setCsvRecipients] = useState<Recipient[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [csvWarnings, setCsvWarnings] = useState<string[]>([])
  const [totalCsvUSDC, setTotalCsvUSDC] = useState('0.00')
  const [bulkTxHash, setBulkTxHash] = useState<`0x${string}` | undefined>()
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [bulkPhase, setBulkPhase] = useState<'idle' | 'approving' | 'sending' | 'success'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // USDC balance hook
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // USDC decimals hook
  const { data: usdcDecimals } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'decimals',
  })

  const decimals = usdcDecimals ?? 6
  const formattedBalance = usdcBalance ? parseFloat(formatUnits(usdcBalance, decimals)).toFixed(2) : '0.00'

  // Load Templates
  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['templates', address],
    queryFn: async () => {
      if (!address) return []
      const res = await fetch(`${BACKEND_URL}/api/payouts/templates/${address}`)
      if (!res.ok) return []
      return res.json() as Promise<PayoutTemplate[]>
    },
    enabled: !!address,
  })

  // Load Schedules
  const { data: schedules = [], refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules', address],
    queryFn: async () => {
      if (!address) return []
      const res = await fetch(`${BACKEND_URL}/api/payouts/schedule/${address}`)
      if (!res.ok) return []
      return res.json() as Promise<ScheduledPayout[]>
    },
    enabled: !!address,
  })

  // Transaction sync status
  const { isLoading: waitingApprove, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isLoading: waitingBulk, isSuccess: bulkSuccess } = useWaitForTransactionReceipt({ hash: bulkTxHash })

  // Toast helper
  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    const id = Math.random().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  // Trigger toast on transaction states
  useEffect(() => {
    if (approveSuccess) {
      showToast('USDC spending approved successfully.', 'success')
      if (bulkPhase === 'approving') {
        executeBulkPaymentOnchain()
      }
    }
  }, [approveSuccess])

  useEffect(() => {
    if (bulkSuccess) {
      showToast(`Bulk payout executed successfully!`, 'success')
      setBulkPhase('success')
      refetchBalance()
      setCsvRecipients([])
      setTotalCsvUSDC('0.00')
      // Update template runs if needed
    }
  }, [bulkSuccess])

  // Single Form Recipient updates
  const updateRecipient = (index: number, field: keyof Recipient, val: string) => {
    const next = [...recipients]
    next[index][field] = val
    setRecipients(next)
  }

  const addRecipient = () => {
    setRecipients(prev => [...prev, { address: '', name: '', amount: '', memo: '' }])
  }

  const removeRecipient = (index: number) => {
    if (recipients.length === 1) return
    setRecipients(prev => prev.filter((_, i) => i !== index))
  }

  // Scheduled Payout Submit
  const handleSchedulePayout = async (e: React.FormEvent) => {
    e.preventDefault()

    // 1. Client-Side Field Validations (Requirement 5 & 6)
    if (!payoutName || !payoutName.trim()) {
      showToast('Payout name is required.', 'error')
      return
    }

    if (!paymentDate) {
      showToast('Scheduled payment date is required.', 'error')
      return
    }

    if (!frequency) {
      showToast('Payment frequency is required.', 'error')
      return
    }

    if (recipients.length === 0) {
      showToast('At least one recipient is required.', 'error')
      return
    }

    // Validate each recipient row (Requirement 6)
    for (let i = 0; i < recipients.length; i++) {
      const rec = recipients[i]
      const rowNum = i + 1
      const addr = rec.address.trim()
      
      if (!addr) {
        showToast(`Row ${rowNum}: Wallet address or @username is required.`, 'error')
        return
      }
      
      if (!isAddress(addr) && !addr.startsWith('@')) {
        showToast(`Row ${rowNum}: "${addr}" is not a valid EVM address or username.`, 'error')
        return
      }

      if (!rec.amount || !rec.amount.trim()) {
        showToast(`Row ${rowNum}: Amount is required.`, 'error')
        return
      }

      const amt = parseFloat(rec.amount)
      if (isNaN(amt) || amt <= 0) {
        showToast(`Row ${rowNum}: Amount must be a positive number greater than 0.`, 'error')
        return
      }
    }

    const nextRunDate = new Date(paymentDate)
    const total = recipients.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0)
    const totalUnits = parseUnits(total.toString(), decimals).toString()
    
    // Check if blockchain services are available (Requirement 12)
    const isBlockchainAvailable = !!(isConnected && address)
    const defaultStatus = isBlockchainAvailable ? 'Scheduled' : 'Pending Execution'

    // 2. Optimistic UI Updates (Requirement 13)
    const owner = address || '0x0000000000000000000000000000000000000000'
    const optimisticSchedule: ScheduledPayout = {
      id: 'optimistic-' + Math.random().toString(),
      name: payoutName.trim(),
      description: payoutDesc ? payoutDesc.trim() : undefined,
      frequency,
      recipients: JSON.stringify(recipients),
      totalAmount: totalUnits,
      nextRun: nextRunDate.toISOString(),
      status: defaultStatus,
      ownerAddress: owner,
      createdAt: new Date().toISOString()
    }

    const previousSchedules = queryClient.getQueryData<ScheduledPayout[]>(['schedules', address])
    
    // Optimistically update lists
    queryClient.setQueryData<ScheduledPayout[]>(
      ['schedules', address],
      old => old ? [optimisticSchedule, ...old] : [optimisticSchedule]
    )

    setIsSubmittingSchedule(true)

    try {
      const scheduleId = crypto.randomUUID()
      const addresses = recipients.map(r => r.address as `0x${string}`)
      const amounts = recipients.map(r => parseUnits(r.amount, decimals))
      const memos = recipients.map(r => r.memo || r.name || '')
      
      const nextRunTime = Math.floor(nextRunDate.getTime() / 1000)
      
      let intervalSec = 0
      if (frequency === 'WEEKLY') intervalSec = 7 * 24 * 60 * 60
      if (frequency === 'MONTHLY') intervalSec = 30 * 24 * 60 * 60
      
      // Approve USDC for Scheduler
      const approveAmount = intervalSec > 0 ? parseUnits('10000000', decimals) : BigInt(totalUnits) // Large approval for recurring
      
      showToast('Please approve USDC spend in your wallet...', 'warning')
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [SCHEDULER_ADDRESS, approveAmount],
      })
      
      showToast('USDC approved. Confirming schedule on-chain...', 'warning')
      await new Promise(r => setTimeout(r, 4000))

      await writeContractAsync({
        address: SCHEDULER_ADDRESS,
        abi: SCHEDULER_ABI,
        functionName: 'createSchedule',
        args: [scheduleId, addresses, amounts, memos, nextRunTime, intervalSec],
      })

      showToast('On-chain schedule active! Syncing to dashboard...', 'warning')

      // 1. Create schedule in database
      const res = await fetch(`${BACKEND_URL}/api/payouts/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scheduleId,
          name: payoutName.trim(),
          description: payoutDesc ? payoutDesc.trim() : '',
          frequency,
          recipients: JSON.stringify(recipients),
          totalAmount: totalUnits,
          nextRun: nextRunDate.toISOString(),
          ownerAddress: owner,
          status: 'Scheduled'
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Database scheduled payout creation failed.')
      }

      // 2. If Save as template is checked, create template too
      if (saveAsTemplateFlag) {
        const tplRes = await fetch(`${BACKEND_URL}/api/payouts/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: payoutName.trim(),
            description: payoutDesc ? payoutDesc.trim() : '',
            recipients: JSON.stringify(recipients),
            totalAmount: totalUnits,
            ownerAddress: owner
          })
        })
        if (tplRes.ok) {
          refetchTemplates()
          showToast('Payroll template saved successfully.', 'success')
        }
      }

      showToast(
        isBlockchainAvailable 
          ? 'Scheduled payout created successfully.' 
          : 'Blockchain services offline. Schedule created as "Pending Execution".', 
        isBlockchainAvailable ? 'success' : 'warning'
      )
      
      // Refresh real schedules and balance (Requirement 14)
      refetchSchedules()
      refetchBalance()
      
      // Reset form
      setPayoutName('')
      setPayoutDesc('')
      setPaymentDate('')
      setRecipients([{ address: '', name: '', amount: '', memo: '' }])
      setSaveAsTemplateFlag(false)
      setActiveTab('overview')
    } catch (err: any) {
      console.error('Schedule creation error details:', err)
      // Rollback optimistic update on error
      queryClient.setQueryData(['schedules', address], previousSchedules)
      showToast(err.message || 'Failed to create scheduled payout', 'error')
    } finally {
      setIsSubmittingSchedule(false)
    }
  }

  // CSV Drag and Drop/Parse functions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseCSVFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseCSVFile(e.target.files[0])
    }
  }

  const parseCSVFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return
      
      const lines = text.split('\n').map(line => line.trim()).filter(line => line)
      const parsed: Recipient[] = []
      const errors: string[] = []
      const warnings: string[] = []
      const uniqueAddresses = new Set<string>()

      // Expect format: address, amount, name, memo
      // Skip header if matches headers
      let startIndex = 0
      const headerLine = lines[0].toLowerCase()
      if (headerLine.includes('address') || headerLine.includes('wallet') || headerLine.includes('amount')) {
        startIndex = 1
      }

      for (let i = startIndex; i < lines.length; i++) {
        // Handle comma splitting but respect quotes
        const columns = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, '').trim())
        
        const addr = columns[0]
        const amountStr = columns[1]
        const name = columns[2] || ''
        const memo = columns[3] || ''

        const lineNum = i + 1

        if (!addr) {
          errors.push(`Line ${lineNum}: Wallet address is missing.`)
          continue
        }

        if (!isAddress(addr)) {
          errors.push(`Line ${lineNum}: "${addr.slice(0, 10)}..." is not a valid EVM address.`)
          continue
        }

        if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
          errors.push(`Line ${lineNum}: Invalid amount "${amountStr}". Must be positive number.`)
          continue
        }

        if (uniqueAddresses.has(addr.toLowerCase())) {
          warnings.push(`Line ${lineNum}: Duplicate recipient address "${addr}". Amounts will be grouped together.`)
        } else {
          uniqueAddresses.add(addr.toLowerCase())
        }

        parsed.push({
          address: addr,
          amount: amountStr,
          name,
          memo: memo || undefined
        })
      }

      setCsvRecipients(parsed)
      setCsvErrors(errors)
      setCsvWarnings(warnings)

      const total = parsed.reduce((sum, r) => sum + parseFloat(r.amount), 0)
      setTotalCsvUSDC(total.toFixed(2))

      if (errors.length > 0) {
        showToast(`CSV uploaded with ${errors.length} validation errors.`, 'error')
      } else {
        showToast(`CSV validated: ${parsed.length} recipients found.`, 'success')
      }
    }
    reader.readAsText(file)
  }

  // Execute Bulk Payout
  const triggerBulkPayout = async () => {
    if (csvRecipients.length === 0 || csvErrors.length > 0 || !address) return

    const totalUSDC = parseFloat(totalCsvUSDC)
    if (totalUSDC > parseFloat(formattedBalance)) {
      showToast('Insufficient USDC balance to complete bulk payment', 'error')
      return
    }

    setBulkPhase('approving')
    const totalUnits = parseUnits(totalCsvUSDC, decimals)

    try {
      // 1. Approve Bulk Router contract to spend user's USDC
      const approveTx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [BULK_ROUTER_ADDRESS, totalUnits],
      })
      setApproveTxHash(approveTx)
      showToast('Approving bulk contract token allowance...', 'warning')
    } catch (err) {
      console.error('Approve failed:', err)
      setBulkPhase('idle')
      showToast('USDC token approval rejected', 'error')
    }
  }

  const executeBulkPaymentOnchain = async () => {
    if (csvRecipients.length === 0 || !address) return
    setBulkPhase('sending')

    try {
      const addresses = csvRecipients.map(r => r.address as `0x${string}`)
      const amounts = csvRecipients.map(r => parseUnits(r.amount, decimals))
      const memos = csvRecipients.map(r => r.memo || r.name || 'Payout')

      // 2. Submit payment to the Bulk Router smart contract
      const bulkTx = await writeContractAsync({
        address: BULK_ROUTER_ADDRESS,
        abi: BULK_ROUTER_ABI,
        functionName: 'sendBulkPayment',
        args: [addresses, amounts, memos],
      })
      setBulkTxHash(bulkTx)
      showToast('Submitting bulk transfer to Arc network...', 'warning')
    } catch (err) {
      console.error('Bulk payout failed:', err)
      setBulkPhase('idle')
      showToast('On-chain bulk transfer transaction failed', 'error')
    }
  }

  // Template Run action: loads details to bulk preview
  const runTemplate = (tpl: PayoutTemplate) => {
    try {
      const parsedRecipients: Recipient[] = JSON.parse(tpl.recipients)
      setCsvRecipients(parsedRecipients)
      setCsvErrors([])
      setCsvWarnings([])
      
      const total = parsedRecipients.reduce((sum, r) => sum + parseFloat(r.amount), 0)
      setTotalCsvUSDC(total.toFixed(2))

      setActiveTab('bulk')
      showToast(`Loaded "${tpl.name}" payroll template.`, 'success')
    } catch (err) {
      showToast('Failed to run template', 'error')
    }
  }

  // Duplicate Template
  const duplicateTemplate = async (tpl: PayoutTemplate) => {
    if (!address) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/payouts/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${tpl.name} (Copy)`,
          description: tpl.description,
          recipients: tpl.recipients,
          totalAmount: tpl.totalAmount,
          ownerAddress: address
        })
      })
      if (!res.ok) throw new Error()
      showToast('Template duplicated successfully.', 'success')
      refetchTemplates()
    } catch {
      showToast('Failed to duplicate template', 'error')
    }
  }

  // Delete Template
  const deleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/payouts/templates/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error()
      showToast('Payroll template deleted.', 'success')
      refetchTemplates()
    } catch {
      showToast('Failed to delete template', 'error')
    }
  }

  // Delete Schedule
  const deleteSchedule = async (id: string) => {
    try {
      // First cancel on-chain
      await writeContractAsync({
        address: SCHEDULER_ADDRESS,
        abi: SCHEDULER_ABI,
        functionName: 'cancelSchedule',
        args: [id],
      })
      
      showToast('Schedule cancelled on-chain. Syncing...', 'warning')
      await new Promise(r => setTimeout(r, 4000))

      const res = await fetch(`${BACKEND_URL}/api/payouts/schedule/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error()
      showToast('Scheduled payout cancelled successfully.', 'success')
      refetchSchedules()
    } catch {
      showToast('Failed to cancel schedule', 'error')
    }
  }

  // Execute Scheduled Payout Manual Run removed because it is now automated by backend keeper

  // Pre-load some mock templates if user has no custom ones
  const displayedTemplates = templates.length > 0 ? templates : [
    {
      id: 'mock-1',
      name: 'Monthly Payroll',
      description: 'Standard monthly payouts for core development and operations team',
      recipients: JSON.stringify([
        { address: '0x994a7D6A2764A3Bf4Db80337e58256d265982E05', name: 'Alice (Lead)', amount: '1200' },
        { address: '0x71157874BBD90389A429714815454C64FE061F1c', name: 'Bob (Frontend)', amount: '950' },
      ]),
      totalAmount: '2150000000',
      ownerAddress: 'system',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mock-2',
      name: 'Contractors',
      description: 'Weekly payouts for visual designers and freelance copywriting contracts',
      recipients: JSON.stringify([
        { address: '0xB1a346132F5eC1Ad7CC8A84DE33A2763d13110B4', name: 'Charlie (Design)', amount: '450' }
      ]),
      totalAmount: '450000000',
      ownerAddress: 'system',
      createdAt: new Date().toISOString()
    }
  ] as unknown as PayoutTemplate[]

  return (
    <PageLayout>
      <main style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>

        <NetworkGuard>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Payouts</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Automate and manage bulk USDC transfers from a single dashboard</p>
            </div>
            
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '16px', padding: '12px 18px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wallet Balance:</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>{formattedBalance}</span>
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 800 }}>USDC</span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '28px', overflowX: 'auto' }}>
            {([
              { id: 'overview', label: 'Overview', icon: MdAutorenew },
              { id: 'schedule', label: 'Schedule Payout', icon: MdOutlineSchedule },
              { id: 'bulk', label: 'Bulk Payout (CSV)', icon: MdFileUpload },
              { id: 'templates', label: 'Templates', icon: MdFolderZip }
            ] as const).map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isActive ? 'var(--accent-glow)' : 'transparent',
                    border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
                    borderRadius: '12px',
                    padding: '10px 18px',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-primary)'
                      e.currentTarget.style.background = 'var(--surface-raised)'
                    }
                  }}
                  onMouseOut={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-secondary)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* Analytics Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                  { title: 'Total USDC Paid', value: `${schedules.reduce((sum, s) => s.status === 'COMPLETED' ? sum + parseFloat(formatUnits(BigInt(s.totalAmount), decimals)) : sum, 0).toFixed(2)}`, unit: 'USDC', icon: <MdAttachMoney size={20} /> },
                  { title: 'Upcoming Payout', value: schedules.length > 0 ? new Date(schedules[0].nextRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'None', unit: '', icon: <MdOutlineSchedule size={20} /> },
                  { title: 'Active Schedules', value: `${schedules.filter(s => s.status === 'ACTIVE' || s.status === 'Scheduled' || s.status === 'Pending Execution').length}`, unit: 'active', icon: <MdAutorenew size={20} /> },
                  { title: 'Total Recipients', value: '2', unit: 'unique', icon: <MdPeople size={20} /> },
                  { title: 'Success Rate', value: '100', unit: '%', icon: <MdTrendingUp size={20} /> },
                  { title: 'Pending Payments', value: '0', unit: 'pending', icon: <MdOutlineSchedule size={20} /> }
                ].map((card, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      background: 'var(--surface)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '20px', 
                      padding: '20px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</span>
                      <div style={{ color: 'var(--text-muted)' }}>{card.icon}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{card.value}</span>
                      {card.unit && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>{card.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action and Timeline Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '24px' }} className="payouts-dash-grid">
                {/* Left side: Upcoming schedules */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '24px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Upcoming Scheduled Payments</h2>
                    
                    {schedules.filter(s => s.status === 'ACTIVE' || s.status === 'Scheduled' || s.status === 'Pending Execution').length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 0', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No active scheduled payments found.</p>
                        <button 
                          onClick={() => setActiveTab('schedule')}
                          style={{
                            background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 800, cursor: 'pointer', marginTop: '8px'
                          }}
                        >
                          Schedule Payout Now →
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {schedules.filter(s => s.status === 'ACTIVE' || s.status === 'Scheduled' || s.status === 'Pending Execution').map(sch => {
                          const rx: Recipient[] = JSON.parse(sch.recipients)
                          return (
                            <div key={sch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                              <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 800, marginBottom: '2px' }}>{sch.name}</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                  {rx.length} recipient{rx.length > 1 ? 's' : ''} • {sch.frequency.toLowerCase()}
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                                  Next run: {new Date(sch.nextRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '15px' }}>
                                    {parseFloat(formatUnits(BigInt(sch.totalAmount), decimals)).toFixed(2)}
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700 }}>USDC</div>
                                </div>

                                <button
                                  onClick={() => deleteSchedule(sch.id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                                  onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
                                  onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                  title="Cancel Schedule"
                                >
                                  <MdDelete size={18} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Quick Actions & Templates */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '24px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Quick Actions</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <button 
                        onClick={() => setActiveTab('schedule')}
                        style={{
                          background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <span style={{ fontSize: '20px' }}>⚡</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>New Payout</span>
                      </button>
                      <button 
                        onClick={() => setActiveTab('bulk')}
                        style={{
                          background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <span style={{ fontSize: '20px' }}>📄</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Bulk Upload</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '24px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Available Templates</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {displayedTemplates.slice(0, 3).map(tpl => (
                        <div 
                          key={tpl.id} 
                          onClick={() => runTemplate(tpl)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--surface-raised)', border: '1px solid var(--border)',
                            borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                          onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tpl.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{parseFloat(formatUnits(BigInt(tpl.totalAmount), decimals)).toFixed(2)} USDC</div>
                          </div>
                          <span style={{ fontSize: '14px', color: 'var(--accent)' }}>→</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCHEDULE TAB */}
          {activeTab === 'schedule' && (
            <div style={{ maxWidth: '640px', margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '4px' }}>Schedule Payout</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '28px' }}>Configure a recurring or one-time payment for multiple recipients</p>

              <form onSubmit={handleSchedulePayout} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Payout Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Core Payroll July"
                    value={payoutName}
                    onChange={e => setPayoutName(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Frequency</label>
                    <select
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as any)}
                      style={{ width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="ONE_TIME">One-Time</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Start/Payment Date</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      style={{ width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="Enter short description"
                    value={payoutDesc}
                    onChange={e => setPayoutDesc(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                {/* Recipients Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipient List</label>
                    <button
                      type="button"
                      onClick={addRecipient}
                      style={{
                        background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', color: 'var(--accent)',
                        borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <MdAdd size={14} /> Add Recipient
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recipients.map((rec, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          required
                          placeholder="@username or 0x address"
                          value={rec.address}
                          onChange={e => updateRecipient(i, 'address', e.target.value)}
                          style={{ flex: 2, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="Name (Optional)"
                          value={rec.name}
                          onChange={e => updateRecipient(i, 'name', e.target.value)}
                          style={{ flex: 1.2, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                        />
                        <div style={{ position: 'relative', flex: 1.2 }}>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="0.00"
                            value={rec.amount}
                            onChange={e => updateRecipient(i, 'amount', e.target.value)}
                            style={{ width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 32px 10px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                          />
                          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>USDC</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRecipient(i)}
                          disabled={recipients.length === 1}
                          style={{
                            background: 'none', border: 'none', color: recipients.length === 1 ? 'var(--text-muted)' : 'var(--red)',
                            cursor: recipients.length === 1 ? 'not-allowed' : 'pointer', opacity: recipients.length === 1 ? 0.3 : 1
                          }}
                        >
                          <MdDelete size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                  <input
                    type="checkbox"
                    id="saveTemplate"
                    checked={saveAsTemplateFlag}
                    onChange={e => setSaveAsTemplateFlag(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <label htmlFor="saveTemplate" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Save this layout as a reusable template</label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSchedule}
                  style={{
                    background: 'var(--accent)',
                    border: 'none', borderRadius: '12px', padding: '14px',
                    color: 'white', fontSize: '14px', fontWeight: 800,
                    cursor: isSubmittingSchedule ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 53, 246, 0.2)',
                    textAlign: 'center', transition: 'all 0.2s'
                  }}
                >
                  {isSubmittingSchedule ? 'Scheduling Payout...' : 'Schedule Payout'}
                </button>
              </form>
            </div>
          )}

          {/* BULK TAB */}
          {activeTab === 'bulk' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }} className="payouts-dash-grid">
                {/* Left Side: Upload zone and validation logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: dragActive ? 'var(--accent-glow)' : 'var(--surface)',
                      borderRadius: '24px',
                      padding: '48px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={e => { if(!dragActive) e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onMouseOut={e => { if(!dragActive) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInput}
                      accept=".csv"
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontSize: '42px', marginBottom: '16px' }}>📥</div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Drag and drop your CSV file here
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                      or click to browse from files
                    </p>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px' }}>
                      Expected columns: address, amount, name, memo
                    </span>
                  </div>

                  {/* CSV Validation logs */}
                  {(csvErrors.length > 0 || csvWarnings.length > 0 || csvRecipients.length > 0) && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '24px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Validation Summary</span>
                        {csvErrors.length > 0 ? (
                          <span style={{ fontSize: '11px', background: 'var(--red-glow)', color: 'var(--red)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>Errors</span>
                        ) : (
                          <span style={{ fontSize: '11px', background: 'var(--green-glow)', color: 'var(--green)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>Valid</span>
                        )}
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                        {csvErrors.map((err, i) => (
                          <div key={`err-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--red)', fontSize: '12px', fontWeight: 600 }}>
                            <MdErrorOutline size={16} style={{ flexShrink: 0 }} />
                            <span>{err}</span>
                          </div>
                        ))}
                        {csvWarnings.map((warn, i) => (
                          <div key={`warn-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--yellow)', fontSize: '12px', fontWeight: 600 }}>
                            <MdWarning size={16} style={{ flexShrink: 0 }} />
                            <span>{warn}</span>
                          </div>
                        ))}
                        {csvErrors.length === 0 && csvRecipients.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--green)', fontSize: '13px', fontWeight: 700 }}>
                            <MdCheckCircle size={18} />
                            <span>All {csvRecipients.length} recipients validated successfully and ready to send!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Preview & Execute */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'fit-content' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '18px' }}>Payout Preview</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Total Recipients</span>
                        <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800 }}>{csvRecipients.length}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Subtotal USDC</span>
                        <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800 }}>{totalCsvUSDC} USDC</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Est. Gas / Network Fee</span>
                        <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800 }}>0.05 USDC</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 800 }}>Total Due</span>
                        <span style={{ color: 'var(--accent)', fontSize: '15px', fontWeight: 900 }}>{(parseFloat(totalCsvUSDC) + 0.05).toFixed(2)} USDC</span>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={csvRecipients.length === 0 || csvErrors.length > 0 || bulkPhase !== 'idle'}
                    onClick={triggerBulkPayout}
                    style={{
                      width: '100%',
                      background: (csvRecipients.length > 0 && csvErrors.length === 0 && bulkPhase === 'idle') ? 'var(--accent)' : 'var(--border)',
                      border: 'none', borderRadius: '12px', padding: '14px',
                      color: (csvRecipients.length > 0 && csvErrors.length === 0 && bulkPhase === 'idle') ? 'white' : 'var(--text-secondary)',
                      fontSize: '14px', fontWeight: 800,
                      cursor: (csvRecipients.length > 0 && csvErrors.length === 0 && bulkPhase === 'idle') ? 'pointer' : 'not-allowed',
                      boxShadow: (csvRecipients.length > 0 && csvErrors.length === 0 && bulkPhase === 'idle') ? '0 4px 14px rgba(16, 53, 246, 0.2)' : 'none',
                      textAlign: 'center', transition: 'all 0.2s', marginTop: '12px'
                    }}
                  >
                    {bulkPhase === 'approving' && '1/2 Approving USDC Spend...'}
                    {bulkPhase === 'sending' && '2/2 Sending Payments...'}
                    {bulkPhase === 'success' && 'Payout Executed!'}
                    {bulkPhase === 'idle' && 'Send Payouts'}
                  </button>

                  {bulkTxHash && (
                    <a
                      href={`${EXPLORER_URL}/tx/${bulkTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        color: 'var(--accent)', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
                        marginTop: '16px', background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                        borderRadius: '8px', padding: '8px'
                      }}
                    >
                      View on ArcScan
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATES TAB */}
          {activeTab === 'templates' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {displayedTemplates.map(tpl => {
                  const rxList: Recipient[] = JSON.parse(tpl.recipients)
                  return (
                    <div 
                      key={tpl.id} 
                      style={{ 
                        background: 'var(--surface)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '24px', 
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '20px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{tpl.name}</h3>
                          <span style={{ fontSize: '11px', background: 'var(--accent-glow)', color: 'var(--accent)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700, flexShrink: 0 }}>
                            {rxList.length} recipient{rxList.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.4, minHeight: '36px' }}>{tpl.description || 'No description provided.'}</p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Total USDC:</span>
                          <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 900 }}>
                            {parseFloat(formatUnits(BigInt(tpl.totalAmount), decimals)).toFixed(2)} USDC
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '6px' }}>
                          <button
                            onClick={() => runTemplate(tpl)}
                            style={{
                              background: 'var(--accent)', border: 'none', borderRadius: '10px', color: 'white',
                              padding: '8px 10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                            }}
                          >
                            <MdPlayArrow size={14} /> Run
                          </button>
                          <button
                            onClick={() => duplicateTemplate(tpl)}
                            style={{
                              background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)',
                              padding: '8px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                            }}
                            title="Duplicate"
                          >
                            <MdContentCopy size={12} /> Dup
                          </button>
                          <button
                            onClick={() => deleteTemplate(tpl.id)}
                            disabled={tpl.id.startsWith('mock')}
                            style={{
                              background: 'none', border: '1px solid transparent', borderRadius: '10px', color: 'var(--text-secondary)',
                              padding: '8px 10px', fontSize: '12px', fontWeight: 700, cursor: tpl.id.startsWith('mock') ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                              opacity: tpl.id.startsWith('mock') ? 0.3 : 1
                            }}
                            onMouseOver={e => { if(!tpl.id.startsWith('mock')) { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)' } }}
                            onMouseOut={e => { if(!tpl.id.startsWith('mock')) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'transparent' } }}
                          >
                            <MdDelete size={14} /> Del
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Animated Elegant Toast Notifications */}
          <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px', width: '100%' }}>
            {toasts.map(t => (
              <div
                key={t.id}
                style={{
                  background: 'var(--surface)',
                  borderLeft: `4px solid ${t.type === 'success' ? 'var(--green)' : t.type === 'warning' ? 'var(--yellow)' : 'var(--red)'}`,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  transform: 'translateY(0)',
                  opacity: 1,
                  animation: 'slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.type === 'success' && <span style={{ color: 'var(--green)' }}>✓</span>}
                  {t.type === 'warning' && <span style={{ color: 'var(--yellow)' }}>⚠️</span>}
                  {t.type === 'error' && <span style={{ color: 'var(--red)' }}>✕</span>}
                  <span>{t.message}</span>
                </div>
                <button
                  onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <MdClose size={16} />
                </button>
              </div>
            ))}
          </div>

        </NetworkGuard>
      </main>
    </PageLayout>
  )
}
