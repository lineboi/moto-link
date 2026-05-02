import { useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Box,
  Button,
  Dialog,
  Field,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const initialRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSync = async () => {
    if (!email || !password) return
    setLoading(true)
    // Auth integration point — connect to Supabase Auth in a future sprint
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    onClose()
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => { if (!open) onClose() }}
      initialFocusEl={() => initialRef.current}
      placement="center"
    >
      {/* Blurred overlay */}
      <Dialog.Backdrop
        bg={isDark ? 'rgba(3, 10, 26, 0.65)' : 'rgba(200, 210, 230, 0.55)'}
        backdropFilter="blur(6px)"
      />

      <Dialog.Positioner>
        <Dialog.Content
          // ── Glassmorphism ──────────────────────────────────────
          bg={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)'}
          backdropFilter="blur(15px)"
          border="1px solid"
          borderColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'}
          boxShadow={
            isDark
              ? '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)'
              : '0 8px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)'
          }
          borderRadius="2xl"
          mx="4"
          maxW="420px"
          w="full"
        >
          {/* Header */}
          <Dialog.Header pb="0" pt="7" px="7">
            <Stack gap="4" align="center" textAlign="center">
              {/* Icon badge */}
              <Box
                bg={isDark ? 'rgba(255,179,0,0.15)' : 'rgba(255,143,0,0.12)'}
                color="accent.solid"
                p="3"
                borderRadius="xl"
                border="1px solid"
                borderColor={isDark ? 'rgba(255,179,0,0.25)' : 'rgba(255,143,0,0.2)'}
              >
                <LockIcon />
              </Box>

              <Stack gap="1">
                <Dialog.Title asChild>
                  <Heading
                    size="2xl"
                    fontWeight="extrabold"
                    color={isDark ? 'white' : 'navy.900'}
                    letterSpacing="tight"
                  >
                    Authenticate
                  </Heading>
                </Dialog.Title>
                <Text
                  fontSize="sm"
                  color={isDark ? 'whiteAlpha.700' : 'gray.600'}
                  lineHeight="tall"
                >
                  Sign in to load your Personalized Spatial Profile &amp; Synced Landmarks.
                </Text>
              </Stack>
            </Stack>
          </Dialog.Header>

          {/* Form body */}
          <Dialog.Body px="7" py="6">
            <Stack gap="4">
              <Field.Root>
                <Field.Label
                  fontSize="sm"
                  fontWeight="semibold"
                  color={isDark ? 'whiteAlpha.800' : 'navy.700'}
                >
                  Email
                </Field.Label>
                <Input
                  ref={initialRef}
                  type="email"
                  placeholder="driver@moto-link.rw"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  bg={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                  border="1px solid"
                  borderColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}
                  color={isDark ? 'white' : 'navy.900'}
                  _placeholder={{ color: isDark ? 'whiteAlpha.400' : 'gray.400' }}
                  _focus={{
                    borderColor: 'accent.solid',
                    boxShadow: '0 0 0 3px rgba(255,179,0,0.25)',
                    bg: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.8)',
                  }}
                  borderRadius="lg"
                  minH="touchTarget"
                  fontSize="md"
                />
              </Field.Root>

              <Field.Root>
                <Field.Label
                  fontSize="sm"
                  fontWeight="semibold"
                  color={isDark ? 'whiteAlpha.800' : 'navy.700'}
                >
                  Password
                </Field.Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  bg={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                  border="1px solid"
                  borderColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}
                  color={isDark ? 'white' : 'navy.900'}
                  _placeholder={{ color: isDark ? 'whiteAlpha.400' : 'gray.400' }}
                  _focus={{
                    borderColor: 'accent.solid',
                    boxShadow: '0 0 0 3px rgba(255,179,0,0.25)',
                    bg: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.8)',
                  }}
                  borderRadius="lg"
                  minH="touchTarget"
                  fontSize="md"
                />
              </Field.Root>
            </Stack>
          </Dialog.Body>

          {/* Actions */}
          <Dialog.Footer px="7" pb="7" pt="0" flexDir="column" gap="3">
            <Button
              onClick={handleSync}
              loading={loading}
              loadingText="Syncing…"
              w="full"
              minH="touchTargetXl"
              bg="accent.solid"
              color="accent.contrast"
              fontWeight="extrabold"
              fontSize="lg"
              letterSpacing="wide"
              borderRadius="xl"
              _hover={{ bg: 'accent.fg', transform: 'scale(1.01)' }}
              _active={{ transform: 'scale(0.98)' }}
              transition="all 140ms ease"
            >
              Sync Profile
            </Button>

            <Button
              variant="ghost"
              w="full"
              minH="touchTarget"
              color={isDark ? 'whiteAlpha.600' : 'gray.500'}
              fontSize="sm"
              onClick={onClose}
              _hover={{ bg: isDark ? 'whiteAlpha.100' : 'blackAlpha.50' }}
              borderRadius="xl"
            >
              Continue without signing in
            </Button>
          </Dialog.Footer>

          <Dialog.CloseTrigger
            position="absolute"
            top="4"
            right="4"
            color={isDark ? 'whiteAlpha.600' : 'gray.500'}
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
