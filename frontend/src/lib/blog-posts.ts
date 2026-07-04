import bitwarden_send_alternativeHtml from '../content/blog/bitwarden-send-alternative.html?raw';
import database_password_securityHtml from '../content/blog/database-password-security.html?raw';
import firefox_send_alternativeHtml from '../content/blog/firefox-send-alternative.html?raw';
import hkdf_key_derivation_explainedHtml from '../content/blog/hkdf-key-derivation-explained.html?raw';
import how_to_send_passwords_over_emailHtml from '../content/blog/how-to-send-passwords-over-email.html?raw';
import how_to_share_api_keysHtml from '../content/blog/how-to-share-api-keys.html?raw';
import how_to_share_passwords_securelyHtml from '../content/blog/how-to-share-passwords-securely.html?raw';
import how_to_share_wifi_passwordHtml from '../content/blog/how-to-share-wifi-password.html?raw';
import is_slack_safe_for_passwordsHtml from '../content/blog/is-slack-safe-for-passwords.html?raw';
import onetimesecret_alternativeHtml from '../content/blog/onetimesecret-alternative.html?raw';
import password_for_crypto_walletHtml from '../content/blog/password-for-crypto-wallet.html?raw';
import password_pusher_alternativeHtml from '../content/blog/password-pusher-alternative.html?raw';
import privnote_alternativeHtml from '../content/blog/privnote-alternative.html?raw';
import quantum_safe_password_sharingHtml from '../content/blog/quantum-safe-password-sharing.html?raw';
import secure_home_wifi_setupHtml from '../content/blog/secure-home-wifi-setup.html?raw';
import self_destructing_messages_explainedHtml from '../content/blog/self-destructing-messages-explained.html?raw';
import share_secrets_from_terminalHtml from '../content/blog/share-secrets-from-terminal.html?raw';
import stop_sending_passwords_over_slackHtml from '../content/blog/stop-sending-passwords-over-slack.html?raw';
import strong_email_passwordHtml from '../content/blog/strong-email-password.html?raw';
import team_password_sharingHtml from '../content/blog/team-password-sharing.html?raw';

export interface BlogPost {
    slug: string;
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    ogImageAlt: string;
    tag: string;
    heading: string;
    excerpt: string;
    meta: string;
    html: string;
    schemas: unknown[];
}

export const blogIndex = {
    "title": "Password Security Blog — Guides on Encryption and Secure Sharing | 1time.io",
    "description": "Guides on secure password sharing, self-destructing messages, and protecting sensitive data online. Learn best practices for zero-knowledge encryption.",
    "ogTitle": "Password Security Blog — Encryption and Secure Sharing | 1time.io",
    "ogDescription": "Guides on secure password sharing, self-destructing messages, and protecting sensitive data online.",
    "ogImageAlt": "1time.io Blog",
    "schemas": [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "url": "https://1time.io/blog/",
            "name": "Password Security Blog — Guides on Encryption and Secure Sharing | 1time.io",
            "description": "Guides on secure password sharing, self-destructing messages, and protecting sensitive data online. Learn best practices for zero-knowledge encryption.",
            "breadcrumb": {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    }
                ]
            }
        }
    ]
};

export const blogPosts: BlogPost[] = [
    {
        "slug": "bitwarden-send-alternative",
        "title": "Bitwarden Send Alternative — Open Source, No Signup",
        "description": "Free, open-source alternative to Bitwarden Send. Browser-side encryption, one-time links, password or file sharing, self-destruct after one read.",
        "ogTitle": "Bitwarden Send Alternative — Open Source, No Signup",
        "ogDescription": "Free, open-source alternative to Bitwarden Send. Browser-side encryption, one-time links, password or file sharing, self-destruct after one read.",
        "ogImageAlt": "1time.io vs Bitwarden Send",
        "tag": "Comparison",
        "heading": "Bitwarden Send Alternative — Free, No Account Required",
        "excerpt": "Bitwarden is an excellent password manager. But when you just need to send a secret to someone quickly, Bitwarden Send adds friction. Here is how the two compare for one-time secret sharing.",
        "meta": "By Igor Ermakov · Mar 6, 2026 · 5 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Bitwarden Send Alternative — Free, No Account Required",
                "description": "Need to share a secret without a Bitwarden account? Use zero-knowledge one-time links for encrypted password and file sharing.",
                "datePublished": "2026-03-06",
                "dateModified": "2026-05-23",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/bitwarden-send-alternative/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "1time.io vs Bitwarden Send",
                        "item": "https://1time.io/blog/bitwarden-send-alternative/"
                    }
                ]
            }
        ],
        "html": bitwarden_send_alternativeHtml
    },
    {
        "slug": "database-password-security",
        "title": "Database Password Security Best Practices — 1time.io",
        "description": "Learn how to generate and manage strong database passwords. Covers PostgreSQL, MySQL, MongoDB, and Redis. Includes a free database password generator.",
        "ogTitle": "Database Password Security Best Practices",
        "ogDescription": "How to generate, store, and share database credentials securely.",
        "ogImageAlt": "Database Password Security",
        "tag": "DevOps",
        "heading": "Database Password Security Best Practices",
        "excerpt": "Your database password is the front door to your application data. Here is how to generate, store, rotate, and share database credentials without putting your data at risk.",
        "meta": "By Igor Ermakov · Feb 27, 2026 · 8 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Database Password Security Best Practices",
                "description": "Learn how to generate and manage strong database passwords for PostgreSQL, MySQL, MongoDB, and Redis.",
                "datePublished": "2026-02-27",
                "dateModified": "2026-03-21",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/database-password-security/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Database Password Security",
                        "item": "https://1time.io/blog/database-password-security/"
                    }
                ]
            }
        ],
        "html": database_password_securityHtml
    },
    {
        "slug": "firefox-send-alternative",
        "title": "Firefox Send Alternative (2026) — Open Source, No Signup",
        "description": "Firefox Send alternative for encrypted one-time file sharing. Encrypted in your browser, one-time download links, up to 10 MB, no signup, open source.",
        "ogTitle": "Firefox Send Alternative (2026) — Open Source, No Signup",
        "ogDescription": "Firefox Send alternative for encrypted one-time file sharing. Encrypted in your browser, one-time download links, up to 10 MB, no signup, open source.",
        "ogImageAlt": "Firefox Send Alternative — 1time.io",
        "tag": "Comparison",
        "heading": "Best Firefox Send Alternative — Free & Self-Hostable",
        "excerpt": "Firefox Send was one of the best ways to share files securely. Mozilla shut it down in 2020. Here is what happened, what the alternatives look like, and why we built a replacement.",
        "meta": "By Igor Ermakov · Apr 4, 2026 · 6 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Best Firefox Send Alternative — Free & Self-Hostable",
                "description": "Firefox Send is gone. Share encrypted files with zero-knowledge one-time links. Free, open source, no signup, and self-hostable.",
                "datePublished": "2026-04-04",
                "dateModified": "2026-05-23",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/firefox-send-alternative/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Firefox Send Alternative",
                        "item": "https://1time.io/blog/firefox-send-alternative/"
                    }
                ]
            }
        ],
        "html": firefox_send_alternativeHtml
    },
    {
        "slug": "hkdf-key-derivation-explained",
        "title": "What Is HKDF? Key Derivation Explained in Plain English",
        "description": "HKDF derives multiple secure keys from one master secret. Used by Signal, TLS, and 1time.io to separate encryption keys from auth tokens.",
        "ogTitle": "What Is HKDF? Key Derivation Explained in Plain English",
        "ogDescription": "HKDF derives multiple secure keys from one master secret. Used by Signal, TLS, and 1time.io to separate encryption keys from auth tokens.",
        "ogImageAlt": "HKDF Key Derivation Explained",
        "tag": "How It Works",
        "heading": "What Is HKDF and Why We Use It for End-to-End Encryption",
        "excerpt": "We recently upgraded 1time.io from simple SHA-256 hashing to HKDF-based key derivation. Here is what that means in plain language, why it matters, and how it makes your secrets safer.",
        "meta": "By Igor Ermakov · Mar 21, 2026 · 8 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "What Is HKDF and Why We Use It for End-to-End Encryption",
                "description": "A plain-language explanation of HKDF and how 1time.io uses it to separate encryption keys from server-side auth tokens.",
                "datePublished": "2026-03-21",
                "dateModified": "2026-05-23",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/hkdf-key-derivation-explained/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "HKDF Key Derivation Explained",
                        "item": "https://1time.io/blog/hkdf-key-derivation-explained/"
                    }
                ]
            }
        ],
        "html": hkdf_key_derivation_explainedHtml
    },
    {
        "slug": "how-to-send-passwords-over-email",
        "title": "How to Send Passwords Securely Over Email — 1time.io",
        "description": "Learn why emailing passwords is dangerous and discover safe alternatives. Use encrypted one-time links to share passwords over email without exposing them.",
        "ogTitle": "How to Send Passwords Securely Over Email",
        "ogDescription": "Email stores messages forever. Here is how to share passwords over email without the risk.",
        "ogImageAlt": "How to Send Passwords Over Email",
        "tag": "Guide",
        "heading": "How to Send Passwords Securely Over Email",
        "excerpt": "Email is the most common way people share passwords. It is also one of the worst. Here is why, and what to do instead.",
        "meta": "By Igor Ermakov · Dec 22, 2025 · 6 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "How to Send Passwords Securely Over Email",
                "description": "Learn why emailing passwords is dangerous and discover safe alternatives. Use encrypted one-time links to share passwords over email without exposing them.",
                "datePublished": "2025-12-22",
                "dateModified": "2026-03-19",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/how-to-send-passwords-over-email/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "How to Send Passwords Over Email",
                        "item": "https://1time.io/blog/how-to-send-passwords-over-email/"
                    }
                ]
            }
        ],
        "html": how_to_send_passwords_over_emailHtml
    },
    {
        "slug": "how-to-share-api-keys",
        "title": "How to Share API Keys Securely with Your Team — 1time.io",
        "description": "Learn how to share API keys, tokens, and secrets with developers safely. Stop pasting credentials in Slack and use encrypted one-time links instead.",
        "ogTitle": "How to Share API Keys Securely with Your Team",
        "ogDescription": "API keys in Slack channels are a security disaster. Here is the safe way to share credentials with developers.",
        "ogImageAlt": "How to Share API Keys Securely",
        "tag": "Guide",
        "heading": "How to Share API Keys Securely with Your Team",
        "excerpt": "Every developer has done it: pasted an API key into Slack, a GitHub issue, or an email. Here is why that is a serious risk and how to share credentials safely.",
        "meta": "By Igor Ermakov · Jan 13, 2026 · 7 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "How to Share API Keys Securely with Your Team",
                "description": "Learn how to share API keys, tokens, and secrets with developers safely. Stop pasting credentials in Slack and use encrypted one-time links instead.",
                "datePublished": "2026-01-13",
                "dateModified": "2026-03-20",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/how-to-share-api-keys/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "How to Share API Keys Securely",
                        "item": "https://1time.io/blog/how-to-share-api-keys/"
                    }
                ]
            }
        ],
        "html": how_to_share_api_keysHtml
    },
    {
        "slug": "how-to-share-passwords-securely",
        "title": "How to Share Passwords Securely with Your Team — 1time.io",
        "description": "Learn why sharing passwords via Slack, email, or spreadsheets is dangerous and discover secure alternatives like encrypted one-time links, password managers, and more.",
        "ogTitle": "How to Share Passwords Securely with Your Team",
        "ogDescription": "Stop sharing passwords over Slack and email. Learn the safe alternatives for teams.",
        "ogImageAlt": "How to Share Passwords Securely",
        "tag": "Guide",
        "heading": "How to Share Passwords Securely with Your Team",
        "excerpt": "Slack DMs, emails, and spreadsheets are the most common ways teams share passwords. They are also the least secure. Here is what to do instead.",
        "meta": "By Igor Ermakov · Dec 1, 2025 · 7 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "How to Share Passwords Securely with Your Team",
                "description": "Learn why sharing passwords via Slack, email, or spreadsheets is dangerous and discover secure alternatives like encrypted one-time links, password managers, and more.",
                "datePublished": "2025-12-01",
                "dateModified": "2026-03-18",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/how-to-share-passwords-securely/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "How to Share Passwords Securely",
                        "item": "https://1time.io/blog/how-to-share-passwords-securely/"
                    }
                ]
            }
        ],
        "html": how_to_share_passwords_securelyHtml
    },
    {
        "slug": "how-to-share-wifi-password",
        "title": "How to Share Your WiFi Password Securely — 1time.io",
        "description": "Learn the safest ways to share your WiFi password with guests, Airbnb visitors, and coworkers without exposing your network to security risks.",
        "ogTitle": "How to Share Your WiFi Password Securely",
        "ogDescription": "Share WiFi credentials safely with guests and visitors. Avoid writing passwords on sticky notes.",
        "ogImageAlt": "How to Share WiFi Password Securely",
        "tag": "Guide",
        "heading": "How to Share Your WiFi Password Securely",
        "excerpt": "Whether you are hosting guests, running an Airbnb, or onboarding office visitors, sharing WiFi passwords the wrong way can compromise your entire network.",
        "meta": "By Igor Ermakov · Feb 5, 2026 · 5 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "How to Share Your WiFi Password Securely",
                "description": "Learn the safest ways to share your WiFi password with guests, Airbnb visitors, and coworkers without exposing your network to security risks.",
                "datePublished": "2026-02-05",
                "dateModified": "2026-03-20",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/how-to-share-wifi-password/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "How to Share WiFi Password",
                        "item": "https://1time.io/blog/how-to-share-wifi-password/"
                    }
                ]
            }
        ],
        "html": how_to_share_wifi_passwordHtml
    },
    {
        "slug": "is-slack-safe-for-passwords",
        "title": "Is Slack Safe for Sharing Passwords? (No, and Here Is Why) — 1time.io",
        "description": "Slack stores all messages indefinitely and admins can read DMs. Learn why Slack is dangerous for sharing passwords and what secure alternatives exist.",
        "ogTitle": "Is Slack Safe for Sharing Passwords?",
        "ogDescription": "Slack DMs are not private. Admins can read them, messages are stored forever, and breaches expose everything.",
        "ogImageAlt": "Is Slack Safe for Passwords",
        "tag": "Security",
        "heading": "Is Slack Safe for Sharing Passwords? (No, and Here Is Why)",
        "excerpt": "You probably share passwords over Slack DMs. So does everyone else. Here is why that is a serious security risk and what to do instead.",
        "meta": "By Igor Ermakov · Dec 29, 2025 · 6 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Is Slack Safe for Sharing Passwords? (No, and Here Is Why)",
                "description": "Slack stores all messages indefinitely and admins can read DMs. Learn why Slack is dangerous for sharing passwords and what secure alternatives exist.",
                "datePublished": "2025-12-29",
                "dateModified": "2026-03-19",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/is-slack-safe-for-passwords/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Is Slack Safe for Passwords?",
                        "item": "https://1time.io/blog/is-slack-safe-for-passwords/"
                    }
                ]
            }
        ],
        "html": is_slack_safe_for_passwordsHtml
    },
    {
        "slug": "onetimesecret-alternative",
        "title": "1time.io vs OneTimeSecret — An Honest, Transparent Comparison",
        "description": "An honest, transparent comparison between 1time.io and OneTimeSecret (onetimesecret.com). Compare encryption, privacy, features, pricing, and open-source status side by side.",
        "ogTitle": "1time.io vs OneTimeSecret — A Transparent Comparison",
        "ogDescription": "Side-by-side comparison of two one-time secret sharing tools. Encryption, privacy, features, and pricing.",
        "ogImageAlt": "1time.io vs OneTimeSecret",
        "tag": "Comparison",
        "heading": "1time.io vs OneTimeSecret — A Transparent Comparison",
        "excerpt": "OneTimeSecret is the most well-known one-time secret sharing tool. We built 1time.io to address what we see as gaps in its approach. Here is an honest comparison — where we are better, where we are similar, and where OneTimeSecret has the edge.",
        "meta": "By Igor Ermakov · Updated Apr 17, 2026 · 5 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "1time.io vs OneTimeSecret — A Transparent Comparison",
                "description": "An honest, transparent comparison between 1time.io and OneTimeSecret (onetimesecret.com). Compare encryption, privacy, features, pricing, and open-source status side by side.",
                "datePublished": "2025-12-15",
                "dateModified": "2026-04-17",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/onetimesecret-alternative/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "1time.io vs OneTimeSecret",
                        "item": "https://1time.io/blog/onetimesecret-alternative/"
                    }
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "What is the difference between 1time.io and OneTimeSecret?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "The fundamental difference is where encryption happens. OneTimeSecret encrypts secrets on its server — meaning the server receives your plaintext before encrypting it, so the operator can read your secrets. 1time.io encrypts secrets in your browser using AES-GCM before anything leaves your device. The server only ever receives ciphertext it cannot decrypt. Both are open source and offer self-destructing links with no account required."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Does OneTimeSecret use end-to-end encryption?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "No. OneTimeSecret uses server-side encryption, not end-to-end encryption. Your secret is sent in plaintext over HTTPS to the OneTimeSecret server, where it is encrypted and stored. The server has access to your plaintext during this process. 1time.io uses true end-to-end encryption — the secret is encrypted locally in your browser and the server never sees the plaintext."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Can the OneTimeSecret server read my secrets?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Yes, technically. Because OneTimeSecret encrypts secrets server-side, the server receives your plaintext before encrypting it. This means the operator, anyone with server access, or anyone with a legal order could access your unencrypted secrets. With 1time.io the server is cryptographically unable to read your data — encryption happens in the browser and the decryption key lives only in the URL fragment, which is never sent to the server."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Is 1time.io free compared to OneTimeSecret?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "1time.io is completely free with no paid tiers, no feature limits, and no character restrictions. OneTimeSecret is also free for basic use, though longer expiry windows (up to 30 days) require a paid plan — the free tier caps at 14 days. 1time.io supports expiry from 1 to 30 days on a single free tier with no account required."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Is 1time.io open source like OneTimeSecret?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Yes. Both 1time.io and OneTimeSecret are open source. 1time.io is MIT licensed and the full source code — including the encryption protocol — is available on GitHub. You can verify the encryption implementation, self-host the entire stack, or contribute to the project."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Which is better for developer automation: 1time.io or OneTimeSecret?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "OneTimeSecret offers a server-side REST API, but because secrets are sent in plaintext to the server, the automation is not zero-knowledge. 1time.io offers a first-party CLI (`npm install -g @1time/cli`) that preserves end-to-end encryption: `printf \"$SECRET\" | 1time send`. The CLI also supports file sending and can be pointed at a self-hosted instance. For pipelines that require genuine zero-knowledge secret sharing, 1time.io is the better choice."
                        }
                    }
                ]
            }
        ],
        "html": onetimesecret_alternativeHtml
    },
    {
        "slug": "password-for-crypto-wallet",
        "title": "How to Create a Strong Password for Your Crypto Wallet — 1time.io",
        "description": "Learn why crypto wallets need the strongest passwords possible and how to generate one that resists brute-force attacks. Includes a free crypto-grade password generator.",
        "ogTitle": "How to Create a Strong Password for Your Crypto Wallet",
        "ogDescription": "Why crypto wallets need the strongest passwords and how to generate one.",
        "ogImageAlt": "Crypto Wallet Password Generator",
        "tag": "Security",
        "heading": "How to Create a Strong Password for Your Crypto Wallet",
        "excerpt": "Your crypto wallet password is the last line of defense between your assets and an attacker. A weak one can be cracked in hours. Here is how to make one that cannot.",
        "meta": "By Igor Ermakov · Mar 14, 2026 · 6 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "How to Create a Strong Password for Your Crypto Wallet",
                "description": "Learn why crypto wallets need the strongest passwords possible and how to generate one that resists brute-force attacks.",
                "datePublished": "2026-03-14",
                "dateModified": "2026-03-21",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/password-for-crypto-wallet/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Crypto Wallet Password",
                        "item": "https://1time.io/blog/password-for-crypto-wallet/"
                    }
                ]
            }
        ],
        "html": password_for_crypto_walletHtml
    },
    {
        "slug": "password-pusher-alternative",
        "title": "Password Pusher Alternative — Open Source, No Signup",
        "description": "Free, open-source alternative to Password Pusher. Browser-side AES-256 encryption, one-time links that self-destruct after a single read. No signup.",
        "ogTitle": "Password Pusher Alternative — Open Source, No Signup",
        "ogDescription": "Free, open-source alternative to Password Pusher. Browser-side AES-256 encryption, one-time links that self-destruct after a single read. No signup.",
        "ogImageAlt": "1time.io vs Password Pusher",
        "tag": "Comparison",
        "heading": "Password Pusher Alternative — Zero-Knowledge & Free",
        "excerpt": "Password Pusher (pwpush.com) is a popular open-source tool for sharing passwords through expiring links. Here is how it compares to 1time.io in terms of encryption, privacy, and everyday usability.",
        "meta": "By Igor Ermakov · Jan 29, 2026 · 5 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Password Pusher Alternative — Zero-Knowledge & Free",
                "description": "Compare Password Pusher with 1time.io. Share passwords using browser-side encryption, one-time links, no signup, and open-source code.",
                "datePublished": "2026-01-29",
                "dateModified": "2026-05-23",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/password-pusher-alternative/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "1time.io vs Password Pusher",
                        "item": "https://1time.io/blog/password-pusher-alternative/"
                    }
                ]
            }
        ],
        "html": password_pusher_alternativeHtml
    },
    {
        "slug": "privnote-alternative",
        "title": "1time.io vs Privnote — Encrypted Alternative — 1time.io",
        "description": "Compare 1time.io and Privnote for self-destructing messages. Learn why Privnote lacks end-to-end encryption and what that means for your secrets.",
        "ogTitle": "1time.io vs Privnote — Why Encryption Matters",
        "ogDescription": "Privnote deletes messages but does not encrypt them end-to-end. Here is why that matters.",
        "ogImageAlt": "1time.io vs Privnote",
        "tag": "Comparison",
        "heading": "1time.io vs Privnote — Why Encryption Matters",
        "excerpt": "Privnote is one of the oldest self-destructing message tools. But deleting a message after reading is only half the equation. If the server can read your message in the first place, is it really private?",
        "meta": "By Igor Ermakov · Updated Apr 17, 2026 · 5 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "1time.io vs Privnote — Why Encryption Matters",
                "description": "Compare 1time.io and Privnote for self-destructing messages. Learn why Privnote lacks end-to-end encryption and what that means for your secrets.",
                "datePublished": "2026-01-05",
                "dateModified": "2026-04-17",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/privnote-alternative/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "1time.io vs Privnote",
                        "item": "https://1time.io/blog/privnote-alternative/"
                    }
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "What is the difference between Privnote and 1time.io?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Both Privnote and 1time.io encrypt in the browser and store the decryption key only in the URL fragment — the server never sees your plaintext. The key difference is the quality of the cryptographic implementation. Privnote uses Gibberish-AES, an unmaintained library from 2012 that implements AES-CBC with MD5 key derivation. 1time.io uses AES-GCM (authenticated encryption) with HKDF key derivation via the native Web Crypto API. Additionally, 1time.io is fully open source, has no ads, and includes a password generator, file sharing, and a CLI."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Does Privnote use end-to-end encryption?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Yes, Privnote encrypts notes client-side before sending them to the server. However, the encryption library they use — Gibberish-AES — implements AES-CBC mode with MD5 for key derivation. AES-CBC provides no authentication, meaning an attacker who can modify ciphertext in transit could alter the decrypted message without detection. 1time.io uses AES-GCM, which is an authenticated encryption scheme that detects any tampering with the ciphertext."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Why does the encryption algorithm matter when comparing Privnote and 1time.io?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Privnote uses AES-CBC, which encrypts data but provides no integrity guarantee — a modified ciphertext will silently decrypt to garbled output, and certain attack classes (like padding oracle attacks) are possible against CBC mode. It also uses MD5 for key derivation, a hash function not designed for this purpose. 1time.io uses AES-GCM, which is authenticated encryption: any tampering with the ciphertext is detected and the decryption fails. It uses HKDF for key derivation, which is specifically designed for this role."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Is Privnote open source?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "No. Privnote is closed source — you cannot audit their full implementation. Their JavaScript is inspectable in the browser, which is how we can see they use the Gibberish-AES library, but there is no public repository to verify or audit the complete system. 1time.io is fully open source under the MIT license on GitHub — the entire encryption protocol, client, server, and CLI are publicly auditable."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Does Privnote show ads?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Yes. Privnote displays ads and uses third-party non-functional cookies for commercial purposes, as stated in their privacy policy. 1time.io has no ads, no tracking, and no third-party cookies."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Does Privnote have file sharing or a password generator?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "No. Privnote only supports text notes. 1time.io includes a built-in password generator, a diceware passphrase generator, encrypted one-time file sharing, and a CLI for terminal and CI/CD workflows — all using the same zero-knowledge architecture."
                        }
                    }
                ]
            }
        ],
        "html": privnote_alternativeHtml
    },
    {
        "slug": "quantum-safe-password-sharing",
        "title": "Quantum-Safe Password Sharing — Why 1time.io Uses No RSA or ECC | 1time.io",
        "description": "Quantum-safe password sharing using pure symmetric encryption (AES-256-GCM + HKDF) — no RSA or ECC for a quantum computer to break. Free, no signup.",
        "ogTitle": "Quantum-Safe Password Sharing — No RSA, No ECC, No Problem",
        "ogDescription": "Quantum-safe password sharing using pure symmetric encryption (AES-256-GCM + HKDF) — no RSA or ECC for a quantum computer to break. Free, no signup.",
        "ogImageAlt": "Quantum-Safe Password Sharing — 1time.io",
        "tag": "Security",
        "heading": "No RSA, No ECC, No Problem: Why 1time.io Is Already Quantum-Safe",
        "excerpt": "Quantum computers will break RSA and elliptic-curve cryptography. Most password sharing tools depend on both. 1time.io uses neither — making it a quantum-safe one-time link by design, not by accident.",
        "meta": "By Igor Ermakov · Apr 1, 2026 · 7 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Quantum-Safe Password Sharing — Why 1time.io Uses No RSA or ECC",
                "description": "Most secret sharing tools rely on RSA or ECC, which quantum computers will break. 1time.io uses pure symmetric encryption (AES-256-GCM + HKDF) — quantum-safe password sharing with no asymmetric cryptography to attack.",
                "datePublished": "2026-04-01",
                "dateModified": "2026-04-01",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/quantum-safe-password-sharing/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Quantum-Safe Password Sharing",
                        "item": "https://1time.io/blog/quantum-safe-password-sharing/"
                    }
                ]
            }
        ],
        "html": quantum_safe_password_sharingHtml
    },
    {
        "slug": "secure-home-wifi-setup",
        "title": "How to Set Up a Secure Home WiFi Network — 1time.io",
        "description": "Step-by-step guide to securing your home WiFi network. Covers strong passwords, WPA3, guest networks, and router settings. Includes a free WiFi password generator.",
        "ogTitle": "How to Set Up a Secure Home WiFi Network",
        "ogDescription": "Step-by-step guide to WiFi security: strong passwords, WPA3, and router hardening.",
        "ogImageAlt": "Secure Home WiFi Setup",
        "tag": "Guide",
        "heading": "How to Set Up a Secure Home WiFi Network",
        "excerpt": "Your WiFi password is the front door to your home network. Every device — laptop, phone, smart TV, baby monitor — connects through it. Here is how to lock it down properly.",
        "meta": "By Igor Ermakov · Feb 20, 2026 · 7 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "How to Set Up a Secure Home WiFi Network",
                "description": "Step-by-step guide to securing your home WiFi network with strong passwords, WPA3, and proper router configuration.",
                "datePublished": "2026-02-20",
                "dateModified": "2026-03-21",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/secure-home-wifi-setup/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Secure Home WiFi Setup",
                        "item": "https://1time.io/blog/secure-home-wifi-setup/"
                    }
                ]
            }
        ],
        "html": secure_home_wifi_setupHtml
    },
    {
        "slug": "self-destructing-messages-explained",
        "title": "Self-Destructing Links: How They Work + Free Generator | 1time.io",
        "description": "Create a self-destructing link that deletes itself after one read. Free, end-to-end encrypted, zero-knowledge. Learn how self-destruct links work and generate one instantly.",
        "ogTitle": "Self-Destructing Links: How They Work + Free Generator",
        "ogDescription": "Generate a free self-destructing link. End-to-end encrypted, one-time access, permanently deleted after reading.",
        "ogImageAlt": "Self-Destructing Link Generator",
        "tag": "How It Works",
        "heading": "Self-Destructing Links: How They Work + Free Generator",
        "excerpt": "A self-destructing link reveals a secret once, then deletes itself forever. Generate one below — or read on to learn exactly how self-destruct links work under the hood.",
        "meta": "By Igor Ermakov · Updated Apr 14, 2026 · 6 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Self-Destructing Links: How They Work + Free Generator",
                "description": "Create a self-destructing link that deletes itself after one read. Learn how self-destruct links work and generate one for free.",
                "datePublished": "2025-12-08",
                "dateModified": "2026-04-14",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/self-destructing-messages-explained/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Self-Destructing Links: How They Work",
                        "item": "https://1time.io/blog/self-destructing-messages-explained/"
                    }
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "What is a self-destructing link?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "A self-destructing link is a URL that reveals its content exactly once. The moment the recipient opens it, the underlying data is permanently deleted from the server and the same link becomes a dead 404 forever after. 1time.io generates free self-destructing links that are end-to-end encrypted in your browser."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How do I create a self-destructing link?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Paste your secret into the form at the top of this page, click the button to generate a one-time link, and copy it. Share the link with your recipient. When they open it, the secret is decrypted in their browser and the server immediately deletes the encrypted data. No signup, no account, free."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How long does a self-destructing link last?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "A self-destructing link expires the instant it is read — that is the \"self-destruct\" trigger. As a safety net, unread links also auto-expire after a configurable window (1 to 30 days on 1time.io) so nothing sits on the server forever if the recipient never opens it."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Is the self-destructing link generator free?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Yes. 1time.io is free and open source (MIT licensed). There is no paid tier, no signup, no usage limits for normal sharing, and no ads. You can also self-host the source code from GitHub if you want full control."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Can a self-destructing link be recovered after it is read?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "No. Once the recipient opens the link, the ciphertext is deleted from the server and cannot be restored. There is no admin backdoor, no backup, and no recovery path — even we cannot retrieve it. If you lose access, you have to create a new link."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Are self-destructing links really deleted or just hidden?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "On 1time.io, the encrypted blob is deleted from the database at the moment of first read — not hidden, not archived, not flagged. The server never saw the plaintext in the first place because encryption happens in your browser and the decryption key lives only in the URL fragment, which is never transmitted to the server."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Can I send a self-destructing link from the terminal?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Yes. 1time.io ships a CLI you can install with `npm install -g @1time/cli`. Use `printf 'secret' | 1time send` to generate a self-destructing link directly from your shell or a CI/CD pipeline."
                        }
                    }
                ]
            }
        ],
        "html": self_destructing_messages_explainedHtml
    },
    {
        "slug": "share-secrets-from-terminal",
        "title": "How to Share Secrets from the Terminal with End-to-End Encryption — 1time.io",
        "description": "Use the 1time CLI to share passwords, API keys, and tokens from your terminal as encrypted one-time links. No browser needed — pipe in a secret, get a self-destructing link.",
        "ogTitle": "How to Share Secrets from the Terminal with End-to-End Encryption",
        "ogDescription": "Share passwords and API keys from your terminal. Pipe in a secret, get an encrypted self-destructing link. No browser needed.",
        "ogImageAlt": "Share Secrets from the Terminal",
        "tag": "DevOps",
        "heading": "How to Share Secrets from the Terminal with End-to-End Encryption",
        "excerpt": "You are in a terminal. You need to send a database password to a colleague. Opening a browser feels wrong. Pasting it into Slack feels worse. Here is a better way.",
        "meta": "By Igor Ermakov · Mar 22, 2026 · 5 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "How to Share Secrets from the Terminal with End-to-End Encryption",
                "description": "Use the 1time CLI to share passwords, API keys, and tokens from your terminal as encrypted one-time links. No browser needed.",
                "datePublished": "2026-03-22",
                "dateModified": "2026-03-22",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/share-secrets-from-terminal/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Share Secrets from the Terminal",
                        "item": "https://1time.io/blog/share-secrets-from-terminal/"
                    }
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "How do I share a password from the terminal securely?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Install the 1time CLI with npm install -g @1time/cli, then pipe your password: printf 'my-password' | 1time send. You get an encrypted one-time link that self-destructs after being read."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Can I use 1time CLI with a self-hosted server?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Yes. Use the --host flag to point at your own instance: printf 'secret' | 1time send --host https://secrets.yourcompany.com"
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Is the 1time CLI end-to-end encrypted?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Yes. The CLI encrypts your secret locally with AES-256-GCM before sending anything to the server. The server only stores encrypted ciphertext and never sees the plaintext or decryption key."
                        }
                    }
                ]
            }
        ],
        "html": share_secrets_from_terminalHtml
    },
    {
        "slug": "stop-sending-passwords-over-slack",
        "title": "Stop Sending Passwords Over Slack: Here's What I Built Instead — 1time.io",
        "description": "I caught plaintext credentials sitting in our Slack history for months. So I built an open-source zero-knowledge secret sharing tool. Here's the full story.",
        "ogTitle": "Stop Sending Passwords Over Slack: Here's What I Built Instead",
        "ogDescription": "I caught plaintext credentials sitting in our Slack history for months. So I built an open-source secret sharing tool with real zero-knowledge encryption.",
        "ogImageAlt": "Stop Sending Passwords Over Slack",
        "tag": "DevOps",
        "heading": "Stop Sending Passwords Over Slack: Here's What I Built Instead",
        "excerpt": "I caught plaintext credentials sitting in our Slack history for months. So I built an open-source tool that encrypts secrets in the browser and destroys them after one read.",
        "meta": "By Igor Ermakov · Mar 31, 2026 · 8 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Stop Sending Passwords Over Slack: Here's What I Built Instead",
                "description": "I caught plaintext credentials sitting in our Slack history for months. So I built an open-source zero-knowledge secret sharing tool. Here's the full story.",
                "datePublished": "2026-03-31",
                "dateModified": "2026-03-31",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/stop-sending-passwords-over-slack/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Stop Sending Passwords Over Slack",
                        "item": "https://1time.io/blog/stop-sending-passwords-over-slack/"
                    }
                ]
            }
        ],
        "html": stop_sending_passwords_over_slackHtml
    },
    {
        "slug": "strong-email-password",
        "title": "How to Create a Strong Email Password — 1time.io",
        "description": "Your email password is the master key to your digital life. Learn how to create one that cannot be cracked and why it matters more than any other password you have.",
        "ogTitle": "How to Create a Strong Email Password",
        "ogDescription": "Your email is the master key to your digital life. Learn how to protect it.",
        "ogImageAlt": "Strong Email Password",
        "tag": "Security",
        "heading": "How to Create a Strong Email Password",
        "excerpt": "Your email account is the skeleton key to your entire digital life. Anyone who gets in can reset every other password you have. Here is how to protect it.",
        "meta": "By Igor Ermakov · Feb 13, 2026 · 6 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "How to Create a Strong Email Password",
                "description": "Your email password is the master key to your digital life. Learn how to create one that cannot be cracked.",
                "datePublished": "2026-02-13",
                "dateModified": "2026-03-20",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/strong-email-password/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Strong Email Password",
                        "item": "https://1time.io/blog/strong-email-password/"
                    }
                ]
            }
        ],
        "html": strong_email_passwordHtml
    },
    {
        "slug": "team-password-sharing",
        "title": "Team Password Sharing Without a Password Manager — 1time.io",
        "description": "Practical approaches to sharing passwords within a team when you do not have a password manager. Covers one-time links, secure workflows, and when to upgrade.",
        "ogTitle": "Team Password Sharing Without a Password Manager",
        "ogDescription": "How to share team credentials securely when you do not have a password manager.",
        "ogImageAlt": "Team Password Sharing",
        "tag": "Teams",
        "heading": "Team Password Sharing Without a Password Manager",
        "excerpt": "Not every team has a password manager. Not every situation justifies one. Here is how to share credentials securely with your team using tools that require zero setup.",
        "meta": "By Igor Ermakov · Updated Apr 17, 2026 · 7 min read",
        "schemas": [
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Team Password Sharing Without a Password Manager",
                "description": "Practical approaches to sharing passwords within a team when you do not have a password manager.",
                "datePublished": "2026-01-21",
                "dateModified": "2026-04-17",
                "author": {
                    "@type": "Person",
                    "name": "Igor Ermakov",
                    "url": "https://1time.io/about/"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "1time.io",
                    "url": "https://1time.io",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://1time.io/logo-512.png",
                        "width": 512,
                        "height": 512
                    }
                },
                "mainEntityOfPage": "https://1time.io/blog/team-password-sharing/",
                "image": [
                    "https://1time.io/1time-og-main.png"
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://1time.io/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Blog",
                        "item": "https://1time.io/blog/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Team Password Sharing",
                        "item": "https://1time.io/blog/team-password-sharing/"
                    }
                ]
            },
            {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "What is the safest way to share a password with a team?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "The safest way to share a password with a team is via an end-to-end encrypted one-time link. The password is encrypted in your browser before it leaves your device, and the link self-destructs after the recipient opens it — so it never sits in a chat log, email thread, or inbox. 1time.io generates these links for free with no signup required."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How do you share passwords securely without a password manager?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Without a password manager, use encrypted one-time links. Paste the password into 1time.io, generate a self-destructing link, and send it over Slack, email, or any channel. The recipient gets one chance to read it, then it is permanently deleted from the server. No account, no install, and the recipient does not need to know what tool you used."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Is it safe to send passwords over Slack or email?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "No. Slack and email store messages indefinitely — a password sent over these channels stays exposed in logs, search history, and backups long after it was needed. If either account is ever breached, those credentials are compromised. The alternative is an encrypted one-time link that self-destructs after one read and leaves no trace in any message history."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How do you share credentials with contractors who are not in your password manager?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Encrypted one-time links are the right tool for contractors and external collaborators. They do not need an account or access to your internal systems — they just click the link, copy the credential, and the link is permanently destroyed. 1time.io supports this workflow with zero setup for either party."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "What should I do when onboarding a new team member who needs credentials?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Generate each credential as a separate encrypted one-time link and send it the moment the new team member is ready to receive it. With 1time.io you can generate a strong password and create a shareable link in one step — no waiting, no plaintext in email drafts."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "What happens if a one-time link is never opened?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Unread links auto-expire after a configurable window. On 1time.io the default is 1 day, with options from 1 to 30 days. If the recipient never opens the link, the encrypted data is automatically deleted from the server when the expiry is reached — nothing persists indefinitely."
                        }
                    }
                ]
            }
        ],
        "html": team_password_sharingHtml
    },
];

export const blogPostBySlug = new Map(blogPosts.map((post) => [post.slug, post]));

function getPublishedDate(post: BlogPost): string {
    for (const schema of post.schemas) {
        if (!schema || typeof schema !== 'object') {
            continue;
        }
        const record = schema as Record<string, unknown>;
        if (record['@type'] === 'Article' && typeof record.datePublished === 'string') {
            return record.datePublished;
        }
    }
    return '';
}

export const blogIndexPosts = [...blogPosts].sort((a, b) => getPublishedDate(b).localeCompare(getPublishedDate(a)));

export function getBlogPost(slug: string): BlogPost | undefined {
    return blogPostBySlug.get(slug);
}
