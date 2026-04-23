import InlineCss from '../../components/InlineCss';
import PasswordGenerator from '../../components/PasswordGenerator';
import {absoluteUrl, siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `WiFi Password Generator — Random WPA2/WPA3 Secure Keys | ${siteHost}`,
    description: 'Generate random WPA2/WPA3 WiFi passwords — easy to type on any device, no confusing symbols. Share securely via encrypted one-time link. Free, runs in your browser.',
    alternates: { canonical: '/wifi-password-generator' },
    openGraph: {
        title: `WiFi Password Generator — Secure WPA2/WPA3 Keys | ${siteHost}`,
        description: 'Generate random WiFi passwords that are secure yet easy to type. Share via encrypted one-time link. Free, runs in your browser.',
        url: '/wifi-password-generator',
        images: [{ url: '/1time-og-main.png', width: 1200, height: 630, alt: 'WiFi Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'WiFi Password Generator',
    url: absoluteUrl('/wifi-password-generator'),
    description: 'Generate random WPA2/WPA3 WiFi passwords that are secure yet easy to type on any device. Share via encrypted one-time link. Created locally in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Works in all modern browsers.',
    inLanguage: 'en',
    isAccessibleForFree: true,
    datePublished: '2025-01-15',
    dateModified: '2026-04-10',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: 'Random WPA2/WPA3 password generation, Alphanumeric only (no confusing symbols), Adjustable length (8-128 characters), Passphrase mode, Entropy strength meter, One-click copy, Encrypted one-time sharing link, QR code sharing',
    author: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io' },
};

const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
        { '@type': 'ListItem', position: 2, name: 'WiFi Password Generator', item: 'https://1time.io/wifi-password-generator/' },
    ],
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        { '@type': 'Question', name: 'Why no symbols in WiFi passwords?', acceptedAnswer: { '@type': 'Answer', text: 'Most WiFi passwords are typed on devices with limited keyboards — smart TVs, game consoles, IoT devices. Symbols like @#$% are hard to locate on these keyboards and slow down the process. A 16-character alphanumeric password still provides about 95 bits of entropy, which is more than sufficient for WiFi security.' } },
        { '@type': 'Question', name: 'How long should a WiFi password be?', acceptedAnswer: { '@type': 'Answer', text: 'At least 12 characters, ideally 16 or more. WiFi passwords can be attacked offline (the attacker doesn\'t need to stay connected to your network), so they need more length than typical website passwords. Our default of 16 characters provides a strong security margin.' } },
        { '@type': 'Question', name: 'What is a WiFi passkey and how do I create one?', acceptedAnswer: { '@type': 'Answer', text: 'A WiFi passkey (also called a pre-shared key or PSK) is the password used to authenticate devices on your wireless network. For WPA2-Personal and WPA3-Personal, the passkey can be 8 to 63 characters. To create a strong one, use this generator to get a random 16-character password, then enter it in your router\'s wireless security settings under the passkey or pre-shared key field.' } },
        { '@type': 'Question', name: 'Does this work with WPA2 and WPA3 routers?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. WPA2 and WPA3 both accept passwords between 8 and 63 ASCII characters. This generator creates 16-character alphanumeric passwords by default, which are compatible with all WPA2 and WPA3 routers from any brand — Netgear, TP-Link, Linksys, ASUS, and others.' } },
        { '@type': 'Question', name: 'How often should I change my WiFi password?', acceptedAnswer: { '@type': 'Answer', text: 'Change it when a device is lost or stolen, when someone who knows the password no longer needs access, or if you suspect unauthorized access. For home networks with WPA3, routine changes aren\'t strictly necessary. For WPA2 networks in shared environments (offices, rentals), consider changing it every 3-6 months.' } },
        { '@type': 'Question', name: 'Can someone hack my WiFi with a strong password?', acceptedAnswer: { '@type': 'Answer', text: 'With a 16-character random password and WPA2/WPA3, brute-forcing the password is computationally infeasible. Attackers would need to exploit router firmware vulnerabilities or use social engineering instead. Keep your router firmware updated and disable WPS (WiFi Protected Setup) for best security.' } },
        { '@type': 'Question', name: 'What is the strongest type of WiFi password?', acceptedAnswer: { '@type': 'Answer', text: 'The strongest WiFi password is a randomly generated string of at least 16 alphanumeric characters used with WPA3-Personal encryption. WPA3 uses SAE (Simultaneous Authentication of Equals) which prevents offline brute-force attacks entirely. If your router only supports WPA2, use 20+ characters to compensate for the weaker key exchange protocol.' } },
        { '@type': 'Question', name: 'Is a 12-character WiFi password secure enough?', acceptedAnswer: { '@type': 'Answer', text: 'A 12-character random alphanumeric password provides about 71 bits of entropy — enough for most home networks with WPA2 or WPA3. However, if your network is a high-value target or you use WPA2 (which is vulnerable to offline attacks), we recommend 16 characters or more for a stronger security margin.' } },
        { '@type': 'Question', name: 'Can my neighbor hack my WiFi password?', acceptedAnswer: { '@type': 'Answer', text: 'If you use a weak or common password (like "password123" or your address), yes — tools like Hashcat and Aircrack-ng can crack short WiFi passwords in hours. With a random 16-character password, brute-forcing would take longer than the age of the universe. The risk shifts to router vulnerabilities and WPS exploits, so disable WPS and keep your firmware updated.' } },
        { '@type': 'Question', name: 'What is the difference between a WiFi password and a WiFi key?', acceptedAnswer: { '@type': 'Answer', text: 'They are the same thing. "WiFi password," "WiFi key," "network key," "wireless key," and "pre-shared key (PSK)" all refer to the passphrase you enter to connect a device to your wireless network. The technical term used in the WPA2/WPA3 standards is "pre-shared key" but most router interfaces label it as "password" or "passphrase."' } },
        { '@type': 'Question', name: 'What characters are allowed in a WiFi password?', acceptedAnswer: { '@type': 'Answer', text: 'WPA2 and WPA3 accept any printable ASCII character (codes 32–126) including letters, numbers, symbols, and spaces. The password must be between 8 and 63 characters. However, we recommend avoiding symbols because they are difficult to type on smart TVs, game consoles, and IoT device keyboards. A 16-character alphanumeric password is both compatible and highly secure.' } },
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
