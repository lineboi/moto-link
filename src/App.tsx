import { Box, Container, Heading, Stack, Text } from '@chakra-ui/react'
import { ConnectionStatusBadge } from '@/components/ConnectionStatusBadge'

function App() {
  return (
    <Box
      as="main"
      minH="100vh"
      bg="bg"
      color="fg"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="6"
      py="10"
    >
      <Container maxW="xl">
        <Stack gap="8" align="center" textAlign="center">
          <Stack gap="3" align="center">
            <Text
              fontSize="sm"
              fontWeight="bold"
              color="accent.fg"
              letterSpacing="wide"
              textTransform="uppercase"
            >
              Lyftathon Kigali 2026
            </Text>
            <Heading
              as="h1"
              size="5xl"
              fontWeight="extrabold"
              letterSpacing="tight"
              lineHeight="shorter"
              color="fg"
            >
              Moto-Link
            </Heading>
            <Text fontSize="lg" color="fg.muted" maxW="md">
              Vernacular voice → precise GPS, built for Kigali's hills, gloves, and glare.
            </Text>
          </Stack>
          <ConnectionStatusBadge />
        </Stack>
      </Container>
    </Box>
  )
}

export default App
