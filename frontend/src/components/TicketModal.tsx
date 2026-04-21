import { QRCodeSVG } from 'qrcode.react'
import { Booking } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { CheckCircle2, Clock, XCircle, Ban, Ticket } from 'lucide-react'

function statusConfig(status: Booking['status']) {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'Confirmed', icon: CheckCircle2, color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' }
    case 'PENDING':
      return { label: 'Pending', icon: Clock, color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' }
    case 'FAILED':
      return { label: 'Failed', icon: XCircle, color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' }
    default:
      return { label: 'Cancelled', icon: Ban, color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' }
  }
}

function buildQrPayload(booking: Booking): string {
  return JSON.stringify({
    id: booking.id,
    event: booking.eventName,
    seats: booking.seatIds.length,
    status: booking.status,
    total: booking.totalAmount,
    issued: booking.createdAt,
  })
}

interface TicketModalProps {
  booking: Booking
  children: React.ReactNode
}

export function TicketModal({ booking, children }: TicketModalProps) {
  const config = statusConfig(booking.status)
  const StatusIcon = config.icon
  const shortId = booking.id.split('-')[0].toUpperCase()
  const qrPayload = buildQrPayload(booking)
  const isConfirmed = booking.status === 'CONFIRMED'

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-full max-w-sm p-0 bg-transparent border-none shadow-none overflow-visible">

        {/* Ticket */}
        <div
          className="relative w-full select-none"
          style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.35))' }}
        >
          {/* ── TOP HALF ── */}
          <div
            style={{
              background: isConfirmed
                ? 'linear-gradient(135deg, #0f172a 0%, #0e4f5c 60%, #0f766e 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              borderRadius: '20px 20px 0 0',
              padding: '28px 28px 24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Dot grid texture */}
            <div
              style={{
                position: 'absolute', inset: 0, opacity: 0.15,
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />

            {/* Diagonal shine */}
            <div
              style={{
                position: 'absolute', top: '-60px', right: '-40px',
                width: '180px', height: '180px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
              }}
            />

            {/* Header row */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px' }}>
                  <Ticket style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.9)' }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                  TicketFlow
                </span>
              </div>

              {/* Status badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: config.bg, border: `1px solid ${config.border}`,
                borderRadius: '999px', padding: '4px 10px 4px 8px',
              }}>
                <StatusIcon style={{ width: '12px', height: '12px', color: config.color }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: config.color }}>{config.label}</span>
              </div>
            </div>

            {/* Event name */}
            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>
                Event
              </p>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.02em', margin: 0 }}>
                {booking.eventName}
              </h2>
            </div>
          </div>

          {/* ── TEAR LINE ── */}
          <div style={{ position: 'relative', height: '0', display: 'flex', alignItems: 'center' }}>
            {/* Left notch */}
            <div style={{
              position: 'absolute', left: '-14px', top: '50%', transform: 'translateY(-50%)',
              width: '28px', height: '28px', borderRadius: '50%',
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.08)',
              zIndex: 10,
            }} />
            {/* Right notch */}
            <div style={{
              position: 'absolute', right: '-14px', top: '50%', transform: 'translateY(-50%)',
              width: '28px', height: '28px', borderRadius: '50%',
              background: '#111827',
              zIndex: 10,
            }} />
            {/* Dashed line */}
            <div style={{
              width: '100%', height: '0',
              borderTop: '1.5px dashed rgba(255,255,255,0.12)',
              margin: '0 8px',
            }} />
          </div>

          {/* ── BOTTOM HALF ── */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '0 0 20px 20px',
              padding: '24px 28px 28px',
            }}
          >
            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '20px' }}>
              <InfoCell label="Booking Ref" value={`#${shortId}`} mono />
              <InfoCell label="Issued" value={formatDateTime(booking.createdAt)} />
              <InfoCell label="Seats" value={`${booking.seatIds.length} seat${booking.seatIds.length !== 1 ? 's' : ''}`} />
              <InfoCell label="Total Paid" value={formatCurrency(booking.totalAmount)} accent />
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px dashed #e2e8f0', margin: '0 0 20px' }} />

            {/* QR + booking ID row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px' }}>
                  Full Booking ID
                </p>
                <p style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b', wordBreak: 'break-all', lineHeight: 1.6, margin: 0 }}>
                  {booking.id}
                </p>
                {isConfirmed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px' }}>
                    <CheckCircle2 style={{ width: '11px', height: '11px', color: '#10b981' }} />
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#10b981' }}>Valid admission ticket</span>
                  </div>
                )}
              </div>

              {/* QR Code */}
              <div style={{
                flexShrink: 0, borderRadius: '12px', padding: '8px',
                border: '1px solid #e2e8f0', background: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <QRCodeSVG
                  value={qrPayload}
                  size={80}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  level="M"
                />
              </div>
            </div>

            {/* Bottom brand bar */}
            <div style={{
              marginTop: '20px', paddingTop: '14px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#cbd5e1' }}>
                ticketflow.dev
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#cbd5e1' }}>
                {shortId}
              </span>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}

function InfoCell({ label, value, mono, accent }: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div>
      <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}>
        {label}
      </p>
      <p style={{
        fontSize: accent ? '18px' : '13px',
        fontWeight: 800,
        color: accent ? '#0e7490' : '#0f172a',
        fontFamily: mono ? 'monospace' : undefined,
        margin: 0,
        letterSpacing: accent ? '-0.02em' : undefined,
      }}>
        {value}
      </p>
    </div>
  )
}
