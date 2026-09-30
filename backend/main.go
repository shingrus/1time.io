package main

import (
	"log"
	"net/http"
	"os"
)

const defaultDuration = 86400  // keep for 1 day (matches the client + protocol default)
const maxDuration = 86400 * 30 // keep for 1 month
//const randKeyLen = 12

//const secretMessageFieldName = "secretMessage"
//const secretKeyFieldName = "secretKey"
//const secretMessageMaxLen = 64 * 1024

var _, DEBUG = os.LookupEnv("DEBUG")

func main() {
	listenAddr := os.Getenv("LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = "127.0.0.1:8080"
	}

	if fileStorageDir == "" {
		log.Printf("Env %s is not set, exiting", FILE_STORAGE_DIR_VAR)
		os.Exit(1)
	}

	appStats.Start()
	startFileJanitor()
	http.HandleFunc("/healthz", healthHandler)
	http.HandleFunc("/api/", apiHandler)
	log.Fatal(http.ListenAndServe(listenAddr, nil))
}

// healthHandler checks the dependencies needed to create and read secrets.
// The Docker web container does not proxy this path to the public site.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := getRedisClient().Ping().Err(); err != nil {
		log.Printf("healthz: Redis: %v", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	if err := os.MkdirAll(fileStorageDir, 0750); err != nil {
		log.Printf("healthz: file storage: %v", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	probe, err := os.CreateTemp(fileStorageDir, ".health-*")
	if err != nil {
		log.Printf("healthz: file storage: %v", err)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	name := probe.Name()
	closeErr := probe.Close()
	removeErr := os.Remove(name)
	if closeErr != nil || removeErr != nil {
		log.Printf("healthz: file storage: close=%v remove=%v", closeErr, removeErr)
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
