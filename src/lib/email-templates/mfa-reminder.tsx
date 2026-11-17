import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry.ts'

interface Props { siteName?: string; dashboardUrl?: string }

const MfaReminderEmail = ({ siteName, dashboardUrl }: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Stel tweestapsverificatie in voor je account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Beveilig je account met 2FA</Heading>
        <Text style={text}>
          Je account voor <strong>{siteName || 'je website'}</strong> heeft nog geen tweestapsverificatie (2FA).
          Dit is noodzakelijk voor een goede beveiliging.
        </Text>
        <Text style={text}>
          Websites zijn een geliefd doelwit van geautomatiseerde inlogpogingen. Met 2FA heeft een indringer naast je
          wachtwoord ook een code van jouw telefoon nodig. Zo blijft je website veilig, ook als je wachtwoord ooit uitlekt.
        </Text>
        <Text style={text}>
          Instellen duurt ongeveer twee minuten met een authenticator-app zoals Google Authenticator, Microsoft Authenticator
          of LastPass Authenticator. Log in, open het accountmenu rechtsboven en kies Tweestapsverificatie.
        </Text>
        {dashboardUrl && <Button style={button} href={dashboardUrl}>Nu inloggen en 2FA instellen</Button>}
        <Text style={footer}>Je ontvangt deze herinnering om de twee weken zolang 2FA niet is ingesteld.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MfaReminderEmail,
  subject: 'Actie nodig: stel tweestapsverificatie (2FA) in',
  displayName: '2FA-herinnering',
  previewData: { siteName: 'Voorbeeldwebsite', dashboardUrl: 'https://example.nl/smart-websites' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'IBM Plex Sans', Arial, sans-serif" }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600, color: '#111827', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#3b4fd8', color: '#ffffff', borderRadius: '8px', padding: '12px 20px', fontSize: '15px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '28px 0 0' }
