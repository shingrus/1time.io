import InlineCss from '../../components/InlineCss';
import PasswordGenerator from '../../components/PasswordGenerator';
import {absoluteUrl, siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `WiFi Password Generator — ${siteHost}`,
    description: 'Generate strong, random WiFi passwords that are secure yet easy to type. Created locally in your browser. Free, instant, and private.',
    alternates: { canonical: '/wifi-password-generator' },
    openGraph: {
        title: `WiFi Password Generator — ${siteHost}`,
        description: 'Generate strong WiFi passwords that are secure yet easy to type. Created in your browser.',
        url: '/wifi-password-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'WiFi Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'WiFi Password Generator',
    url: absoluteUrl('/wifi-password-generator'),
    description: 'Generate strong, random WiFi passwords that are secure yet easy to type. Created locally in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io' },
        { '@type': 'ListItem', position: 2, name: 'WiFi Password Generator', item: 'https://1time.io/wifi-password-generator' },
    ],
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        { '@type': 'Question', name: 'Why no symbols in WiFi passwords?', acceptedAnswer: { '@type': 'Answer', text: 'Most WiFi passwords are typed on devices with limited keyboards — smart TVs, game consoles, IoT devices. Symbols like @#$% are hard to locate on these keyboards and slow down the process. A 16-character alphanumeric password still provides about 95 bits of entropy, which is more than sufficient for WiFi security.' } },
        { '@type': 'Question', name: 'How long should a WiFi password be?', acceptedAnswer: { '@type': 'Answer', text: 'At least 12 characters, ideally 16 or more. WiFi passwords can be attacked offline (the attacker doesn\'t need to stay connected to your network), so they need more length than typical website passwords. Our default of 16 characters provides a strong security margin.' } },
        { '@type': 'Question', name: 'How often should I change my WiFi password?', acceptedAnswer: { '@type': 'Answer', text: 'Change it when a device is lost or stolen, when someone who knows the password no longer needs access, or if you suspect unauthorized access. For home networks with WPA3, routine changes aren\'t strictly necessary. For WPA2 networks in shared environments (offices, rentals), consider changing it every 3-6 months.' } },
        { '@type': 'Question', name: 'Can someone hack my WiFi with a strong password?', acceptedAnswer: { '@type': 'Answer', text: 'With a 16-character random password and WPA2/WPA3, brute-forcing the password is computationally infeasible. Attackers would need to exploit router firmware vulnerabilities or use social engineering instead. Keep your router firmware updated and disable WPS (WiFi Protected Setup) for best security.' } },
    ],
};

export default function WifiPasswordGeneratorPage() {
    return (
        <>
            <InlineCss file="styles/generator.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <PasswordGenerator presetPath="/wifi-password-generator" />
        </>
    );
}
