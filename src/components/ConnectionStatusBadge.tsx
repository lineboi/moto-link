import { useEffect, useState } from 'react'
import { Badge, HStack, Spinner, Text } from '@chakra-ui/react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type ConnectionStatus =
  | 'checking'
  | 'missing_env'
  | 'connected'
  | 'schema_missing'
  | 'failed'

interface StatusMeta {
  label: string
  palette: 'gray' | 'green' | 'yellow' | 'red' | 'blue'
}

const STATUS_META: Record<ConnectionStatus, StatusMeta> = {
  checking: { label: 'Checking Supabase…', palette: 'gray' },
  missing_env: { label: 'Set .env.local', palette: 'blue' },
  connected: { label: 'Supabase Online', palette: 'green' },
  schema_missing: { label: 'Schema Not Migrated', palette: 'yellow' },
  failed: { label: 'Connection Failed', palette: 'red' },
}

export function ConnectionStatusBadge() {
  const [status, setStatus] = useState<ConnectionStatus>('checking')
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus('missing_env')
      setDetail('Add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY')
      return
    }

    let cancelled = false

    const ping = async () => {
      try {
        const { error, status: httpStatus } = await supabase
          .from('vernacular_landmarks')
          .select('id', { count: 'exact', head: true })

        if (cancelled) return

        if (!error) {
          setStatus('connected')
          setDetail('vernacular_landmarks reachable')
          return
        }

        const code = error.code ?? ''
        const message = error.message ?? ''
        const isMissingTable =
          code === '42P01' ||
          httpStatus === 404 ||
          message.toLowerCase().includes('relation') ||
          message.toLowerCase().includes('does not exist')

        if (isMissingTable) {
          setStatus('schema_missing')
          setDetail('Run the SQL from databaseschema.md')
        } else {
          setStatus('failed')
          setDetail(message || 'Unknown error')
        }
      } catch (e) {
        if (cancelled) return
        setStatus('failed')
        setDetail(e instanceof Error ? e.message : String(e))
      }
    }

    void ping()
    return () => {
      cancelled = true
    }
  }, [])

  const meta = STATUS_META[status]
  const isLoading = status === 'checking'

  return (
    <HStack gap="3" align="center" justify="center" wrap="wrap">
      <Badge
        colorPalette={meta.palette}
        size="lg"
        px="4"
        py="2"
        borderRadius="full"
        fontWeight="bold"
        fontSize="sm"
        letterSpacing="wide"
        textTransform="uppercase"
      >
        <HStack gap="2">
          {isLoading ? <Spinner size="xs" /> : <StatusDot palette={meta.palette} />}
          <Text>{meta.label}</Text>
        </HStack>
      </Badge>
      {detail ? (
        <Text fontSize="sm" color="fg.muted">
          {detail}
        </Text>
      ) : null}
    </HStack>
  )
}

function StatusDot({ palette }: { palette: StatusMeta['palette'] }) {
  return (
    <Text
      as="span"
      display="inline-block"
      w="2"
      h="2"
      borderRadius="full"
      bg={`${palette}.solid`}
      aria-hidden
    />
  )
}
