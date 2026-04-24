package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

const (
	vapidPublicKeyEnv   = "VAPID_PUBLIC_KEY"
	vapidPrivateKeyEnv  = "VAPID_PRIVATE_KEY"
	vapidSubjectEnv     = "VAPID_SUBJECT"
	defaultVAPIDSubject = "https://1time.io"

	maxPushEndpointLen = 4096
	maxPushKeyLen      = 512
	webPushTTLSeconds  = 86400
	webPushTimeout     = 10 * time.Second
)

type PushSubscription struct {
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

func parsePushSubscriptionField(raw string) (*PushSubscription, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}

	var sub PushSubscription
	if err := json.Unmarshal([]byte(raw), &sub); err != nil {
		return nil, err
	}

	return validatePushSubscription(&sub)
}

func validatePushSubscription(sub *PushSubscription) (*PushSubscription, error) {
	if sub == nil {
		return nil, nil
	}

	normalized := &PushSubscription{
		Endpoint: strings.TrimSpace(sub.Endpoint),
		P256dh:   strings.TrimSpace(sub.P256dh),
		Auth:     strings.TrimSpace(sub.Auth),
	}

	if normalized.Endpoint == "" || normalized.P256dh == "" || normalized.Auth == "" {
		return nil, fmt.Errorf("missing required push subscription fields")
	}
	if len(normalized.Endpoint) > maxPushEndpointLen ||
		len(normalized.P256dh) > maxPushKeyLen ||
		len(normalized.Auth) > maxPushKeyLen {
		return nil, fmt.Errorf("push subscription exceeds length limit")
	}
	if !strings.HasPrefix(normalized.Endpoint, "https://") {
		return nil, fmt.Errorf("push endpoint must start with https://")
	}
	if strings.ContainsAny(normalized.P256dh, " \t\r\n") || strings.ContainsAny(normalized.Auth, " \t\r\n") {
		return nil, fmt.Errorf("push subscription keys must be base64url")
	}
	if _, err := base64.RawURLEncoding.DecodeString(normalized.P256dh); err != nil {
		return nil, fmt.Errorf("push subscription keys must be base64url")
	}
	if _, err := base64.RawURLEncoding.DecodeString(normalized.Auth); err != nil {
		return nil, fmt.Errorf("push subscription keys must be base64url")
	}

	return normalized, nil
}

func logWebPushConfig() {
	publicKey, privateKey, subject := getWebPushConfig()
	if publicKey == "" && privateKey == "" && subject == "" {
		log.Printf("web push disabled: set %s, %s, and %s to send read notifications", vapidPublicKeyEnv, vapidPrivateKeyEnv, vapidSubjectEnv)
		return
	}
	if publicKey == "" || privateKey == "" {
		log.Printf("web push disabled: %s and %s must be configured together", vapidPublicKeyEnv, vapidPrivateKeyEnv)
	}
}

func sendReadNotificationAsync(sub *PushSubscription) {
	if sub == nil {
		return
	}
	if !isWebPushConfigured() {
		return
	}

	subCopy := *sub
	go func() {
		if err := sendReadNotification(&subCopy); err != nil {
			log.Printf("web push notification error: %v", err)
		}
	}()
}

func isWebPushConfigured() bool {
	publicKey, privateKey, subject := getWebPushConfig()
	return publicKey != "" && privateKey != "" && subject != ""
}

func getFrontendVAPIDPublicKey() string {
	publicKey, _, _ := getWebPushConfig()
	if !isWebPushConfigured() {
		return ""
	}
	return publicKey
}

func getWebPushConfig() (publicKey string, privateKey string, subject string) {
	subject = normalizeVAPIDSubject(strings.TrimSpace(os.Getenv(vapidSubjectEnv)))
	if subject == "" {
		subject = defaultVAPIDSubject
	}
	return strings.TrimSpace(os.Getenv(vapidPublicKeyEnv)),
		strings.TrimSpace(os.Getenv(vapidPrivateKeyEnv)),
		subject
}

func normalizeVAPIDSubject(subject string) string {
	if strings.HasPrefix(strings.ToLower(subject), "mailto:") {
		return subject[len("mailto:"):]
	}
	return subject
}

func sendReadNotification(sub *PushSubscription) error {
	publicKey, privateKey, subject := getWebPushConfig()
	payload, err := json.Marshal(struct{}{})
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), webPushTimeout)
	defer cancel()

	resp, err := webpush.SendNotificationWithContext(ctx, payload, &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			P256dh: sub.P256dh,
			Auth:   sub.Auth,
		},
	}, &webpush.Options{
		Subscriber:      subject,
		TTL:             webPushTTLSeconds,
		Urgency:         webpush.UrgencyNormal,
		VAPIDPublicKey:  publicKey,
		VAPIDPrivateKey: privateKey,
	})
	if err != nil {
		if DEBUG {
			log.Printf("web push transport error for %s: %v", sub.Endpoint, err)
		}
		return err
	}
	if resp == nil {
		if DEBUG {
			log.Printf("web push nil response for %s", sub.Endpoint)
		}
		return nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if DEBUG {
		log.Printf("web push response for %s: status=%d body=%q", sub.Endpoint, resp.StatusCode, string(body))
	}

	if resp.StatusCode == http.StatusGone {
		return nil
	}
	if resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("web push response status %d", resp.StatusCode)
	}

	return nil
}
