package main

import (
	"log"
	"net/http"
	"os"
)

const defaultDuration = 86400 * 7 // keep for 1 week
const maxDuration = 86400 * 30    // keep for 1 month
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

	appStats.Start()
	http.HandleFunc("/api/", apiHandler)
	log.Fatal(http.ListenAndServe(listenAddr, nil))
}
