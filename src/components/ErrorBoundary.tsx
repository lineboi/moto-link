import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Box, Button, Code, Container, Heading, Stack, Text, VStack } from '@chakra-ui/react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  info: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info })
    console.error('[Moto-Link] Uncaught error:', error, info)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleReset = (): void => {
    this.setState({ error: null, info: null })
  }

  render(): ReactNode {
    const { error, info } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <Box
        minH="100vh"
        bg="bg"
        color="fg"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px="6"
        py="10"
      >
        <Container maxW="2xl">
          <VStack gap="6" align="stretch" textAlign="center">
            <Stack gap="2">
              <Text fontSize="sm" color="accent.fg" fontWeight="bold" letterSpacing="wide">
                MOTO-LINK / SAFE MODE
              </Text>
              <Heading as="h1" size="3xl" color="fg" lineHeight="shorter">
                Something interrupted the ride.
              </Heading>
              <Text fontSize="lg" color="fg.muted">
                The app caught an unexpected error and is holding the route open. Reload to keep moving.
              </Text>
            </Stack>

            <Box
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border"
              borderRadius="lg"
              p="5"
              textAlign="left"
            >
              <Text fontSize="xs" color="fg.subtle" mb="2" fontWeight="semibold" letterSpacing="wide">
                ERROR
              </Text>
              <Code
                display="block"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                bg="bg.muted"
                color="signal.danger"
                p="3"
                borderRadius="md"
                fontSize="sm"
              >
                {error.name}: {error.message}
              </Code>
              {info?.componentStack ? (
                <Code
                  display="block"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                  bg="bg.muted"
                  color="fg.muted"
                  mt="3"
                  p="3"
                  borderRadius="md"
                  fontSize="xs"
                  maxH="40"
                  overflowY="auto"
                >
                  {info.componentStack}
                </Code>
              ) : null}
            </Box>

            <Stack direction={{ base: 'column', sm: 'row' }} gap="3" justify="center">
              <Button
                size="lg"
                bg="accent.solid"
                color="accent.contrast"
                fontWeight="bold"
                _hover={{ bg: 'accent.fg' }}
                onClick={this.handleReload}
                minH="touchTarget"
              >
                Reload App
              </Button>
              <Button
                size="lg"
                variant="outline"
                color="fg"
                borderColor="border.emphasized"
                _hover={{ bg: 'bg.muted' }}
                onClick={this.handleReset}
                minH="touchTarget"
              >
                Try Again
              </Button>
            </Stack>
          </VStack>
        </Container>
      </Box>
    )
  }
}
