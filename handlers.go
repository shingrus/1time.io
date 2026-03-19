package main

import (
	"encoding/json"
	//"html/template"
	"log"
	"net/http"
	"time"
)

type StoredMessage struct {
	Encrypted bool   `json:"encrypted"` // obsolete all messages are encrypted
	Message   string `json:"message"`
	HashedKey string `json:"hashedKey"`
}

//func indexHandler(w http.ResponseWriter, r *http.Request) {
//	t, err := template.ParseFiles("templates/form.html")
//	if err != nil {
//		log.Panic(err)
//	}
//	t.Execute(w, "")
//
//}

//func saveSecretHandler(w http.ResponseWriter, r *http.Request) {
//
//	if err := r.ParseForm(); err != nil {
//		log.Println(err)
//	}
//	secretMessage := r.Form.Get(secretMessageFieldName)
//
//	if secretMessage == "" {
//		http.Redirect(w, r, "/?empty", http.StatusSeeOther)
//		return
//	}
//	if len(secretMessage) > secretMessageMaxLen {
//		secretMessage = secretMessage[0:secretMessageMaxLen]
//	}
//
//	secretkey := r.Form.Get(secretKeyFieldName)
//	randKey := RandStringBytesMaskImprSrc(randKeyLen)
//
//	var duration time.Duration
//	if d := r.Form.Get("duration"); d != "" {
//		t, _ := strconv.Atoi(d)
//		duration = time.Second * time.Duration(t)
//	}
//	if duration <= 0 || duration > 86400 {
//		duration = defaultDuration * time.Second
//	}
//
//	encryptKey := secretkey + randKey
//
//	var newMessage StoredMessage
//
//	// encrypt
//
//	newkey := get32key(encryptKey)
//	newMessage.Message = encrypt([]byte(newkey), encryptKey+secretMessage)
//	newMessage.Encrypted = true
//
//	value, _ := json.Marshal(newMessage)
//	// store to storage
//
//	storeKey, err := saveToStorage(value, time.Second*duration)
//	if err != nil {
//		showError(500, "Storage error", w)
//		return
//	}
//
//	t, err := template.ParseFiles("templates/result.html")
//	if err != nil {
//		log.Panic(err)
//	}
//	linkKey := randKey + storeKey
//
//	data := struct {
//		OneTimeLink string
//		SecretKey   string
//	}{linkKey, secretkey}
//	t.Execute(w, data)
//
//}

//func viewHandler(w http.ResponseWriter, r *http.Request) {
//	key := r.URL.Path[len("/view/"):]
//	if len(key) <= randKeyLen {
//		log.Printf("Invalid  secretKey: %v", key)
//		return
//	}
//	randKey := key[:randKeyLen]
//	storeKey := key[randKeyLen:]
//	val := getMessageFromStorage(storeKey)
//	if len(val) > 0 {
//
//		var storedMessage StoredMessage
//		err := json.Unmarshal([]byte(val), &storedMessage)
//
//		if err == nil {
//			if r.Method != "POST" {
//
//				if storedMessage.Encrypted {
//					if t, err := template.ParseFiles("templates/getkeyform.html"); err != nil {
//						log.Panic(err)
//					} else {
//
//						data := struct {
//							Key string
//						}{key}
//						t.Execute(w, data)
//						return
//					}
//				} else {
//					showMessage(key, storedMessage, w)
//					return
//				}
//
//			} else {
//				r.ParseForm()
//				secretKey := r.Form.Get(secretKeyFieldName)
//				encryptKey := secretKey + randKey
//
//				keylen := len(encryptKey)
//				if keylen == 0 {
//					http.Redirect(w, r, "/view/"+key, http.StatusSeeOther)
//					return
//				}
//
//				if storedMessage.Encrypted {
//					newKey := get32key(encryptKey)
//
//					secretMessage := decrypt([]byte(newKey), storedMessage.Message)
//					if len(secretMessage) > keylen && secretMessage[0:keylen] == encryptKey {
//						storedMessage.Message = secretMessage[keylen:]
//						showMessage(key, storedMessage, w)
//						return
//					} else {
//						http.Redirect(w, r, "/view/"+key, http.StatusSeeOther)
//						return
//					}
//				} else {
//					showMessage(secretKey, storedMessage, w)
//					return
//				}
//
//			}
//		} else {
//			log.Println(err)
//		}
//
//	}
//	http.Redirect(w, r, "/", http.StatusSeeOther)
//
//}
//
//func showMessage(key string, message StoredMessage, w http.ResponseWriter) {
//	if t, err := template.ParseFiles("templates/view.html"); err != nil {
//		log.Panic(err)
//	} else {
//		dropFromStorage(key)
//		t.Execute(w, message)
//	}
//}
//
//func showError(errorStatus int, text string, w http.ResponseWriter) {
//	w.WriteHeader(errorStatus)
//	w.Write([]byte(text))
//}

/**
Json Payload should

curl -X POST -H 'content-type: application/json' 'http://localhost:8080/api/unsecSave' -d '{"secretMessage":"test Message from GO"}'

var payload struct {
		SecretMessage string `json:"secretMessage"`
		Duration      int    `json:"duration"`
	}
*/
//func apiUnsecSave(r *http.Request) (responseCode int, response []byte) {
//	responseCode = 200
//	jResponse := struct {
//		Status  string `json:"status"`
//		NewLink string `json:"newLink"`
//	}{
//		Status:  "error",
//		NewLink: "",
//	}
//	var payload struct {
//		SecretMessage string `json:"secretMessage"`
//		Duration      int    `json:"duration"`
//	}
//	if r.Method != "POST" { // unsecure for default logging etc
//		jResponse.Status = "Invalid request method."
//	} else {
//		dec := json.NewDecoder(r.Body)
//		if dec.More() {
//			err := dec.Decode(&payload)
//			if err == nil {
//				if len(payload.SecretMessage) > 0 {
//					// log.Printf("Got payload: %v\n", payload)
//
//					randKey := RandStringBytesMaskImprSrc(randKeyLen)
//
//					if payload.Duration <= 0 || payload.Duration > maxDuration {
//						payload.Duration = defaultDuration
//					}
//
//					o := openssl.New()
//
//					enc, err := o.EncryptString(randKey, payload.SecretMessage)
//					if err == nil {
//						newMessage := StoredMessage{
//							Encrypted: true,
//							Message:   string(enc),
//							HashedKey: fmt.Sprintf("%x", sha256.Sum256([]byte(randKey))),
//						}
//
//						log.Printf("paylaod -> storage: %v, Hashedkey: %v, Duration: %v\n", newMessage.Message, newMessage.HashedKey, payload.Duration)
//						valueToStore, _ := json.Marshal(newMessage)
//						storeKey, err := saveToStorage(valueToStore, time.Duration(payload.Duration)*time.Second)
//						if err == nil {
//							jResponse.NewLink = "/v/#" + randKey + storeKey
//							jResponse.Status = "ok"
//						} else {
//							log.Println(err)
//						}
//
//					} else {
//						log.Println(err)
//					}
//
//				}
//			} else {
//				log.Println(err)
//			}
//
//		}
//	}
//	response, _ = json.Marshal(jResponse)
//	return
//
//}
func apiSaveSecret(r *http.Request) (responseCode int, response []byte) {
	responseCode = 200

	jResponse := struct {
		Status string `json:"status"`
		NewId  string `json:"newId"`
	}{
		Status: "error",
		NewId:  "0",
	}

	var payload struct {
		SecretMessage string `json:"secretMessage"`
		HashedKey     string `json:"hashedKey"`
		Duration      int    `json:"duration"`
	}
	dec := json.NewDecoder(r.Body)

	if dec.More() {
		err := dec.Decode(&payload)
		if err == nil {
			if len(payload.SecretMessage) > 0 {

				newMessage := StoredMessage{
					Encrypted: true,
					Message:   payload.SecretMessage,
					HashedKey: payload.HashedKey,
				}

				if payload.Duration <= 0 || payload.Duration > maxDuration {
					payload.Duration = defaultDuration
				}

				log.Printf("paylaod -> storage: %v, Hashedkey: %v, Duration: %v\n", payload.SecretMessage, payload.HashedKey, payload.Duration)
				valueToStore, _ := json.Marshal(newMessage)
				storeKey, err := saveToStorage(valueToStore, time.Duration(payload.Duration)*time.Second)
				if err == nil {
					jResponse.NewId = storeKey
					jResponse.Status = "ok"
				} else {
					log.Println(err)
				}

			}
		} else {
			log.Println(err)
		}
		// log.Printf("Got payload: %v\n", payload)
	}
	response, _ = json.Marshal(jResponse)
	return
}

/*
*
Good to have this api for everyone

func apiGetRandomPass(r *http.Request) (responseCode int, response []byte) {

}
*/
func apiGetMessage(r *http.Request) (responseCode int, response []byte) {
	responseCode = 200

	jResponse := struct {
		Status         string `json:"status"`
		CryptedMessage string `json:"cryptedMessage"`
	}{
		Status: "error",
		// NewId:strconv.FormatInt(32, 16)
		CryptedMessage: "0",
	}

	var payload struct {
		Id        string `json:"id"`
		HashedKey string `json:"hashedKey"`
	}
	dec := json.NewDecoder(r.Body)

	if dec.More() {
		err := dec.Decode(&payload)
		if err == nil {
			if len(payload.Id) > 0 && len(payload.HashedKey) > 0 {
				log.Printf("payload <- storage: %v, %v\n", payload.Id, payload.HashedKey)
				storedMessage, status, err := consumeMessageFromStorage(payload.Id, payload.HashedKey)
				if err == nil {
					switch status {
					case "ok":
						jResponse.Status = "ok"
						jResponse.CryptedMessage = storedMessage.Message
					case "wrong key":
						jResponse.Status = "wrong key"
						log.Println("Hashes aren't equal")
					case "no message":
						jResponse.Status = "no message"
					}
				} else {
					log.Println(err)
				}

			}
		}
	}
	response, _ = json.Marshal(jResponse)
	return
}

func apiHandler(w http.ResponseWriter, r *http.Request) {
	responseCode := 400
	var response []byte
	w.Header().Set("Content-Type", "application/json")

	if DEBUG {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "	content-type, accept")
	}

	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		responseCode = http.StatusMethodNotAllowed
		jResponse := struct {
			Code        int    `json:"code"`
			Description string `json:"description"`
		}{responseCode, "Only POST is allowed for API endpoints"}
		response, _ = json.Marshal(jResponse)
		w.WriteHeader(responseCode)
		_, err := w.Write(response)
		if err != nil {
			log.Println(err)
		}
		return
	}

	apiCall := r.URL.Path[len("/api/"):]
	switch apiCall {
	case "saveSecret":
		responseCode, response = apiSaveSecret(r)
	//case "unsecSave":
	//	responseCode, response = apiUnsecSave(r)
	case "get":
		responseCode, response = apiGetMessage(r)
	case "stat":
		responseCode, response = apiStat(r)
	case "ss":
		responseCode, response = apiStatSnapshot()
	default:
		jResponse := struct {
			Code        int    `json:"code"`
			Description string `json:"description"`
		}{responseCode, "Not implemented yet"}
		response, _ = json.Marshal(jResponse)
	}
	w.WriteHeader(responseCode)
	if responseCode == http.StatusNoContent || len(response) == 0 {
		return
	}
	_, err := w.Write(response)
	if err != nil {
		log.Println(err)
	}

}
