import { useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import type { User } from '@supabase/supabase-js'
import {
  Box,
  Button,
  Dialog,
  Field,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onSignOut: () => Promise<void>
}

type AuthMode = 'login' | 'signup'
type FormState = 'idle' | 'loading' | 'success' | 'error'

// ─── Validation ───────────────────────────────────────────────────
function validate(email: string, password: string, mode: AuthMode) {
  const errors: { email?: string; password?: string } = {}
  if (!email.trim()) errors.email = 'Email is required'
  if (!password) errors.password = 'Password is required'
  else if (password.length < 6) errors.password = 'Minimum 6 characters'
  if (mode === 'signup' && password.length > 0 && password.length < 8)
    errors.password = 'Use at least 8 characters for security'
  return errors
}

// ─── Icons ────────────────────────────────────────────────────────
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

// ─── Glassmorphism style helper ────────────────────────────────────
function useGlassStyles(isDark: boolean) {
  return {
    contentBg: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    contentBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
    contentShadow: isDark
      ? '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 8px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    inputBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    labelColor: isDark ? 'whiteAlpha.800' : 'navy.700',
    textColor: isDark ? 'white' : 'navy.900',
    mutedColor: isDark ? 'whiteAlpha.600' : 'gray.500',
  }
}

export function AuthModal({ isOpen, onClose, user, onSignOut }: AuthModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const g = useGlassStyles(isDark)
  const initialRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [serverError, setServerError] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({})

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setErrors({})
    setTouched({})
    setServerError('')
    setFormState('idle')
  }

  const switchMode = (next: AuthMode) => {
    setMode(next)
    resetForm()
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((t) => ({ ...t, [field]: true }))
    const e = validate(email, password, mode)
    setErrors(e)
  }

  const handleSubmit = async () => {
    if (!isSupabaseConfigured()) {
      setServerError('Supabase is not configured. Add credentials to .env.local')
      setFormState('error')
      return
    }

    const e = validate(email, password, mode)
    setErrors(e)
    setTouched({ email: true, password: true })
    if (Object.keys(e).length > 0) return

    setFormState('loading')
    setServerError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setServerError(
          error.message.includes('Invalid login credentials')
            ? 'Incorrect email or password. Try again.'
            : error.message,
        )
        setFormState('error')
      } else {
        setFormState('success')
        setTimeout(() => { resetForm(); onClose() }, 1500)
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setServerError(
          error.message.includes('already registered')
            ? 'This email is already registered. Try logging in.'
            : error.message,
        )
        setFormState('error')
      } else {
        setFormState('success')
      }
    }
  }

  const isLoading = formState === 'loading'
  const isSuccess = formState === 'success'

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => { if (!open) handleClose() }}
      initialFocusEl={() => initialRef.current}
      placement="center"
    >
      <Dialog.Backdrop
        bg={isDark ? 'rgba(3,10,26,0.65)' : 'rgba(200,210,230,0.55)'}
        backdropFilter="blur(6px)"
      />
      <Dialog.Positioner>
        <Dialog.Content
          bg={g.contentBg}
          backdropFilter="blur(15px)"
          border="1px solid"
          borderColor={g.contentBorder}
          boxShadow={g.contentShadow}
          borderRadius="2xl"
          mx="4"
          maxW="420px"
          w="full"
        >
          {/* ── Logged-in profile view ─────────────────────────── */}
          {user ? (
            <>
              <Dialog.Header pb="0" pt="7" px="7">
                <Stack gap="3" align="center" textAlign="center">
                  <Box
                    bg="rgba(34,197,94,0.15)"
                    color="signal.success"
                    p="3" borderRadius="xl"
                    border="1px solid" borderColor="rgba(34,197,94,0.25)"
                  >
                    <CheckIcon />
                  </Box>
                  <Dialog.Title asChild>
                    <Heading size="xl" fontWeight="extrabold" color={g.textColor} letterSpacing="tight">
                      Profile
                    </Heading>
                  </Dialog.Title>
                  <Text fontSize="sm" color={g.mutedColor}>Signed in as</Text>
                  <Text fontSize="md" fontWeight="bold" color="accent.solid">{user.email}</Text>
                </Stack>
              </Dialog.Header>
              <Dialog.Body px="7" py="5">
                <Box
                  bg={g.inputBg} borderRadius="lg" border="1px solid"
                  borderColor={g.inputBorder} p="4"
                >
                  <Stack gap="1">
                    <Text fontSize="xs" color={g.mutedColor} fontWeight="bold"
                      textTransform="uppercase" letterSpacing="wide">User ID</Text>
                    <Text fontSize="xs" color={g.textColor} fontFamily="mono"
                      wordBreak="break-all">{user.id}</Text>
                  </Stack>
                </Box>
              </Dialog.Body>
              <Dialog.Footer px="7" pb="7" pt="0" flexDir="column" gap="3">
                <Button
                  onClick={async () => { await onSignOut(); handleClose() }}
                  w="full" minH="touchTarget" variant="outline"
                  borderColor="signal.danger" color="signal.danger"
                  fontWeight="bold" fontSize="md" borderRadius="xl"
                  _hover={{ bg: 'rgba(239,68,68,0.1)' }}
                >
                  Sign Out
                </Button>
                <Button
                  variant="ghost" w="full" minH="touchTarget"
                  color={g.mutedColor} fontSize="sm" onClick={handleClose}
                  _hover={{ bg: isDark ? 'whiteAlpha.100' : 'blackAlpha.50' }}
                  borderRadius="xl"
                >
                  Close
                </Button>
              </Dialog.Footer>
            </>
          ) : isSuccess && mode === 'signup' ? (
            /* ── Sign-up confirmation ─────────────────────────── */
            <>
              <Dialog.Header pb="0" pt="7" px="7">
                <Stack gap="3" align="center" textAlign="center">
                  <Box bg="rgba(34,197,94,0.15)" color="signal.success" p="3"
                    borderRadius="xl" border="1px solid" borderColor="rgba(34,197,94,0.25)">
                    <CheckIcon />
                  </Box>
                  <Dialog.Title asChild>
                    <Heading size="xl" fontWeight="extrabold" color={g.textColor}>
                      Check your email
                    </Heading>
                  </Dialog.Title>
                  <Text fontSize="sm" color={g.mutedColor} lineHeight="tall">
                    We sent a confirmation link to <strong>{email}</strong>.
                    Click it to activate your Spatial Profile.
                  </Text>
                </Stack>
              </Dialog.Header>
              <Dialog.Footer px="7" pb="7" pt="4">
                <Button w="full" minH="touchTarget" bg="accent.solid" color="accent.contrast"
                  fontWeight="bold" borderRadius="xl" onClick={handleClose}>
                  Got it
                </Button>
              </Dialog.Footer>
            </>
          ) : (
            /* ── Auth form (login / sign up) ──────────────────── */
            <>
              <Dialog.Header pb="0" pt="7" px="7">
                <Stack gap="4" align="center" textAlign="center">
                  <Box bg={isDark ? 'rgba(255,179,0,0.15)' : 'rgba(255,143,0,0.12)'}
                    color="accent.solid" p="3" borderRadius="xl" border="1px solid"
                    borderColor={isDark ? 'rgba(255,179,0,0.25)' : 'rgba(255,143,0,0.2)'}>
                    <LockIcon />
                  </Box>
                  <Stack gap="1">
                    <Dialog.Title asChild>
                      <Heading size="2xl" fontWeight="extrabold" color={g.textColor}
                        letterSpacing="tight">
                        Authenticate
                      </Heading>
                    </Dialog.Title>
                    <Text fontSize="sm" color={g.mutedColor} lineHeight="tall">
                      Sign in to load your Personalized Spatial Profile &amp; Synced Landmarks.
                    </Text>
                  </Stack>

                  {/* Mode tabs */}
                  <HStack
                    bg={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                    borderRadius="full" p="1" gap="1" w="full"
                  >
                    {(['login', 'signup'] as AuthMode[]).map((m) => (
                      <Button key={m} flex="1" size="sm" borderRadius="full"
                        bg={mode === m ? 'accent.solid' : 'transparent'}
                        color={mode === m ? 'accent.contrast' : g.mutedColor}
                        fontWeight="bold" fontSize="sm"
                        _hover={{ bg: mode === m ? 'accent.fg' : isDark ? 'whiteAlpha.100' : 'blackAlpha.50' }}
                        onClick={() => switchMode(m)}
                        minH="9"
                      >
                        {m === 'login' ? 'Log In' : 'Create Account'}
                      </Button>
                    ))}
                  </HStack>
                </Stack>
              </Dialog.Header>

              <Dialog.Body px="7" py="5">
                <Stack gap="4">
                  {/* Email */}
                  <Field.Root invalid={touched.email && !!errors.email}>
                    <Field.Label fontSize="sm" fontWeight="semibold" color={g.labelColor}>
                      Email
                    </Field.Label>
                    <Input
                      ref={initialRef}
                      type="email"
                      placeholder="driver@moto-link.rw"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (touched.email) setErrors(validate(e.target.value, password, mode))
                      }}
                      onBlur={() => handleBlur('email')}
                      bg={g.inputBg} border="1px solid" borderColor={
                        touched.email && errors.email ? 'signal.danger' : g.inputBorder
                      }
                      color={g.textColor}
                      _placeholder={{ color: isDark ? 'whiteAlpha.400' : 'gray.400' }}
                      _focus={{
                        borderColor: touched.email && errors.email ? 'signal.danger' : 'accent.solid',
                        boxShadow: touched.email && errors.email
                          ? '0 0 0 3px rgba(239,68,68,0.25)'
                          : '0 0 0 3px rgba(255,179,0,0.25)',
                        bg: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.8)',
                      }}
                      borderRadius="lg" minH="touchTarget" fontSize="md"
                    />
                    {touched.email && errors.email && (
                      <Field.ErrorText fontSize="xs">{errors.email}</Field.ErrorText>
                    )}
                  </Field.Root>

                  {/* Password */}
                  <Field.Root invalid={touched.password && !!errors.password}>
                    <Field.Label fontSize="sm" fontWeight="semibold" color={g.labelColor}>
                      Password
                    </Field.Label>
                    <Input
                      type="password"
                      placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (touched.password) setErrors(validate(email, e.target.value, mode))
                      }}
                      onBlur={() => handleBlur('password')}
                      bg={g.inputBg} border="1px solid" borderColor={
                        touched.password && errors.password ? 'signal.danger' : g.inputBorder
                      }
                      color={g.textColor}
                      _placeholder={{ color: isDark ? 'whiteAlpha.400' : 'gray.400' }}
                      _focus={{
                        borderColor: touched.password && errors.password ? 'signal.danger' : 'accent.solid',
                        boxShadow: touched.password && errors.password
                          ? '0 0 0 3px rgba(239,68,68,0.25)'
                          : '0 0 0 3px rgba(255,179,0,0.25)',
                        bg: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.8)',
                      }}
                      borderRadius="lg" minH="touchTarget" fontSize="md"
                    />
                    {touched.password && errors.password && (
                      <Field.ErrorText fontSize="xs">{errors.password}</Field.ErrorText>
                    )}
                  </Field.Root>

                  {/* Server error */}
                  {serverError && (
                    <Box bg="rgba(239,68,68,0.12)" border="1px solid"
                      borderColor="rgba(239,68,68,0.3)" borderRadius="lg" px="4" py="3">
                      <Text fontSize="sm" color="signal.danger" fontWeight="medium">
                        {serverError}
                      </Text>
                    </Box>
                  )}

                  {/* Success (login) */}
                  {isSuccess && mode === 'login' && (
                    <Box bg="rgba(34,197,94,0.12)" border="1px solid"
                      borderColor="rgba(34,197,94,0.3)" borderRadius="lg" px="4" py="3">
                      <Text fontSize="sm" color="signal.success" fontWeight="bold">
                        ✓ Signed in successfully!
                      </Text>
                    </Box>
                  )}
                </Stack>
              </Dialog.Body>

              <Dialog.Footer px="7" pb="7" pt="0" flexDir="column" gap="3">
                <Button
                  onClick={handleSubmit}
                  loading={isLoading}
                  loadingText={mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  w="full" minH="touchTargetXl"
                  bg="accent.solid" color="accent.contrast"
                  fontWeight="extrabold" fontSize="lg" letterSpacing="wide"
                  borderRadius="xl"
                  _hover={{ bg: 'accent.fg', transform: 'scale(1.01)' }}
                  _active={{ transform: 'scale(0.98)' }}
                  transition="all 140ms ease"
                >
                  {mode === 'login' ? 'Sync Profile' : 'Create Account'}
                </Button>
                <Button
                  variant="ghost" w="full" minH="touchTarget"
                  color={g.mutedColor} fontSize="sm" onClick={handleClose}
                  _hover={{ bg: isDark ? 'whiteAlpha.100' : 'blackAlpha.50' }}
                  borderRadius="xl"
                >
                  Continue without signing in
                </Button>
              </Dialog.Footer>
            </>
          )}

          <Dialog.CloseTrigger position="absolute" top="4" right="4" color={g.mutedColor} />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
