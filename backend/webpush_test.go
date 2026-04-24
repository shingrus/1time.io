package main

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestValidatePushSubscription(t *testing.T) {
	valid := &PushSubscription{
		Endpoint: "https://updates.push.services.mozilla.com/wpush/v2/test",
		P256dh:   base64.RawURLEncoding.EncodeToString([]byte("public-key")),
		Auth:     base64.RawURLEncoding.EncodeToString([]byte("auth-token")),
	}

	if _, err := validatePushSubscription(valid); err != nil {
		t.Fatal("valid push subscription was rejected")
	}

	localDev := &PushSubscription{
		Endpoint: "https://127.0.0.1/push",
		P256dh:   valid.P256dh,
		Auth:     valid.Auth,
	}
	if _, err := validatePushSubscription(localDev); err != nil {
		t.Fatal("local HTTPS push endpoint should be accepted")
	}

	tests := []PushSubscription{
		{Endpoint: "http://updates.push.services.mozilla.com/wpush/v2/test", P256dh: valid.P256dh, Auth: valid.Auth},
		{Endpoint: valid.Endpoint, P256dh: "not base64!", Auth: valid.Auth},
		{Endpoint: valid.Endpoint, P256dh: valid.P256dh, Auth: ""},
		{Endpoint: "https://" + strings.Repeat("a", maxPushEndpointLen) + ".example/push", P256dh: valid.P256dh, Auth: valid.Auth},
	}

	for _, test := range tests {
		if _, err := validatePushSubscription(&test); err == nil {
			t.Fatalf("invalid push subscription was accepted: %+v", test)
		}
	}

	if pushSub, err := validatePushSubscription(nil); err != nil || pushSub != nil {
		t.Fatalf("nil push subscription = %+v, %v; want nil, nil", pushSub, err)
	}
}

func TestParsePushSubscriptionField(t *testing.T) {
	pushSub, err := parsePushSubscriptionField(`{
		"endpoint": "https://fcm.googleapis.com/fcm/send/test",
		"p256dh": "cHVibGlj",
		"auth": "YXV0aA"
	}`)
	if err != nil {
		t.Fatal("valid push subscription field was rejected")
	}
	if pushSub == nil || pushSub.Endpoint != "https://fcm.googleapis.com/fcm/send/test" {
		t.Fatalf("unexpected parsed push subscription: %+v", pushSub)
	}

	if pushSub, err := parsePushSubscriptionField(""); err != nil || pushSub != nil {
		t.Fatalf("empty push subscription field = %+v, %v; want nil, nil", pushSub, err)
	}

	if _, err := parsePushSubscriptionField(`{"endpoint": "https://example.com/push"}`); err == nil {
		t.Fatal("incomplete push subscription field was accepted")
	}
}
