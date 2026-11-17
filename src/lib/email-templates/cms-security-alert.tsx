import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry.ts'

interface Site { host: string; name?: string | null; version: string; lastSeen: string }
interface Props { siteName?: string; securityVersion?: string; sites?: Site[]; prompt?: string }

const Email = ({ siteName = 'je website', securityVersion = '', sites = [], prompt = '' }: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>{`${sites.length} website(s) missen beveiligingsupdate ${securityVersion}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Beveiligingsupdate nodig</Heading>
        <Text style={text}>Projectreferentie: <strong>{siteName}</strong></Text>
        <Text style={text}>
          De volgende websites draaien nog niet op Smart Websites CMS-versie <strong>{securityVersion}</strong> of hoger.
          Plak de update-opdracht hieronder in de Lovable-chat van elk project.
        </Text>
        <Section>
          {sites.map(s => (
            <Text key={s.host} style={row}>
              <strong>{s.name || s.host}</strong> — {s.host}<br />
              Versie {s.version} · laatst gezien {s.lastSeen}
            </Text>
          ))}
        </Section>
        <Hr />
        <Text style={label}>Update-opdracht</Text>
        <Text style={code}>{prompt}</Text>
        <Text style={footer}>Dagelijkse controle door het Smart Websites Master-dashboard.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Smart Websites: ${d['sites']?.length ?? 0} website(s) missen beveiligingsupdate ${d['securityVersion'] ?? ''}`,
  displayName: 'CMS-beveiligingsmelding',
  to: 'office@defero.nl',
  previewData: {
    securityVersion: '2.8.0',
    sites: [{ host: 'gertrozendaalstukadoor.nl', name: 'Gert Rozendaal', version: '2.7.0', lastSeen: '11-11-2026' }],
    prompt: 'Werk Smart Websites bij naar versie 2.8.0 …',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1e3a8a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.5' }
const row = { fontSize: '14px', color: '#333333', borderLeft: '3px solid #1e40af', paddingLeft: '10px' }
const label = { fontSize: '13px', fontWeight: 'bold' as const, color: '#333333' }
const code = { fontSize: '12px', color: '#333333', backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '6px', lineHeight: '1.5' }
const footer = { fontSize: '12px', color: '#999999', marginTop: '24px' }
