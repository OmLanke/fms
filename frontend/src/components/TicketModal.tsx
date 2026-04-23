import { QRCodeSVG } from 'qrcode.react'
import { Booking } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { CheckCircle2, Clock, XCircle, Ban, Ticket } from 'lucide-react'

function statusConfig(status: Booking['status']) {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'Confirmed', icon: CheckCircle2, color: '#16a34a', borderColor: '#bbf7d0' }
    case 'PENDING':
      return { label: 'Pending', icon: Clock, color: '#d97706', borderColor: '#fde68a' }
    case 'FAILED':
      return { label: 'Failed', icon: XCircle, color: '#dc2626', borderColor: '#fecaca' }
    default:
      return { label: 'Cancelled', icon: Ban, color: '#6b7280', borderColor: '#e5e7eb' }
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
      <DialogContent className="w-full max-w-[360px] p-0 bg-transparent border-none shadow-none overflow-visible">
        <div
          className="relative w-full select-none"
          style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.22))' }}
        >
          {/* TOP HALF — dark */}
          <div
            style={{
              background: '#0f0f0f',
              padding: '28px 28px 24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle grain texture */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.06,
                backgroundImage:
                  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")',
                backgroundSize: '160px 160px',
              }}
            />

            {/* Header row */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ticket
                    style={{ width: '14px', height: '14px', color: 'rgba(255,255,255,0.8)' }}
                    strokeWidth={2.5}
                  />
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  TicketFlow
                </span>
              </div>

              {/* Status badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  border: `1px solid ${config.borderColor}`,
                  padding: '3px 10px 3px 8px',
                  background: 'transparent',
                }}
              >
                <StatusIcon
                  style={{ width: '11px', height: '11px', color: config.color, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: config.color,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {config.label}
                </span>
              </div>
            </div>

            {/* Event name */}
            <div style={{ position: 'relative' }}>
              <p
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: '6px',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Event
              </p>
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 500,
                  color: '#ffffff',
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}
              >
                {booking.eventName}
              </h2>
            </div>
          </div>

          {/* TEAR LINE */}
          <div
            style={{
              position: 'relative',
              height: '0',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '0',
                borderTop: '1.5px dashed rgba(0,0,0,0.15)',
              }}
            />
          </div>

          {/* BOTTOM HALF — white */}
          <div style={{ background: '#ffffff', padding: '24px 28px 28px' }}>
            {/* Info grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <InfoCell label="Booking Ref" value={`#${shortId}`} mono />
              <InfoCell label="Issued" value={formatDateTime(booking.createdAt)} />
              <InfoCell
                label="Seats"
                value={`${booking.seatIds.length} seat${booking.seatIds.length !== 1 ? 's' : ''}`}
              />
              <InfoCell label="Total Paid" value={formatCurrency(booking.totalAmount)} accent />
            </div>

            {/* Divider */}
            <div
              style={{
                borderTop: '1px dashed #e5e7eb',
                margin: '0 0 20px',
              }}
            />

            {/* QR + booking ID */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#9ca3af',
                    marginBottom: '6px',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Full Booking ID
                </p>
                <p
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '9.5px',
                    color: '#6b7280',
                    wordBreak: 'break-all',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {booking.id}
                </p>
                {isConfirmed && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginTop: '10px',
                    }}
                  >
                    <CheckCircle2
                      style={{ width: '10px', height: '10px', color: '#16a34a', flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: '#16a34a',
                        fontFamily: "'DM Sans', sans-serif",
                        letterSpacing: '0.03em',
                      }}
                    >
                      Valid admission ticket
                    </span>
                  </div>
                )}
              </div>

              {/* QR Code */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '7px',
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                }}
              >
                <QRCodeSVG
                  value={qrPayload}
                  size={76}
                  bgColor="#ffffff"
                  fgColor="#0f0f0f"
                  level="M"
                />
              </div>
            </div>

            {/* Bottom bar */}
            <div
              style={{
                marginTop: '20px',
                paddingTop: '14px',
                borderTop: '1px solid #f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: '#d1d5db',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ticketflow
              </span>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '9px',
                  color: '#d1d5db',
                }}
              >
                {shortId}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoCell({
  label,
  value,
  mono,
  accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div>
      <p
        style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#9ca3af',
          marginBottom: '4px',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: accent ? '18px' : '13px',
          fontWeight: accent ? 500 : 700,
          color: '#0f0f0f',
          fontFamily: accent
            ? "'Playfair Display', serif"
            : mono
            ? "'DM Mono', monospace"
            : "'DM Sans', sans-serif",
          margin: 0,
          letterSpacing: accent ? '-0.02em' : mono ? '0.02em' : undefined,
        }}
      >
        {value}
      </p>
    </div>
  )
}
